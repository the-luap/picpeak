/**
 * Sanitize a string to be used as a filename component
 * @param {string} str - The string to sanitize
 * @param {number} maxLength - Maximum length of the sanitized string
 * @returns {string} - Sanitized string
 */
function sanitizeFilename(str, maxLength = 50) {
  if (!str) return 'unnamed';
  
  // Convert to string and trim
  let sanitized = String(str).trim();
  
  // Replace spaces with underscores
  sanitized = sanitized.replace(/\s+/g, '_');
  
  // Remove special characters except hyphens, underscores, and dots
  sanitized = sanitized.replace(/[^a-zA-Z0-9_\-\.]/g, '');
  
  // Remove multiple consecutive underscores or hyphens
  sanitized = sanitized.replace(/[_\-]{2,}/g, '_');
  
  // Remove leading/trailing underscores or hyphens
  sanitized = sanitized.replace(/^[_\-]+|[_\-]+$/g, '');
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  // If empty after sanitization, use default
  if (!sanitized) {
    sanitized = 'unnamed';
  }
  
  return sanitized;
}

/**
 * Generate a photo filename based on event name, category, and counter
 * @param {string} eventName - The event name
 * @param {string} categoryName - The category name
 * @param {number} counter - The photo counter
 * @param {string} extension - The file extension (including dot)
 * @returns {string} - Generated filename
 */
function generatePhotoFilename(eventName, categoryName, counter, extension) {
  const sanitizedEvent = sanitizeFilename(eventName, 30);
  const sanitizedCategory = sanitizeFilename(categoryName || 'uncategorized', 20);
  const paddedCounter = String(counter).padStart(4, '0');
  
  return `${sanitizedEvent}_${sanitizedCategory}_${paddedCounter}${extension}`;
}

module.exports = {
  sanitizeFilename,
  generatePhotoFilename
};