const ADMIN_COOKIE_NAME = 'admin_token';
const GALLERY_COOKIE_NAME = 'gallery_token';
const GALLERY_COOKIE_PREFIX = 'gallery_token_';
const GUEST_COOKIE_PREFIX = 'guest_token_';

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Cookie "Secure" flag mode:
 *   - true   → always set Secure (HTTPS-only)
 *   - false  → never set Secure (allow plain HTTP)
 *   - 'auto' → decide per-request based on req.secure (X-Forwarded-Proto
 *              via Express `trust proxy`). Useful when the same deployment
 *              is reachable over both HTTPS (via reverse proxy) and LAN HTTP.
 *
 * Default: follows NODE_ENV (production → true, dev → false) — unchanged
 * from previous behavior. Users who want the auto mode must opt in with
 * COOKIE_SECURE=auto in their .env.
 */
const secureCookieMode = (() => {
  const raw = typeof process.env.COOKIE_SECURE === 'string'
    ? process.env.COOKIE_SECURE.toLowerCase()
    : '';
  if (raw === 'auto') return 'auto';
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  // No env var set → legacy default
  return process.env.NODE_ENV === 'production';
})();
const sameSiteDefault = process.env.COOKIE_SAMESITE || 'Lax';
const cookieDomain = process.env.COOKIE_DOMAIN;

/**
 * Resolve the Secure flag for a specific response. When in 'auto' mode,
 * checks req.secure (which reflects the X-Forwarded-Proto header when the
 * proxy is in the trust list set by `app.set('trust proxy', ...)`). When
 * called without a `res`, falls back to false — this only happens in code
 * paths that don't yet have a response object, which we avoid.
 */
function resolveSecureFlag(res) {
  if (secureCookieMode === 'auto') {
    return Boolean(res?.req?.secure);
  }
  return secureCookieMode;
}

function buildCookieBaseOptions(res) {
  const options = {
    httpOnly: true,
    secure: resolveSecureFlag(res),
    sameSite: sameSiteDefault,
    path: '/',
  };

  if (cookieDomain) {
    options.domain = cookieDomain;
  }

  return options;
}

function buildCookieOptionsWithExpiry(res, maxAgeMs = DEFAULT_MAX_AGE_MS) {
  return {
    ...buildCookieBaseOptions(res),
    maxAge: maxAgeMs,
  };
}

/**
 * Options for clearing a cookie. We deliberately omit `secure` here: when
 * a cookie was set over HTTPS (Secure=true) and we later need to clear it
 * from a response on an HTTP path (or vice versa, in mixed-protocol
 * deployments with COOKIE_SECURE=auto), specifying `secure` in the clear
 * options causes some browsers to reject the Set-Cookie delete header.
 * Browsers match the cookie by (name, domain, path) for deletion, so
 * leaving Secure off produces a header the browser always accepts.
 */
function buildClearCookieOptions() {
  const options = {
    httpOnly: true,
    sameSite: sameSiteDefault,
    path: '/',
  };

  if (cookieDomain) {
    options.domain = cookieDomain;
  }

  return options;
}

function sanitizeSlugForCookie(slug = '') {
  return String(slug).replace(/[^A-Za-z0-9_-]/g, '_');
}

function setAdminAuthCookie(res, token) {
  if (!token) return;
  res.cookie(ADMIN_COOKIE_NAME, token, buildCookieOptionsWithExpiry(res));
}

function clearAdminAuthCookie(res) {
  res.clearCookie(ADMIN_COOKIE_NAME, buildClearCookieOptions());
}

function setGalleryAuthCookies(res, token, slug) {
  if (!token) return;
  const options = buildCookieOptionsWithExpiry(res);
  res.cookie(GALLERY_COOKIE_NAME, token, options);
  if (slug) {
    const cookieName = `${GALLERY_COOKIE_PREFIX}${sanitizeSlugForCookie(slug)}`;
    res.cookie(cookieName, token, options);
  }
}

function clearGalleryAuthCookies(res, slug) {
  const clearOptions = buildClearCookieOptions();
  res.clearCookie(GALLERY_COOKIE_NAME, clearOptions);

  const cookies = res.req?.cookies || {};

  if (slug) {
    const cookieName = `${GALLERY_COOKIE_PREFIX}${sanitizeSlugForCookie(slug)}`;
    res.clearCookie(cookieName, clearOptions);
  } else {
    Object.keys(cookies).forEach((name) => {
      if (name.startsWith(GALLERY_COOKIE_PREFIX)) {
        res.clearCookie(name, clearOptions);
      }
    });
  }
}

function getAdminTokenFromRequest(req) {
  const header = req.headers?.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.substring(7);
  }
  return req.cookies?.[ADMIN_COOKIE_NAME] || null;
}

function getGalleryTokenFromRequest(req, slug) {
  const header = req.headers?.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.substring(7);
  }

  if (!req.cookies) {
    return null;
  }

  if (slug) {
    const cookieName = `${GALLERY_COOKIE_PREFIX}${sanitizeSlugForCookie(slug)}`;
    if (req.cookies[cookieName]) {
      return req.cookies[cookieName];
    }
  }

  if (req.cookies[GALLERY_COOKIE_NAME]) {
    return req.cookies[GALLERY_COOKIE_NAME];
  }

  const prefixed = Object.keys(req.cookies).find((name) => name.startsWith(GALLERY_COOKIE_PREFIX));
  if (prefixed) {
    return req.cookies[prefixed];
  }

  return null;
}

function getGuestTokenFromRequest(req, slug) {
  // Primary transport: custom header (set by frontend axios interceptor).
  const headerToken = req.headers?.['x-guest-token'];
  if (headerToken) {
    return headerToken;
  }

  if (!req.cookies) {
    return null;
  }

  if (slug) {
    const cookieName = `${GUEST_COOKIE_PREFIX}${sanitizeSlugForCookie(slug)}`;
    if (req.cookies[cookieName]) {
      return req.cookies[cookieName];
    }
  }

  const prefixed = Object.keys(req.cookies).find((name) => name.startsWith(GUEST_COOKIE_PREFIX));
  if (prefixed) {
    return req.cookies[prefixed];
  }

  return null;
}

module.exports = {
  ADMIN_COOKIE_NAME,
  GALLERY_COOKIE_NAME,
  GALLERY_COOKIE_PREFIX,
  GUEST_COOKIE_PREFIX,
  sanitizeSlugForCookie,
  setAdminAuthCookie,
  clearAdminAuthCookie,
  setGalleryAuthCookies,
  clearGalleryAuthCookies,
  getAdminTokenFromRequest,
  getGalleryTokenFromRequest,
  getGuestTokenFromRequest,
};
