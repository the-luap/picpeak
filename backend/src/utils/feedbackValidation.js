const { body, param, validationResult } = require('express-validator');
const validator = require('validator');

/**
 * Validation rules for feedback submission
 */
const feedbackValidationRules = {
  rating: [
    body('feedback_type').equals('rating'),
    body('rating')
      .isInt({ min: 1, max: 5 })
      .withMessage('Rating must be between 1 and 5'),
    body('guest_name')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Name must be less than 100 characters'),
    body('guest_email')
      .optional()
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email address')
  ],
  
  like: [
    body('feedback_type').equals('like'),
    body('guest_name')
      .optional()
      .trim()
      .isLength({ max: 100 }),
    body('guest_email')
      .optional()
      .trim()
      .isEmail()
      .normalizeEmail()
  ],
  
  favorite: [
    body('feedback_type').equals('favorite'),
    body('guest_name')
      .optional()
      .trim()
      .isLength({ max: 100 }),
    body('guest_email')
      .optional()
      .trim()
      .isEmail()
      .normalizeEmail()
  ],
  
  comment: [
    body('feedback_type').equals('comment'),
    body('comment_text')
      .trim()
      .notEmpty()
      .withMessage('Comment cannot be empty')
      .isLength({ min: 1, max: 1000 })
      .withMessage('Comment must be between 1 and 1000 characters')
      .customSanitizer(value => sanitizeComment(value)),
    body('guest_name')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Name must be less than 100 characters'),
    body('guest_email')
      .optional()
      .trim()
      .isEmail()
      .normalizeEmail()
      .withMessage('Invalid email address')
  ]
};

/**
 * Sanitize comment text
 */
function sanitizeComment(text) {
  if (!text) return '';
  
  // Remove excessive whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  // Remove zero-width characters
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  // Remove control characters
  text = text.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Limit consecutive special characters
  text = text.replace(/([!?.]){4,}/g, '$1$1$1');
  
  // Remove script tags and other dangerous HTML (basic sanitization)
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
  text = text.replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '');
  text = text.replace(/<embed[^>]*>/gi, '');
  
  return text;
}

/**
 * Validate feedback type parameter
 */
const validateFeedbackType = param('feedbackType')
  .isIn(['rating', 'like', 'comment', 'favorite'])
  .withMessage('Invalid feedback type');

/**
 * Validate photo ID parameter
 */
const validatePhotoId = param('photoId')
  .isInt({ min: 1 })
  .withMessage('Invalid photo ID');

/**
 * Validate event ID parameter
 */
const validateEventId = param('eventId')
  .isInt({ min: 1 })
  .withMessage('Invalid event ID');

/**
 * Get validation rules based on feedback type
 */
function getValidationRules(feedbackType) {
  return feedbackValidationRules[feedbackType] || [];
}

/**
 * Validation middleware for feedback submission
 */
const validateFeedbackSubmission = [
  body('feedback_type')
    .isIn(['rating', 'like', 'comment', 'favorite'])
    .withMessage('Invalid feedback type'),
  
  // Conditional validation based on feedback type
  body('rating')
    .if(body('feedback_type').equals('rating'))
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  
  body('comment_text')
    .if(body('feedback_type').equals('comment'))
    .trim()
    .notEmpty()
    .withMessage('Comment cannot be empty')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment must be between 1 and 1000 characters')
    .customSanitizer(value => sanitizeComment(value)),
  
  body('guest_name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Name must be less than 100 characters')
    .matches(/^[a-zA-Z0-9\s\-'.]+$/)
    .withMessage('Name contains invalid characters'),
  
  body('guest_email')
    .optional()
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email address')
];

/**
 * Validation for feedback settings
 */
const validateFeedbackSettings = [
  body('feedback_enabled').optional().isBoolean(),
  body('allow_ratings').optional().isBoolean(),
  body('allow_likes').optional().isBoolean(),
  body('allow_comments').optional().isBoolean(),
  body('allow_favorites').optional().isBoolean(),
  body('require_name_email').optional().isBoolean(),
  body('moderate_comments').optional().isBoolean(),
  body('show_feedback_to_guests').optional().isBoolean()
];

/**
 * Validation for word filters
 */
const validateWordFilter = [
  body('word')
    .trim()
    .notEmpty()
    .withMessage('Word cannot be empty')
    .isLength({ min: 2, max: 100 })
    .withMessage('Word must be between 2 and 100 characters'),
  body('severity')
    .optional()
    .isIn(['mild', 'moderate', 'severe'])
    .withMessage('Invalid severity level')
];

/**
 * Check validation results middleware
 */
const checkValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

/**
 * Validate guest identity requirements
 */
async function validateGuestRequirements(settings, guestData) {
  if (!settings.require_name_email) {
    return { valid: true };
  }
  
  const errors = [];
  
  if (!guestData.guest_name || guestData.guest_name.trim().length === 0) {
    errors.push('Name is required');
  }
  
  if (!guestData.guest_email || !validator.isEmail(guestData.guest_email)) {
    errors.push('Valid email is required');
  }
  
  if (errors.length > 0) {
    return {
      valid: false,
      errors
    };
  }
  
  return { valid: true };
}

module.exports = {
  feedbackValidationRules,
  validateFeedbackType,
  validatePhotoId,
  validateEventId,
  validateFeedbackSubmission,
  validateFeedbackSettings,
  validateWordFilter,
  checkValidation,
  getValidationRules,
  sanitizeComment,
  validateGuestRequirements
};