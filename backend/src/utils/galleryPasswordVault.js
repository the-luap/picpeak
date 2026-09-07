/**
 * Recoverable storage for gallery passwords (#1271).
 *
 * Gallery passwords are bcrypt-hashed and that is what the login path
 * checks. Some operators would rather be able to look a password up or
 * resend it unchanged than reset it every time a client loses it, so an
 * explicit security setting, `security_gallery_password_recoverable`, lets
 * the plaintext be kept next to the hash — encrypted with AES-256-GCM under
 * a key derived from GALLERY_PASSWORD_ENCRYPTION_KEY, falling back to
 * JWT_SECRET. That is reversible by anyone holding the database AND the
 * key, which is a weaker posture than the hash and why it is opt-in and
 * off by default.
 *
 * Every write site that hashes a gallery or client password calls
 * galleryPasswordColumns() right after. With the setting off it is a
 * no-op, so nothing is ever stored unless the operator asked for it, and
 * turning the setting off purges what was stored.
 */
const crypto = require('crypto');
const { db } = require('../database/db');
const { getAppSetting } = require('./appSettings');

const SETTING_KEY = 'security_gallery_password_recoverable';
const ENC_ALGO = 'aes-256-gcm';
// Distinct salt from the OIDC secret helper, so the two never share a key
// even when both derive from JWT_SECRET.
const ENC_SALT = 'picpeak-gallery-password-vault-v1';

let keyCache = null;
function getKey() {
  const material = process.env.GALLERY_PASSWORD_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!material) throw new Error('galleryPasswordVault: GALLERY_PASSWORD_ENCRYPTION_KEY or JWT_SECRET must be set');
  if (keyCache && keyCache.material === material) return keyCache.key;
  keyCache = { material, key: crypto.scryptSync(material, ENC_SALT, 32) };
  return keyCache.key;
}

/** AES-256-GCM encrypt → "iv.tag.ciphertext" (base64url). */
function encryptPassword(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENC_ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ct].map((b) => b.toString('base64url')).join('.');
}

/** Reverse of encryptPassword. Throws on tamper or a rotated key. */
function decryptPassword(stored) {
  const [ivB64, tagB64, ctB64] = String(stored).split('.');
  if (!ivB64 || !tagB64 || !ctB64) throw new Error('galleryPasswordVault: malformed ciphertext');
  const decipher = crypto.createDecipheriv(ENC_ALGO, getKey(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64url')), decipher.final()]).toString('utf8');
}

/** The one reading of the setting's value, shared by the read and write paths. */
function isEnabledValue(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

async function isRecoverableStorageEnabled(conn = db) {
  return isEnabledValue(await getAppSetting(SETTING_KEY, false, conn));
}

/**
 * The column values that belong next to a new hash — spread them into the
 * same INSERT/UPDATE as password_hash / client_password_hash so the copy
 * and the hash can never disagree, even under concurrent writes.
 * `password: null` / `clientPassword: null` clears; with the setting off
 * the copy is cleared rather than skipped, so a password that changes while
 * storage is off cannot leave the previous plaintext behind to resurface,
 * stale, when storage is switched on again. `{}` when nothing was asked.
 */
async function galleryPasswordColumns(values = {}, conn = db) {
  const has = (key) => Object.prototype.hasOwnProperty.call(values, key);
  if (!has('password') && !has('clientPassword')) return {};
  const enabled = await isRecoverableStorageEnabled(conn);
  const columns = {};
  if (has('password')) {
    columns.password_recoverable = enabled && values.password ? encryptPassword(values.password) : null;
  }
  if (has('clientPassword')) {
    columns.client_password_recoverable = enabled && values.clientPassword ? encryptPassword(values.clientPassword) : null;
  }
  return columns;
}


/**
 * The stored plaintexts for an event, or nulls. `enabled` says whether the
 * setting is on; when it is off the columns are ignored even if a row still
 * carried a value (it should not — see purgeRecoverablePasswords).
 */
async function readGalleryPassword(eventId, conn = db) {
  const enabled = await isRecoverableStorageEnabled(conn);
  if (!enabled) return { enabled: false, password: null, clientPassword: null };
  const row = await conn('events').where('id', eventId)
    .first('password_recoverable', 'client_password_recoverable', 'require_password');
  if (!row) return { enabled: true, password: null, clientPassword: null };
  const open = (value) => {
    if (!value) return null;
    try { return decryptPassword(value); } catch (_) { return null; }
  };
  return { enabled: true, password: open(row.password_recoverable), clientPassword: open(row.client_password_recoverable) };
}

/**
 * Second half of the opt-out guarantee. Every write site calls this right
 * after the statement that carried galleryPasswordColumns(). The setting is
 * read before the bcrypt hashes, so a settings request that switches the
 * feature off and purges in that gap used to be overtaken by the write. The
 * settings writer flips the value before it purges, so a write that lands
 * after the purge reads "off" here and clears its own row, and one that
 * lands before it is caught by the purge. One settings read per password
 * write; the UPDATE only runs when the setting is off.
 */
async function dropCopiesIfStorageOff(eventId, conn = db) {
  if (await isRecoverableStorageEnabled(conn)) return false;
  await conn('events').where('id', eventId)
    .where((q) => q.whereNotNull('password_recoverable').orWhereNotNull('client_password_recoverable'))
    .update({ password_recoverable: null, client_password_recoverable: null });
  return true;
}

/** Wipe every stored plaintext; called when the setting is switched off. */
async function purgeRecoverablePasswords(conn = db) {
  return conn('events')
    .where((q) => q.whereNotNull('password_recoverable').orWhereNotNull('client_password_recoverable'))
    .update({ password_recoverable: null, client_password_recoverable: null });
}

module.exports = {
  SETTING_KEY,
  encryptPassword,
  decryptPassword,
  isRecoverableStorageEnabled,
  galleryPasswordColumns,
  isEnabledValue,
  readGalleryPassword,
  dropCopiesIfStorageOff,
  purgeRecoverablePasswords
};
