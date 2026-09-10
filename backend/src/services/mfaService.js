/**
 * mfaService — TOTP (RFC 6238) multi-factor auth for admin accounts (#738).
 *
 * Responsibilities:
 *   - generate/verify TOTP secrets (otplib, standard SHA1/6-digit/30s so
 *     Google Authenticator / Authy / 1Password all work), with replay
 *     protection: verifyTotpEncryptedStep() rejects a code whose matched
 *     time-step doesn't advance past the admin's last consumed one
 *     (GHSA-qcwx-r25m-j869 — otplib's window:1 tolerance alone lets a
 *     captured code stay valid across several time-steps, ~90s);
 *   - encrypt the secret at rest (AES-256-GCM) so a DB leak alone doesn't
 *     yield working authenticator seeds;
 *   - generate/verify one-time recovery codes, hashed (bcrypt) and single-use;
 *   - build the otpauth:// URI + QR data-URL for enrollment.
 *
 * The encryption key is derived (scrypt) from MFA_ENCRYPTION_KEY when set,
 * otherwise from JWT_SECRET. Rotating either invalidates stored secrets —
 * the same blast radius as rotating JWT_SECRET already has for sessions, and
 * `reset-admin-mfa.js` is the recovery path.
 */

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');

// Standard TOTP params; window:1 tolerates ±1 step (30s) of clock drift.
authenticator.options = { window: 1 };

const ISSUER = 'PicPeak';
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_BYTES = 10; // ~80 bits of entropy per code
const RECOVERY_BCRYPT_ROUNDS = 10;

const ENC_ALGO = 'aes-256-gcm';
const ENC_SALT = 'picpeak-mfa-secret-v1'; // fixed: derivation must be stable

function getEncryptionKey() {
  const material = process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!material) {
    throw new Error('mfaService: MFA_ENCRYPTION_KEY or JWT_SECRET must be set');
  }
  return crypto.scryptSync(material, ENC_SALT, 32);
}

/** Generate a fresh base32 TOTP secret. */
function generateSecret() {
  return authenticator.generateSecret();
}

/** AES-256-GCM encrypt a secret → "iv.tag.ciphertext" (all base64url). */
function encryptSecret(plainSecret) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENC_ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plainSecret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ct].map((b) => b.toString('base64url')).join('.');
}

/** Reverse of encryptSecret. Throws on tamper/wrong key. */
function decryptSecret(stored) {
  const key = getEncryptionKey();
  const [ivB64, tagB64, ctB64] = String(stored).split('.');
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error('mfaService: malformed encrypted secret');
  }
  const decipher = crypto.createDecipheriv(ENC_ALGO, key, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64url')), decipher.final()]);
  return pt.toString('utf8');
}

/** Absolute TOTP time-step for "now" (Math.floor(Date.now() / 30000)). */
function currentTotpStep() {
  return Math.floor(Date.now() / 30000);
}

/**
 * Core TOTP check. Returns the matched absolute time-step (always a
 * positive, truthy integer) when `code` is valid for `plainSecret`;
 * otherwise `null`.
 *
 * When `lastUsedStep` is given, a code whose matched step doesn't advance
 * past it is treated as invalid — replay protection. Without this, otplib's
 * window:1 tolerance lets a captured code stay valid across several real
 * time-steps (~90s), so the same code could complete two independent admin
 * logins (GHSA-qcwx-r25m-j869).
 */
function matchTotpStep(code, plainSecret, lastUsedStep) {
  if (!code || !plainSecret) return null;
  try {
    const token = String(code).replace(/\s+/g, '');
    const delta = authenticator.checkDelta(token, plainSecret);
    if (typeof delta !== 'number') return null;
    const step = currentTotpStep() + delta;
    if (typeof lastUsedStep === 'number' && step <= lastUsedStep) return null;
    return step;
  } catch {
    return null;
  }
}

/**
 * Verify a 6-digit TOTP code against the (plaintext) secret. Pass
 * `lastUsedStep` (the admin's previously-consumed step) to also enforce
 * replay protection — see matchTotpStep().
 */
function verifyTotp(code, plainSecret, lastUsedStep) {
  return matchTotpStep(code, plainSecret, lastUsedStep) !== null;
}

/** Verify a code against a STORED (encrypted) secret. */
function verifyTotpEncrypted(code, storedSecret, lastUsedStep) {
  try {
    return verifyTotp(code, decryptSecret(storedSecret), lastUsedStep);
  } catch {
    return false;
  }
}

/**
 * Like verifyTotpEncrypted(), but returns the matched step (or `null` when
 * the code is invalid/replayed) instead of a boolean, so a caller that
 * grants a session or a sensitive action can persist it as the admin's new
 * `two_factor_last_used_step`.
 */
function verifyTotpEncryptedStep(code, storedSecret, lastUsedStep) {
  try {
    return matchTotpStep(code, decryptSecret(storedSecret), lastUsedStep);
  } catch {
    return null;
  }
}

/** otpauth:// URI for an authenticator app. */
function buildOtpauthUri(accountName, plainSecret) {
  return authenticator.keyuri(accountName, ISSUER, plainSecret);
}

/** QR code (PNG data URL) for the otpauth URI. */
async function buildQrDataUrl(otpauthUri) {
  return QRCode.toDataURL(otpauthUri, { errorCorrectionLevel: 'M', margin: 1, width: 240 });
}

/** Format a raw code as human-friendly groups, e.g. "abcd-efgh-jk". */
function formatRecoveryCode(raw) {
  return raw.match(/.{1,4}/g).join('-');
}

/**
 * Generate RECOVERY_CODE_COUNT one-time codes. Returns the plaintext codes
 * (shown to the admin ONCE) and their bcrypt hashes (persisted).
 */
async function generateRecoveryCodes() {
  const plain = [];
  const hashed = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    // base32-ish, lowercase, no ambiguous chars
    const raw = crypto.randomBytes(RECOVERY_CODE_BYTES)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase()
      .slice(0, 10);
    const code = formatRecoveryCode(raw);
    plain.push(code);
    hashed.push(await bcrypt.hash(code, RECOVERY_BCRYPT_ROUNDS));
  }
  return { plain, hashed };
}

function normalizeRecoveryInput(code) {
  return String(code || '').trim().toLowerCase();
}

/**
 * Check a submitted recovery code against the stored hash array. On match,
 * returns the remaining hashes (matched one removed — single use). On miss,
 * matched:false and the array unchanged.
 *
 * @param {string[]} storedHashes
 * @returns {Promise<{matched: boolean, remainingHashes: string[]}>}
 */
async function consumeRecoveryCode(code, storedHashes) {
  const input = normalizeRecoveryInput(code);
  const hashes = Array.isArray(storedHashes) ? storedHashes : [];
  if (!input) return { matched: false, remainingHashes: hashes };
  for (let i = 0; i < hashes.length; i++) {
    // eslint-disable-next-line no-await-in-loop
    if (await bcrypt.compare(input, hashes[i])) {
      const remaining = hashes.slice(0, i).concat(hashes.slice(i + 1));
      return { matched: true, remainingHashes: remaining };
    }
  }
  return { matched: false, remainingHashes: hashes };
}

/** True when an admin row has MFA enabled (coerces SQLite/PG boolean shapes). */
function isEnrolled(admin) {
  const v = admin && admin.two_factor_enabled;
  return v === true || v === 1 || v === '1';
}

/** Parse the DB column (JSON text) into an array of hashes. */
function parseRecoveryCodes(raw) {
  if (!raw) return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

module.exports = {
  generateSecret,
  encryptSecret,
  decryptSecret,
  currentTotpStep,
  verifyTotp,
  verifyTotpEncrypted,
  verifyTotpEncryptedStep,
  buildOtpauthUri,
  buildQrDataUrl,
  generateRecoveryCodes,
  consumeRecoveryCode,
  parseRecoveryCodes,
  isEnrolled,
  formatRecoveryCode,
  ISSUER,
  RECOVERY_CODE_COUNT,
};
