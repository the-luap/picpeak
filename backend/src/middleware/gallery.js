const jwt = require('jsonwebtoken');
const { db, withRetry } = require('../database/db');
const { formatBoolean } = require('../utils/dbCompat');
const { getGalleryTokenFromRequest } = require('../utils/tokenUtils');
const { userHasAllPermissions } = require('./permissions');
const { isTokenRevoked } = require('../utils/tokenRevocation');
const logger = require('../utils/logger');

// Admin preview of an unpublished gallery.
//
// Two transports (#1386):
//
//   admin_preview=1  — an INTENT flag, authenticated by the admin's existing
//                      HttpOnly admin_token cookie (or an Authorization
//                      bearer). This is the one the frontend uses. The cookie
//                      rides along on same-origin requests automatically,
//                      including the native fetch() that AuthenticatedImage
//                      uses, so media works too — and no credential ever
//                      appears in a URL.
//
//   preview=<jwt>    — the original transport, kept so existing hand-built
//                      links keep working. It puts an admin JWT in the query
//                      string, which reaches nginx access logs, browser
//                      history and Referer headers, so nothing emits it any
//                      more.
function previewTokenFrom(req) {
  if (req.query?.admin_preview === '1') {
    const header = req.headers?.authorization;
    const bearer = header && header.startsWith('Bearer ') ? header.substring(7) : null;
    const candidate = req.cookies?.admin_token || bearer;
    if (candidate) return candidate;
  }
  return req.query?.preview || null;
}

function decodeAdminToken(token) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'], issuer: 'picpeak-auth',
    });
    return decoded.type === 'admin' ? decoded : null;
  } catch {
    return null;
  }
}

/**
 * Signature-only predicate. It proves the caller holds SOME valid admin token
 * and nothing else — not that the account still exists, not that the token is
 * unrevoked, and not that this admin may see this event.
 *
 * Its only legitimate use is shaping the event lookup, which has to decide
 * whether to include drafts BEFORE there is an event to authorize against.
 * Every such lookup must be followed by assertDraftPreviewAllowed (#1411).
 */
function previewClaimed(req) {
  return decodeAdminToken(previewTokenFrom(req)) !== null;
}

/**
 * Full authorization for previewing a specific event (#1411).
 *
 * The signature check above used to be the whole story, so any valid admin
 * token previewed any draft — including one created by a different admin, and
 * including an account whose role grants neither events.view nor photos.view.
 * `main` closes this via access.authorize; this is the same rule applied where
 * this branch keeps its checks.
 */
async function verifyAdminPreview(req, event) {
  const decoded = decodeAdminToken(previewTokenFrom(req));
  if (!decoded || !event) return false;

  // A signed-out or rotated session must stop previewing, same as it stops
  // reaching every other admin surface.
  try {
    if (await isTokenRevoked(decoded)) return false;
  } catch (error) {
    // Fail closed: a transient DB fault must not become a free preview.
    logger.warn('Admin preview revocation check failed', { error: error.message });
    return false;
  }

  let admin;
  try {
    admin = await db('admin_users')
      .leftJoin('roles', 'roles.id', 'admin_users.role_id')
      .where({ 'admin_users.id': decoded.id, 'admin_users.is_active': formatBoolean(true) })
      .select('admin_users.id', 'roles.name as role_name')
      .first();
  } catch (error) {
    // Same posture as adminAuth's join fallback: an install whose roles table
    // predates the schema still has admins, but it has no role to check, so
    // ownership below is the only gate that applies.
    logger.debug('Admin preview role lookup failed', { error: error.message });
    admin = await db('admin_users')
      .where({ id: decoded.id, is_active: formatBoolean(true) })
      .select('id').first();
    if (admin) admin.role_name = null;
  }
  if (!admin) return false;

  // Ownership: super_admin sees everything, everyone else sees ownerless
  // (legacy/system) events plus their own — the rule requireEventOwnership
  // and scopeEventsQuery already enforce elsewhere.
  const owns = admin.role_name === 'super_admin'
    || !event.created_by
    || Number(event.created_by) === Number(admin.id);
  if (!owns) return false;

  try {
    return await userHasAllPermissions(admin.id, ['events.view', 'photos.view']);
  } catch (error) {
    logger.warn('Admin preview permission check failed', { error: error.message });
    return false;
  }
}

/**
 * Gate a loaded event behind the preview rules. Published events pass through
 * untouched; a draft is visible only to an authorized admin preview. Returns
 * false when the caller must be told the gallery does not exist.
 */
async function assertDraftPreviewAllowed(req, event) {
  if (!event) return true;
  const isDraft = event.is_draft === true || event.is_draft === 1 || event.is_draft === '1';
  if (!isDraft) return true;
  return verifyAdminPreview(req, event);
}

// Middleware to verify gallery access
async function verifyGalleryAccess(req, res, next) {
  try {
    const requestedSlug = req.params.slug || req.requestedSlug;
    const token = getGalleryTokenFromRequest(req, requestedSlug);
    let event;

    if (!token) {
      if (!requestedSlug) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const adminPreview = previewClaimed(req);
      event = await withRetry(async () => {
        const q = db('events')
          .where({
            slug: requestedSlug,
            is_active: formatBoolean(true),
            is_archived: formatBoolean(false)
          });
        if (!adminPreview) {
          q.where({ is_draft: formatBoolean(false) });
        }
        return await q.select('*').first();
      });

      if (!event) {
        return res.status(404).json({ error: 'Gallery not found or expired' });
      }

      // The lookup above included drafts on a signature-only check. Authorize
      // the draft now that there is an event to authorize against (#1411).
      if (!await assertDraftPreviewAllowed(req, event)) {
        return res.status(404).json({ error: 'Gallery not found or expired' });
      }

      const requiresPassword = !(event.require_password === false || event.require_password === 0 || event.require_password === '0');
      if (!requiresPassword) {
        req.event = event;
        req.sessionID = `gallery_public_${event.id}_${Date.now()}`;
        req.clientInfo = {
          ip: req.ip || req.connection.remoteAddress || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          fingerprint: `${req.ip}-${req.get('User-Agent')}`.substring(0, 32),
          timestamp: Date.now()
        };
        return next();
      }

      return res.status(401).json({ error: 'No token provided' });
    }
    
    // Try to verify with issuer first, fallback to no issuer for backward compatibility
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: 'picpeak-auth'
      });
    } catch (error) {
      // If verification fails with issuer, try without issuer (backward compatibility)
      if (error.name === 'JsonWebTokenError' && error.message.includes('jwt issuer invalid')) {
        decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      } else {
        throw error;
      }
    }
    logger.debug('[verifyGalleryAccess] Token decoded successfully', { eventId: decoded.eventId, slug: requestedSlug });

    // Only gallery-scoped tokens grant gallery access. Every legitimate
    // path (password login, share link, client access, customer-minted,
    // slideshow) mints type:'gallery'. Reject anything else — e.g. a guest
    // identity token (type:'guest', for feedback attribution) that carries a
    // matching eventId — instead of relying on other token types incidentally
    // lacking an eventId to fail the id match below.
    if (decoded.type !== 'gallery') {
      return res.status(403).json({ error: 'Invalid token type for gallery access' });
    }

    // If we have a slug in the URL params or from pre-middleware, verify it matches
    if (requestedSlug) {
      // Verify by slug and ensure it matches the token's event
      const adminPreviewToken = previewClaimed(req);
      event = await withRetry(async () => {
        const q = db('events')
          .where({
            slug: requestedSlug,
            is_active: formatBoolean(true),
            is_archived: formatBoolean(false)
          });
        if (!adminPreviewToken) {
          q.where({ is_draft: formatBoolean(false) });
        }
        return await q.select('*').first();
      });
      
      // Verify the token's eventId matches
      if (event && event.id !== decoded.eventId) {
        return res.status(403).json({ error: 'Token does not match requested gallery' });
      }
    } else {
      // Fallback to using eventId from token
      const adminPreviewFallback = previewClaimed(req);
      event = await withRetry(async () => {
        const q = db('events')
          .where({
            id: decoded.eventId,
            is_active: formatBoolean(true),
            is_archived: formatBoolean(false)
          });
        if (!adminPreviewFallback) {
          q.where({ is_draft: formatBoolean(false) });
        }
        return await q.select('*').first();
      });
    }
    
    if (!event) {
      logger.warn('[verifyGalleryAccess] Event not found for slug', { slug: requestedSlug || 'no-slug', tokenEventId: decoded.eventId });
      return res.status(404).json({ error: 'Gallery not found or expired' });
    }

    // Same gate as the public branch above (#1411): the draft was included in
    // the lookup on a signature-only check and has to be authorized here.
    if (!await assertDraftPreviewAllowed(req, event)) {
      return res.status(404).json({ error: 'Gallery not found or expired' });
    }

    // Customer-minted gallery JWTs (#354): when the customer obtained
    // this token via /api/customer/events/:slug/access-token, the
    // payload carries `via:'customer'` and `customerId`. The admin
    // can revoke the customer's access at any time by removing the
    // event_customer_assignments row from the "Manage galleries"
    // dialog on the customer detail page. Re-check that row here so
    // the revocation takes effect on the customer's very next
    // request — no token-blacklisting machinery required.
    if (decoded.via === 'customer' && decoded.customerId) {
      const assignment = await withRetry(async () => {
        return await db('event_customer_assignments')
          .where({
            event_id: event.id,
            customer_account_id: decoded.customerId,
          })
          .first();
      });
      if (!assignment) {
        logger.info('[verifyGalleryAccess] Customer assignment revoked, rejecting token', {
          customerId: decoded.customerId,
          eventId: event.id,
        });
        return res.status(403).json({
          error: 'Access to this gallery has been revoked',
          code: 'CUSTOMER_ASSIGNMENT_REVOKED',
        });
      }
    }

    logger.debug('[verifyGalleryAccess] Event located', { eventId: event.id, slug: event.slug });
    req.event = event;
    req.accessLevel = decoded.accessLevel || 'guest';
    req.sessionID = decoded.sessionId || `gallery_${event.id}_${Date.now()}`;

    // Create client info for logging (similar to secureImageMiddleware but simpler)
    req.clientInfo = {
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      fingerprint: `${req.ip}-${req.get('User-Agent')}`.substring(0, 32), // Limit to 32 chars for DB column
      timestamp: Date.now()
    };
    
    logger.debug('[verifyGalleryAccess] Access granted', { eventId: event.id, slug: event.slug });
    next();
  } catch (error) {
    logger.error('Error verifying gallery access', { error: error.message, stack: error.stack });
    res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Deny a slideshow-scoped JWT. The Live Slideshow token (accessLevel
 * 'slideshow') is reused as a `type:'gallery'` token so it can read photos for
 * the kiosk, which means every verifyGalleryAccess-protected route would
 * otherwise accept it. A projector URL is meant to be display-only and is
 * comparatively easy to leak (browser history, venue laptop, USB), so this
 * gate is placed AFTER verifyGalleryAccess on the write/bulk-download routes to
 * keep a leaked slideshow link from downloading, uploading, or posting
 * feedback. (#646 review)
 */
function denySlideshowToken(req, res, next) {
  if (req.accessLevel === 'slideshow') {
    return res.status(403).json({ error: 'Slideshow tokens are display-only' });
  }
  next();
}

module.exports = {
  verifyGalleryAccess,
  denySlideshowToken,
  previewClaimed,
  verifyAdminPreview,
  assertDraftPreviewAllowed
};
