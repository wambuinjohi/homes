/**
 * Security headers middleware for the application
 * Applies comprehensive security headers to enhance application security
 */

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: boolean;
  hsts?: boolean;
  frameOptions?: boolean;
  contentTypeOptions?: boolean;
  referrerPolicy?: boolean;
  permissionsPolicy?: boolean;
}

const defaultConfig: Required<SecurityHeadersConfig> = {
  contentSecurityPolicy: true,
  hsts: true,
  frameOptions: true,
  contentTypeOptions: true,
  referrerPolicy: true,
  permissionsPolicy: true,
};

/**
 * Generate Content Security Policy header value
 */
function generateCSP(): string {
  const isDev = import.meta.env.DEV;
  
  const policies = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://kdpqimetajnhcqseajok.supabase.co",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://kdpqimetajnhcqseajok.supabase.co wss://kdpqimetajnhcqseajok.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  
  // Add localhost for development
  if (isDev) {
    policies.push("connect-src 'self' https://kdpqimetajnhcqseajok.supabase.co wss://kdpqimetajnhcqseajok.supabase.co http://localhost:* ws://localhost:*");
  }
  
  return policies.join('; ');
}

/**
 * Security headers configuration
 */
export const securityHeaders = (config: SecurityHeadersConfig = {}): Record<string, string> => {
  const finalConfig = { ...defaultConfig, ...config };
  const headers: Record<string, string> = {};
  
  if (finalConfig.contentSecurityPolicy) {
    headers['Content-Security-Policy'] = generateCSP();
  }
  
  if (finalConfig.hsts) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }
  
  if (finalConfig.frameOptions) {
    headers['X-Frame-Options'] = 'DENY';
  }
  
  if (finalConfig.contentTypeOptions) {
    headers['X-Content-Type-Options'] = 'nosniff';
  }
  
  if (finalConfig.referrerPolicy) {
    headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';
  }
  
  if (finalConfig.permissionsPolicy) {
    headers['Permissions-Policy'] = [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'interest-cohort=()',
      'payment=()',
    ].join(', ');
  }
  
  // Additional security headers
  headers['X-XSS-Protection'] = '1; mode=block';
  headers['X-DNS-Prefetch-Control'] = 'off';
  headers['X-Download-Options'] = 'noopen';
  headers['X-Permitted-Cross-Domain-Policies'] = 'none';
  
  return headers;
};

/**
 * Apply security headers to a Response object
 */
export const applySecurityHeaders = (response: Response, config?: SecurityHeadersConfig): Response => {
  const headers = securityHeaders(config);
  const newHeaders = new Headers(response.headers);
  
  Object.entries(headers).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
};

/**
 * Meta tags for security headers (useful for HTML head)
 */
export const securityMetaTags = () => [
  { httpEquiv: 'Content-Security-Policy', content: generateCSP() },
  { httpEquiv: 'X-Content-Type-Options', content: 'nosniff' },
  { httpEquiv: 'X-Frame-Options', content: 'DENY' },
  { httpEquiv: 'X-XSS-Protection', content: '1; mode=block' },
  { httpEquiv: 'Referrer-Policy', content: 'strict-origin-when-cross-origin' },
];