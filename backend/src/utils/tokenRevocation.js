/**
 * Token Revocation System
 * Provides ability to invalidate tokens before expiration
 */

const { db } = require('../database/db');
const logger = require('./logger');

/**
 * Add a token to the revocation list
 * @param {string} token - JWT token to revoke
 * @param {string} reason - Reason for revocation
 * @param {Object} metadata - Additional metadata
 */
async function revokeToken(token, reason, metadata = {}) {
  try {
    // Extract token info without full verification (it might be compromised)
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    
    // Decode payload
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    await db('revoked_tokens').insert({
      token_id: payload.jti || `${payload.id}-${payload.iat}`, // JWT ID or fallback
      user_id: payload.id,
      token_type: payload.type,
      revoked_at: new Date().toISOString(),
      expires_at: new Date(payload.exp * 1000).toISOString(),
      reason,
      metadata: JSON.stringify(metadata)
    });
    
    logger.info('Token revoked', {
      userId: payload.id,
      tokenType: payload.type,
      reason
    });
    
    return true;
  } catch (error) {
    logger.error('Failed to revoke token', error);
    return false;
  }
}

/**
 * Check if a token is revoked
 * @param {Object} decodedToken - Decoded JWT payload
 * @returns {boolean} - True if token is revoked
 */
async function isTokenRevoked(decodedToken) {
  try {
    const tokenId = decodedToken.jti || `${decodedToken.id}-${decodedToken.iat}`;
    
    const revoked = await db('revoked_tokens')
      .where('token_id', tokenId)
      .orWhere((builder) => {
        builder
          .where('user_id', decodedToken.id)
          .where('revoked_at', '<=', new Date(decodedToken.iat * 1000).toISOString());
      })
      .first();
    
    return !!revoked;
  } catch (error) {
    logger.error('Failed to check token revocation', error);
    // Fail closed - treat as revoked if we can't check
    return true;
  }
}

/**
 * Revoke all tokens for a user
 * @param {number} userId - User ID
 * @param {string} reason - Reason for revocation
 */
async function revokeAllUserTokens(userId, reason) {
  try {
    // This effectively revokes all tokens by setting a revocation time
    // Any token issued before this time will be considered revoked
    await db('user_token_revocations').insert({
      user_id: userId,
      revoked_at: new Date().toISOString(),
      reason
    }).onConflict('user_id').merge();
    
    logger.info('All user tokens revoked', { userId, reason });
    return true;
  } catch (error) {
    logger.error('Failed to revoke user tokens', error);
    return false;
  }
}

/**
 * Clean up expired revoked tokens
 * Should be run periodically
 */
async function cleanupExpiredRevocations() {
  try {
    const deleted = await db('revoked_tokens')
      .where('expires_at', '<', new Date().toISOString())
      .delete();
    
    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} expired token revocations`);
    }
  } catch (error) {
    logger.error('Failed to cleanup revoked tokens', error);
  }
}

/**
 * Initialize cleanup job for expired revocations
 */
function initializeRevocationCleanup() {
  // Run cleanup every 6 hours
  setInterval(cleanupExpiredRevocations, 6 * 60 * 60 * 1000);
  
  // Run initial cleanup
  cleanupExpiredRevocations();
}

module.exports = {
  revokeToken,
  isTokenRevoked,
  revokeAllUserTokens,
  cleanupExpiredRevocations,
  initializeRevocationCleanup
};