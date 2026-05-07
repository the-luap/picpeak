const { URL } = require('url');
const net = require('net');

/**
 * Check if a hostname or IP resolves to a private/internal network address.
 * Blocks SSRF attempts targeting internal infrastructure.
 */
function isPrivateIP(hostname) {
  if (!hostname || typeof hostname !== 'string') return true;

  const lower = hostname.toLowerCase().trim();

  // Block known metadata / loopback hostnames
  const blockedHostnames = [
    'localhost',
    'metadata.google.internal',
    'metadata.google',
    '169.254.169.254',
    '0.0.0.0',
    '::1',
    '[::1]',
  ];
  if (blockedHostnames.includes(lower)) return true;

  // If it's an IP address, check ranges directly
  if (net.isIPv4(lower)) {
    return isPrivateIPv4(lower);
  }

  // IPv6 checks
  if (net.isIPv6(lower) || lower.startsWith('[')) {
    const cleanIp = lower.replace(/^\[|\]$/g, '');
    return isPrivateIPv6(cleanIp);
  }

  // Hostname patterns that resolve to internal services
  if (lower.endsWith('.internal') || lower.endsWith('.local') || lower.endsWith('.localhost')) {
    return true;
  }

  return false;
}

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p))) return true;

  const [a, b] = parts;

  // 127.0.0.0/8 — loopback
  if (a === 127) return true;
  // 10.0.0.0/8 — private
  if (a === 10) return true;
  // 172.16.0.0/12 — private
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 — private
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 — link-local
  if (a === 169 && b === 254) return true;
  // 0.0.0.0/8
  if (a === 0) return true;

  return false;
}

function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  // ::1 loopback
  if (lower === '::1' || lower === '0000:0000:0000:0000:0000:0000:0000:0001') return true;
  // fc00::/7 — unique local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  // fe80::/10 — link-local
  if (lower.startsWith('fe80')) return true;
  // :: unspecified
  if (lower === '::') return true;

  return false;
}

/**
 * Validate a URL string, rejecting private/internal targets.
 * @param {string} urlString - URL to validate
 * @returns {{ valid: boolean, error?: string }}
 */
function validateExternalUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (isPrivateIP(parsed.hostname)) {
      return { valid: false, error: 'URL points to a private or internal network address' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

module.exports = { isPrivateIP, validateExternalUrl };
