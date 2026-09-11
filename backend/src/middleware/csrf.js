const { mutationOriginAllowed } = require('../utils/requestOrigin');

// The origin check is the CSRF defence. This list only has to keep out what
// a cross-site page can send without a preflight: a form cannot produce JSON
// or octet-stream, and fetch() with either is not CORS-safelisted.
// octet-stream is how the chunked upload route receives its raw body
// (#1377); express.json leaves it unread for everything else.
const ALLOWED_CONTENT_TYPES = ['application/json', 'multipart/form-data', 'application/octet-stream'];

module.exports = function csrfProtection(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  if (!mutationOriginAllowed(req)) {
    return res.status(403).json({ error: 'Cross-site request rejected' });
  }
  const contentType = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  const hasBody = Number(req.headers['content-length']) > 0 || !!req.headers['transfer-encoding'];
  const allowed = ALLOWED_CONTENT_TYPES.includes(contentType) || contentType.endsWith('+json');
  if (hasBody && !allowed) {
    return res.status(415).json({ error: `Unsupported Content-Type. Use ${ALLOWED_CONTENT_TYPES.join(', ')}.` });
  }
  next();
};
