/**
 * Password Validation and Security Utilities
 * Implements strong password requirements and security checks
 */

const zxcvbn = require('zxcvbn');
const logger = require('./logger');

// Configuration
const PASSWORD_CONFIG = {
  minLength: 8, // Reduced from 12 to 8 for better usability
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false, // Made optional for gallery passwords
  preventCommonPasswords: true,
  minStrengthScore: 2, // Reduced from 3 to 2 (moderate strength)
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12 // Configurable, default 12
};

// Common passwords to block (extend this list)
const COMMON_PASSWORDS = [
  'password', 'password123', 'admin123', 'welcome123', 'test123',
  'qwerty', 'abc123', '123456', 'password1', 'admin',
  'letmein', 'welcome', 'monkey', 'dragon', 'baseball'
];

/**
 * Validate password meets security requirements
 * @param {string} password - Password to validate
 * @param {Object} options - Optional configuration overrides
 * @returns {Object} - { valid: boolean, errors: string[], score: number, feedback: Object }
 */
function validatePassword(password, options = {}) {
  const config = { ...PASSWORD_CONFIG, ...options };
  const errors = [];
  
  // Check if password exists
  if (!password || typeof password !== 'string') {
    return {
      valid: false,
      errors: ['Password is required'],
      score: 0,
      feedback: {}
    };
  }
  
  // Check minimum length
  if (password.length < config.minLength) {
    errors.push(`Password must be at least ${config.minLength} characters long`);
  }
  
  // Check uppercase requirement
  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  // Check lowercase requirement
  if (config.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  // Check number requirement
  if (config.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  // Check special character requirement
  if (config.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Check against common passwords
  if (config.preventCommonPasswords) {
    const lowerPassword = password.toLowerCase();
    if (COMMON_PASSWORDS.includes(lowerPassword)) {
      errors.push('This password is too common. Please choose a more unique password');
    }
  }
  
  // Skip zxcvbn check if explicitly disabled (for gallery passwords)
  if (options.skipStrengthCheck) {
    return {
      valid: errors.length === 0,
      errors,
      score: 2, // Default moderate score for gallery passwords
      feedback: {}
    };
  }
  
  // Use zxcvbn for strength analysis
  const strength = zxcvbn(password);
  
  // Check minimum strength score
  if (strength.score < config.minStrengthScore) {
    errors.push('Password is too weak. Please choose a stronger password');
  }
  
  // Add zxcvbn suggestions
  if (strength.feedback.suggestions.length > 0) {
    errors.push(...strength.feedback.suggestions);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    score: strength.score,
    feedback: {
      warning: strength.feedback.warning,
      suggestions: strength.feedback.suggestions,
      crackTime: strength.crack_times_display.offline_slow_hashing_1e4_per_second
    }
  };
}

/**
 * Validate password for specific contexts (admin, gallery)
 * @param {string} password - Password to validate
 * @param {string} context - Context ('admin' or 'gallery')
 * @param {Object} userData - Additional user data for context-aware validation
 * @returns {Object} - Validation result
 */
function validatePasswordInContext(password, context, userData = {}) {
  // For gallery context, use more lenient validation
  if (context === 'gallery') {
    // Gallery-specific validation options
    const galleryOptions = {
      minLength: 6, // Reduced minimum length
      requireUppercase: false, // Don't require uppercase for galleries
      requireLowercase: false, // Don't require lowercase for galleries
      requireNumbers: false, // Numbers are optional
      requireSpecialChars: false, // Special chars are optional
      preventCommonPasswords: true, // Still prevent common passwords
      minStrengthScore: 0, // Accept any score for galleries
      skipStrengthCheck: true // Skip zxcvbn strength analysis for galleries
    };
    
    // Base validation with gallery-specific options
    const result = validatePassword(password, galleryOptions);
    
    // Override validation for common date formats
    // Allow passwords like "04.07.2025", "04/07/2025", "04-07-2025"
    const datePattern = /^\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}$/;
    if (datePattern.test(password)) {
      // Date format is valid for gallery passwords
      return {
        valid: true,
        errors: [],
        score: 2,
        feedback: {}
      };
    }
    
    // Additional gallery-specific checks
    if (password.length < 6) {
      result.valid = false;
      result.errors = ['Password must be at least 6 characters long'];
    }
    
    // Check if it's too simple (e.g., just "123456")
    if (/^\d{1,6}$/.test(password)) {
      result.valid = false;
      result.errors.push('Password cannot be just numbers. Consider using a date format like "04.07.2025"');
    }
    
    return result;
  }
  
  // Base validation for other contexts
  const result = validatePassword(password);
  
  // Context-specific validation
  if (context === 'admin') {
    // Admins need stronger passwords
    if (result.score < 4) {
      result.valid = false;
      result.errors.push('Admin passwords must be very strong (score 4/4)');
    }
    
    // Check password doesn't contain username
    if (userData.username && password.toLowerCase().includes(userData.username.toLowerCase())) {
      result.valid = false;
      result.errors.push('Password must not contain your username');
    }
    
    // Check password doesn't contain email
    if (userData.email) {
      const emailUser = userData.email.split('@')[0];
      if (password.toLowerCase().includes(emailUser.toLowerCase())) {
        result.valid = false;
        result.errors.push('Password must not contain parts of your email');
      }
    }
  }
  
  return result;
}

/**
 * Generate a secure random password
 * @param {Object} options - Generation options
 * @returns {string} - Generated password
 */
function generateSecurePassword(options = {}) {
  const config = {
    length: options.length || 16,
    includeUppercase: options.includeUppercase !== false,
    includeLowercase: options.includeLowercase !== false,
    includeNumbers: options.includeNumbers !== false,
    includeSpecialChars: options.includeSpecialChars !== false,
    excludeAmbiguous: options.excludeAmbiguous !== false
  };
  
  let charset = '';
  
  if (config.includeLowercase) {
    charset += config.excludeAmbiguous ? 'abcdefghjkmnpqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
  }
  
  if (config.includeUppercase) {
    charset += config.excludeAmbiguous ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  }
  
  if (config.includeNumbers) {
    charset += config.excludeAmbiguous ? '23456789' : '0123456789';
  }
  
  if (config.includeSpecialChars) {
    charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  }
  
  if (charset.length === 0) {
    throw new Error('At least one character type must be included');
  }
  
  // Generate password
  const crypto = require('crypto');
  let password = '';
  
  for (let i = 0; i < config.length; i++) {
    const randomIndex = crypto.randomInt(charset.length);
    password += charset[randomIndex];
  }
  
  // Ensure password meets requirements
  const validation = validatePassword(password);
  if (!validation.valid) {
    // Recursively generate until we get a valid password
    return generateSecurePassword(options);
  }
  
  return password;
}

/**
 * Get bcrypt rounds configuration
 * @returns {number} - Number of bcrypt rounds to use
 */
function getBcryptRounds() {
  return PASSWORD_CONFIG.bcryptRounds;
}

/**
 * Log password validation failures for security monitoring
 * @param {string} context - Context of validation failure
 * @param {Array} errors - Validation errors
 * @param {Object} metadata - Additional metadata
 */
function logPasswordValidationFailure(context, errors, metadata = {}) {
  logger.warn('Password validation failed', {
    context,
    errorCount: errors.length,
    errors: errors.slice(0, 3), // Log first 3 errors only
    ...metadata
  });
}

module.exports = {
  validatePassword,
  validatePasswordInContext,
  generateSecurePassword,
  getBcryptRounds,
  logPasswordValidationFailure,
  PASSWORD_CONFIG
};