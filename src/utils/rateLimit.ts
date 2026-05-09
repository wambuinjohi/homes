/**
 * Rate limiting utilities for API calls
 */

interface RateLimitResponse {
  allowed: boolean;
  remaining: number;
  reset_time: string;
}

/**
 * Check rate limit for API calls
 */
export const checkRateLimit = async (
  identifier: string, 
  endpoint: string,
  maxRequests: number = 60,
  windowMinutes: number = 1
): Promise<RateLimitResponse> => {
  try {
    const response = await fetch('/api/rate-limit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        identifier,
        endpoint,
        max_requests: maxRequests,
        window_minutes: windowMinutes
      })
    });

    if (!response.ok) {
      throw new Error(`Rate limit check failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow the request if rate limiting is down
    return {
      allowed: true,
      remaining: maxRequests,
      reset_time: new Date(Date.now() + windowMinutes * 60 * 1000).toISOString()
    };
  }
};

/**
 * Client-side rate limiting using localStorage
 */
export const clientRateLimit = (
  key: string,
  maxRequests: number = 10,
  windowMs: number = 60000
): boolean => {
  try {
    const now = Date.now();
    const windowKey = `rate_${key}_${Math.floor(now / windowMs)}`;
    
    const currentCount = parseInt(localStorage.getItem(windowKey) || '0');
    
    if (currentCount >= maxRequests) {
      return false; // Rate limit exceeded
    }
    
    localStorage.setItem(windowKey, (currentCount + 1).toString());
    
    // Clean up old entries (keep only current and previous window)
    const prevWindowKey = `rate_${key}_${Math.floor((now - windowMs) / windowMs)}`;
    Object.keys(localStorage).forEach(storageKey => {
      if (storageKey.startsWith(`rate_${key}_`) && 
          storageKey !== windowKey && 
          storageKey !== prevWindowKey) {
        localStorage.removeItem(storageKey);
      }
    });
    
    return true; // Request allowed
  } catch (error) {
    console.error('Client rate limiting failed:', error);
    return true; // Fail open
  }
};
