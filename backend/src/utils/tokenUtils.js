const ADMIN_COOKIE_NAME = 'admin_token';
const GALLERY_COOKIE_NAME = 'gallery_token';
const GALLERY_COOKIE_PREFIX = 'gallery_token_';

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

const secureCookie = (() => {
  if (typeof process.env.COOKIE_SECURE === 'string') {
    return process.env.COOKIE_SECURE.toLowerCase() === 'true';
  }
  // Default to false so native HTTP installs stay functional. Operators can
  // opt-in via COOKIE_SECURE=true when serving behind HTTPS.
  return false;
})();
const sameSiteDefault = process.env.COOKIE_SAMESITE || 'Lax';
const cookieDomain = process.env.COOKIE_DOMAIN;

function buildCookieBaseOptions() {
  const options = {
    httpOnly: true,
    secure: secureCookie,
    sameSite: sameSiteDefault,
    path: '/',
  };

  if (cookieDomain) {
    options.domain = cookieDomain;
  }

  return options;
}

function buildCookieOptionsWithExpiry(maxAgeMs = DEFAULT_MAX_AGE_MS) {
  return {
    ...buildCookieBaseOptions(),
    maxAge: maxAgeMs,
  };
}

function sanitizeSlugForCookie(slug = '') {
  return String(slug).replace(/[^A-Za-z0-9_-]/g, '_');
}

function setAdminAuthCookie(res, token) {
  if (!token) return;
  res.cookie(ADMIN_COOKIE_NAME, token, buildCookieOptionsWithExpiry());
}

function clearAdminAuthCookie(res) {
  res.clearCookie(ADMIN_COOKIE_NAME, buildCookieBaseOptions());
}

function setGalleryAuthCookies(res, token, slug) {
  if (!token) return;
  const options = buildCookieOptionsWithExpiry();
  res.cookie(GALLERY_COOKIE_NAME, token, options);
  if (slug) {
    const cookieName = `${GALLERY_COOKIE_PREFIX}${sanitizeSlugForCookie(slug)}`;
    res.cookie(cookieName, token, options);
  }
}

function clearGalleryAuthCookies(res, slug) {
  const baseOptions = buildCookieBaseOptions();
  res.clearCookie(GALLERY_COOKIE_NAME, baseOptions);

  const cookies = res.req?.cookies || {};

  if (slug) {
    const cookieName = `${GALLERY_COOKIE_PREFIX}${sanitizeSlugForCookie(slug)}`;
    res.clearCookie(cookieName, baseOptions);
  } else {
    Object.keys(cookies).forEach((name) => {
      if (name.startsWith(GALLERY_COOKIE_PREFIX)) {
        res.clearCookie(name, baseOptions);
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

module.exports = {
  ADMIN_COOKIE_NAME,
  GALLERY_COOKIE_NAME,
  GALLERY_COOKIE_PREFIX,
  sanitizeSlugForCookie,
  setAdminAuthCookie,
  clearAdminAuthCookie,
  setGalleryAuthCookies,
  clearGalleryAuthCookies,
  getAdminTokenFromRequest,
  getGalleryTokenFromRequest,
};
