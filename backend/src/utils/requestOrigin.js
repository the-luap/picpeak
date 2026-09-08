/**
 * Origin allow-listing shared by the CORS options and the multipart CSRF gate
 * in server.js. Kept apart from server.js so it can be unit-tested without
 * booting the app.
 */
const { getFrontendBaseUrlSync } = require('./frontendUrl');

function isAllowedOrigin(origin) {
  const allowedOrigins = [
    getFrontendBaseUrlSync() || 'http://localhost:3005',
    process.env.ADMIN_URL || 'http://localhost:3005'
  ];
  if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push(
      'http://localhost:5173', // Vite dev server
      'http://localhost:3002', // Backend server
      'http://localhost:3001', // For API testing
      'http://localhost:3000'  // Direct backend access
    );
  }
  return allowedOrigins.indexOf(origin) !== -1;
}

// Check every browser mutation, including an empty form POST. Explicitly
// configured frontend origins may be cross-site; a sibling origin alone is
// not trusted. Non-browser clients without Origin/Fetch Metadata still work.
function mutationOriginAllowed(req) {
  // Fetch Metadata is set by the browser and cannot be forged cross-site, so a
  // same-origin request is trusted before the Origin/Host/scheme comparison,
  // which depends on trust proxy and X-Forwarded-Proto being configured.
  const site = req.headers['sec-fetch-site'];
  if (site === 'same-origin') return true;
  const origin = req.headers.origin;
  if (origin) {
    if (isAllowedOrigin(origin)) return true;
    try {
      const parsed = new URL(origin);
      return parsed.origin !== 'null' && parsed.host === req.headers.host
        && (!req.protocol || parsed.protocol === `${req.protocol}:`);
    } catch { return false; }
  }
  return !site || site === 'none';
}

// Compatibility export for existing callers.
const multipartOriginAllowed = mutationOriginAllowed;
module.exports = { isAllowedOrigin, mutationOriginAllowed, multipartOriginAllowed };
