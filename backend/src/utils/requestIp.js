/**
 * Resolve the originating client IP address, accounting for reverse proxies.
 * Returns the first entry from X-Forwarded-For when available, otherwise falls back
 * to Express/Node connection properties.
 * @param {import('express').Request} req
 * @returns {string}
 */
function getClientIp(req) {
  if (!req) {
    return '';
  }

  const forwardedFor = req.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    const [firstIp] = forwardedFor.split(',').map(part => part.trim()).filter(Boolean);
    if (firstIp) {
      return firstIp;
    }
  } else if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    const [firstIp] = forwardedFor;
    if (firstIp) {
      return firstIp.trim();
    }
  }

  return (
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.connection?.socket?.remoteAddress ||
    ''
  );
}

module.exports = { getClientIp };
