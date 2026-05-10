import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface HealthCheckResult {
  status: 'checking' | 'healthy' | 'degraded' | 'failed';
  issues: string[];
  lastChecked: Date | null;
}

interface HealthCheckDetails {
  database: boolean;
  rpcAvailability: boolean;
  authConnection: boolean;
}

export function useStartupHealthCheck() {
  const [healthStatus, setHealthStatus] = useState<HealthCheckResult>({
    status: 'checking',
    issues: [],
    lastChecked: null
  });

  useEffect(() => {
    performHealthCheck();
  }, []);

  const performHealthCheck = async () => {
    const issues: string[] = [];
    const checks: HealthCheckDetails = {
      database: false,
      rpcAvailability: false,
      authConnection: false
    };

    try {
      // Check 1: Basic database connectivity
      try {
        const { error: dbError } = await supabase
          .from('profiles')
          .select('id')
          .limit(1);
        
        if (!dbError) {
          checks.database = true;
        } else {
          issues.push('Database connection failed');
        }
      } catch (err) {
        issues.push('Database connectivity error');
      }

      // Check 2: Critical RPC availability
      try {
        const { error: rpcError } = await supabase
          .rpc('get_landlord_dashboard_data')
          .maybeSingle();
        
        // Even if no data, the RPC should be callable
        if (!rpcError || rpcError.code !== '42883') { // 42883 = function does not exist
          checks.rpcAvailability = true;
        } else {
          issues.push('Critical database functions are not available');
        }
      } catch (err) {
        issues.push('RPC functions may be unavailable');
      }

      // Check 3: Auth service connection
      try {
        const { data: { session }, error: authError } = await supabase.auth.getSession();
        if (!authError) {
          checks.authConnection = true;
        } else {
          issues.push('Authentication service connection issue');
        }
      } catch (err) {
        issues.push('Auth service connectivity error');
      }

      // Determine overall health status
      const healthyChecks = Object.values(checks).filter(Boolean).length;
      const totalChecks = Object.keys(checks).length;

      let status: HealthCheckResult['status'];
      if (healthyChecks === totalChecks) {
        status = 'healthy';
      } else if (healthyChecks > 0) {
        status = 'degraded';
      } else {
        status = 'failed';
      }

      setHealthStatus({
        status,
        issues,
        lastChecked: new Date()
      });

    } catch (error) {
      console.error('Health check failed:', error);
      setHealthStatus({
        status: 'failed',
        issues: ['Health check system error'],
        lastChecked: new Date()
      });
    }
  };

  return {
    healthStatus,
    recheckHealth: performHealthCheck
  };
}