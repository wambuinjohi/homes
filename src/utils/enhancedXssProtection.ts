/**
 * Enhanced XSS Protection utilities with improved sanitization
 */
import DOMPurify from 'dompurify';

/**
 * Enhanced HTML sanitization with strict security controls
 */
export const sanitizeHtmlStrict = (html: string): string => {
  if (!html || typeof html !== 'string') return '';
  
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'div', 'span'
    ],
    ALLOWED_ATTR: ['class'],
    FORBID_ATTR: [
      'onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 
      'onfocus', 'onblur', 'onchange', 'onsubmit', 'href', 'src',
      'javascript:', 'vbscript:', 'data:', 'style'
    ],
    FORBID_TAGS: [
      'script', 'object', 'embed', 'form', 'input', 'textarea', 
      'select', 'iframe', 'frame', 'frameset', 'meta', 'link',
      'base', 'style', 'title', 'svg', 'math'
    ],
    USE_PROFILES: { html: false },
    SANITIZE_DOM: true,
    KEEP_CONTENT: false,
    FORCE_BODY: false,
    SAFE_FOR_TEMPLATES: true
  });
};

/**
 * Sanitize user input for database storage
 */
export const sanitizeForDatabase = (input: string): string => {
  return DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true
  });
};

/**
 * Enhanced CSP nonce generation
 */
export const generateCSPNonce = (): string => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, Array.from(array)));
};

/**
 * Validate and sanitize URLs to prevent XSS through href attributes
 */
export const sanitizeUrl = (url: string): string => {
  const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
  
  try {
    const parsedUrl = new URL(url);
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      return '#';
    }
    return parsedUrl.toString();
  } catch {
    return '#';
  }
};

/**
 * Enhanced content security policy headers
 */
export const getSecurityHeaders = () => ({
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://kdpqimetajnhcqseajok.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
});