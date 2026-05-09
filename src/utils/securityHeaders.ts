/**
 * Security headers utility for enhanced application security
 * Implements CSP, HSTS, and other security headers
 */

export interface SecurityHeaders {
  'Content-Security-Policy': string;
  'Strict-Transport-Security': string;
  'X-Content-Type-Options': string;
  'X-Frame-Options': string;
  'X-XSS-Protection': string;
  'Referrer-Policy': string;
  'Permissions-Policy': string;
}

/**
 * Generate Content Security Policy for the application
 */
export const generateCSP = (): string => {
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com", // Keeping unsafe-inline for compatibility
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://kdpqimetajnhcqseajok.supabase.co wss://kdpqimetajnhcqseajok.supabase.co https://*.supabase.co",
    "frame-ancestors 'self'", // Changed from 'none' to allow Lovable iframe
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
    "media-src 'self' data: blob:",
    "object-src 'none'",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests"
  ];
  
  return cspDirectives.join('; ');
};

/**
 * Get all security headers for the application
 */
export const getSecurityHeaders = (): SecurityHeaders => {
  return {
    'Content-Security-Policy': generateCSP(),
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()'
  };
};

/**
 * Apply security headers to a response in edge functions
 */
export const applySecurityHeaders = (response: Response): Response => {
  const headers = new Headers(response.headers);
  const securityHeaders = getSecurityHeaders();
  
  Object.entries(securityHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};

/**
 * Security configuration for production environments
 */
export const SECURITY_CONFIG = {
  // Rate limiting
  maxRequestsPerMinute: 60,
  maxLoginAttemptsPerHour: 5,
  
  // Session management
  sessionTimeoutMinutes: 30,
  maxConcurrentSessions: 3,
  
  // Password requirements
  minPasswordLength: 12,
  requireSpecialCharacters: true,
  requireNumbers: true,
  requireUppercase: true,
  
  // API security
  requireApiKeyForPublicEndpoints: true,
  enableCORS: true,
  allowedOrigins: ['https://kdpqimetajnhcqseajok.supabase.co'],
  
  // Audit logging
  logSecurityEvents: true,
  logFailedLogins: true,
  logDataAccess: true
} as const;