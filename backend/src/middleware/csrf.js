const { mutationOriginAllowed } = require('../utils/requestOrigin');

module.exports = function csrfProtection(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  if (!mutationOriginAllowed(req)) {
    return res.status(403).json({ error: 'Cross-site request rejected' });
  }
  const contentType = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  const hasBody = Number(req.headers['content-length']) > 0 || !!req.headers['transfer-encoding'];
  if (hasBody && !['application/json', 'multipart/form-data'].includes(contentType)) {
    return res.status(415).json({ error: 'Unsupported Content-Type. Use application/json or multipart/form-data.' });
  }
  next();
};
