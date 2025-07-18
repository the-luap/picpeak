/**
 * Formatters for email content and other text transformations
 */

/**
 * Convert plain text line breaks to HTML line breaks
 * @param {string} text - The text to format
 * @returns {string} - Text with HTML line breaks
 */
function nl2br(text) {
  if (!text) return '';
  
  // Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Convert newlines to <br> tags
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('<br />');
}

/**
 * Format welcome message for email templates
 * @param {string} message - The welcome message
 * @returns {string} - Formatted message for HTML emails
 */
function formatWelcomeMessage(message) {
  if (!message || message.trim() === '') {
    return '';
  }
  
  return nl2br(message);
}

module.exports = {
  nl2br,
  formatWelcomeMessage
};