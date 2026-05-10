import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface SecurityEvent {
  type: 'suspicious_activity' | 'failed_login' | 'data_access' | 'permission_escalation';
  details: Record<string, any>;
  timestamp: Date;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Security monitoring hook for detecting and logging security events
 */
export const useSecurityMonitoring = () => {
  const { user } = useAuth();

  // Log security events to Supabase
  const logSecurityEvent = useCallback(async (event: SecurityEvent) => {
    try {
      await supabase.functions.invoke('log-security-event', {
        body: {
          type: event.type,
          details: event.details,
          timestamp: event.timestamp.toISOString(),
          userId: event.userId,
          ipAddress: event.ipAddress || 'unknown',
          userAgent: event.userAgent || navigator.userAgent
        }
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }, []);

  // Monitor for suspicious patterns
  const detectSuspiciousActivity = useCallback((activity: any) => {
    // Check for rapid repeated requests
    if (activity.requestCount > 100 && activity.timeWindow < 60000) {
      logSecurityEvent({
        type: 'suspicious_activity',
        details: {
          pattern: 'rapid_requests',
          requestCount: activity.requestCount,
          timeWindow: activity.timeWindow
        },
        timestamp: new Date(),
        userId: user?.id
      });
    }

    // Check for unusual data access patterns
    if (activity.type === 'data_access' && activity.recordCount > 1000) {
      logSecurityEvent({
        type: 'data_access',
        details: {
          pattern: 'bulk_data_access',
          recordCount: activity.recordCount,
          tableName: activity.tableName
        },
        timestamp: new Date(),
        userId: user?.id
      });
    }
  }, [user, logSecurityEvent]);

  // Monitor failed authentication attempts
  const logFailedAuth = useCallback((reason: string, details?: Record<string, any>) => {
    logSecurityEvent({
      type: 'failed_login',
      details: {
        reason,
        ...details
      },
      timestamp: new Date(),
      userId: user?.id
    });
  }, [user, logSecurityEvent]);

  // Monitor permission escalation attempts
  const logPermissionEscalation = useCallback((attemptedAction: string, requiredRole: string) => {
    logSecurityEvent({
      type: 'permission_escalation',
      details: {
        attemptedAction,
        requiredRole,
        userRole: user?.user_metadata?.role || 'unknown'
      },
      timestamp: new Date(),
      userId: user?.id
    });
  }, [user, logSecurityEvent]);

  // Set up global error monitoring
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Log potential security-related errors
      if (event.reason?.message?.includes('permission') || 
          event.reason?.message?.includes('unauthorized') ||
          event.reason?.message?.includes('403') ||
          event.reason?.message?.includes('401')) {
        logSecurityEvent({
          type: 'suspicious_activity',
          details: {
            pattern: 'unhandled_auth_error',
            error: event.reason?.message || 'Unknown error',
            stack: event.reason?.stack
          },
          timestamp: new Date(),
          userId: user?.id
        });
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [user, logSecurityEvent]);

  // Rate limiting tracking
  const trackApiUsage = useCallback((endpoint: string, method: string) => {
    const key = `api_usage_${endpoint}_${method}`;
    const now = Date.now();
    const requests = JSON.parse(localStorage.getItem(key) || '[]');
    
    // Keep only requests from the last minute
    const recentRequests = requests.filter((timestamp: number) => now - timestamp < 60000);
    recentRequests.push(now);
    
    localStorage.setItem(key, JSON.stringify(recentRequests));
    
    // Check for rate limit violations
    if (recentRequests.length > 60) { // More than 60 requests per minute
      detectSuspiciousActivity({
        requestCount: recentRequests.length,
        timeWindow: 60000,
        endpoint,
        method
      });
    }
  }, [detectSuspiciousActivity]);

  return {
    logSecurityEvent,
    detectSuspiciousActivity,
    logFailedAuth,
    logPermissionEscalation,
    trackApiUsage
  };
};
