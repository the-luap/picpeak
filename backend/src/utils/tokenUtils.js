const ADMIN_COOKIE_NAME = 'admin_token';
const GALLERY_COOKIE_NAME = 'gallery_token';
const GALLERY_COOKIE_PREFIX = 'gallery_token_';
const GUEST_COOKIE_PREFIX = 'guest_token_';
// Customer-account session cookie (#354). Distinct name + path from the
// admin cookie so a single browser can hold both an admin and a customer
// session without one clobbering the other (e.g. for the admin dogfooding
// the customer dashboard).
const CUSTOMER_COOKIE_NAME = 'customer_token';

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

/**
 * Best-effort decode of a JWT payload WITHOUT verifying the signature.
 * Used by the token-extraction helpers below to peek at the `type` claim
 * so we can decide whether a given Authorization Bearer header is the
 * RIGHT type of token for the caller. Signature verification still
 * happens at the route layer via jwt.verify; this peek only filters
 * out wrong-type tokens.
 *
 * Returns null on any parse error so the helpers fall through to cookies
 * rather than mis-routing to the wrong token type.
 */
function peekTokenType(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    return typeof payload.type === 'string' ? payload.type : null;
  } catch {
    return null;
  }
}

/**
 * Pull a Bearer token from the Authorization header IFF it claims the
 * expected `type`. Otherwise null.
 *
 * Why: when an admin and a customer are logged in the same browser, the
 * admin's `admin_token` is read from sessionStorage by the events service
 * and attached as `Authorization: Bearer <admin token>` on requests
 * unrelated to the admin surface. Without a type-check here, the
 * gallery-side `/auth/session?slug=…` would happily return that admin
 * token, decode it as `type:'admin'`, and report the wrong identity —
 * which is exactly what defeated the prefer-gallery precedence fix on
 * the dual-cookie test.
 */
function getBearerTokenIfType(req, expectedType) {
  const header = req.headers?.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.substring(7);
  return peekTokenType(token) === expectedType ? token : null;
}

function setAdminAuthCookie(res, token) {
  if (!token) return;
  res.cookie(ADMIN_COOKIE_NAME, token, buildCookieOptionsWithExpiry(res));
}

function clearAdminAuthCookie(res) {
  res.clearCookie(ADMIN_COOKIE_NAME, buildClearCookieOptions());
}

function setCustomerAuthCookie(res, token) {
  if (!token) return;
  res.cookie(CUSTOMER_COOKIE_NAME, token, buildCookieOptionsWithExpiry(res));
}

function clearCustomerAuthCookie(res) {
  res.clearCookie(CUSTOMER_COOKIE_NAME, buildClearCookieOptions());
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
  // Honour Authorization: Bearer only if the JWT claims type:'admin'.
  // Stops gallery/customer tokens that happen to be on the request from
  // being mistaken for admin auth (mirrors getGalleryTokenFromRequest's
  // protection in the other direction).
  const bearer = getBearerTokenIfType(req, 'admin');
  if (bearer) return bearer;
  return req.cookies?.[ADMIN_COOKIE_NAME] || null;
}

/**
 * Customer-side equivalent. Cookie-only — we deliberately do NOT honour
 * the Authorization: Bearer header on /api/customer/* endpoints.
 *
 * Reason: admins occasionally hit the customer routes from the same
 * browser (e.g. while dogfooding the dashboard). The shared axios
 * client picks up the admin's token from `admin_token` and attaches it
 * as `Authorization: Bearer <admin token>` for every request. If we
 * accepted that header here, a logged-in admin's `'admin'` token would
 * be returned and immediately rejected by the type check downstream as
 * "wrong token type" — kicking the customer out on every reload.
 *
 * Customers don't have an API-token flow, so dropping the header
 * fallback costs nothing and prevents the cross-contamination.
 */
function getCustomerTokenFromRequest(req) {
  return req.cookies?.[CUSTOMER_COOKIE_NAME] || null;
}

function getGalleryTokenFromRequest(req, slug) {
  // Honour Authorization: Bearer only if the JWT claims type:'gallery'.
  // The previous unconditional Bearer pickup defeated the prefer-gallery
  // precedence fix on /auth/session?slug=…: an admin token attached as
  // Bearer (e.g. by the shared events.service.ts auto-auth path) was
  // returned here, decoded as type:'admin' downstream, and mis-rendered
  // the gallery as "logged in as admin" which kicked the customer back
  // to the per-event password prompt.
  const bearer = getBearerTokenIfType(req, 'gallery');
  if (bearer) return bearer;

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
  CUSTOMER_COOKIE_NAME,
  sanitizeSlugForCookie,
  setAdminAuthCookie,
  clearAdminAuthCookie,
  setCustomerAuthCookie,
  clearCustomerAuthCookie,
  setGalleryAuthCookies,
  clearGalleryAuthCookies,
  getAdminTokenFromRequest,
  getCustomerTokenFromRequest,
  getGalleryTokenFromRequest,
  getGuestTokenFromRequest,
};
