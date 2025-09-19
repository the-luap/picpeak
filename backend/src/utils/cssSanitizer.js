function sanitizeCss(css) {
  if (!css || typeof css !== 'string') {
    return '';
  }

  let sanitized = css;

  const disallowedPatterns = [
    /@import[^;]+;?/gi,
    /@charset[^;]+;?/gi,
    /expression\s*\([^)]*\)/gi,
    /url\s*\(\s*(['"])\s*javascript:[^)]*\)/gi,
    /url\s*\(\s*(['"])\s*data:text\/javascript[^)]*\)/gi
  ];

  disallowedPatterns.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '');
  });

  sanitized = sanitized.replace(/[\u0000-\u001F\u007F]/g, '');

  const MAX_LENGTH = 100 * 1024;
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.slice(0, MAX_LENGTH);
  }

  return sanitized.trim();
}

module.exports = {
  sanitizeCss,
};
