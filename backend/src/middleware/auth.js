const jwt = require('jsonwebtoken');
const sessionAccess = require('../services/sessionAccessService');
const logger = require('../utils/logger');
const { getAdminTokenFromRequest } = require('../utils/tokenUtils');

/**
 * Enhanced admin authentication middleware with revocation checking
 */
async function adminAuth(req, res, next) {
  try {
    const token = getAdminTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: 'picpeak-auth',
        complete: true
      });
      decoded = decoded.payload;
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const admin = await sessionAccess.admin(decoded);
    const requestIp = req.ip || req.connection?.remoteAddress;
    if (decoded.ip && requestIp && decoded.ip !== requestIp) {
      logger.info('admin session IP changed', { accountId: admin.id, tokenIp: decoded.ip, requestIp });
    }

    // Add user info to request (enhanced with role)
    req.admin = {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      roleId: admin.role_id,
      roleName: admin.role_name,
      // From the token, not the database: it is a property of this session
      // rather than of the account (#1186). Carried so a route that reissues
      // the token — change-password — can preserve the choice instead of
      // silently dropping the session back to 24h.
      rememberMe: decoded.rememberMe === true
    };
    req.token = token; // Store token for potential revocation
    
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(error.statusCode || 401).json({
      error: error.isOperational ? error.message : 'Authentication failed',
      ...(error.isOperational && { code: error.code }),
    });
  }
}

module.exports = {
  adminAuth
};
