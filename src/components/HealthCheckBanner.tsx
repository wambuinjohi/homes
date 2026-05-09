import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { useStartupHealthCheck } from '@/hooks/useStartupHealthCheck';

export function HealthCheckBanner() {
  const { healthStatus, recheckHealth } = useStartupHealthCheck();

  // Don't show banner if everything is healthy
  if (healthStatus.status === 'healthy') {
    return null;
  }

  // Don't show banner while initial check is running
  if (healthStatus.status === 'checking' && !healthStatus.lastChecked) {
    return null;
  }

  const getIcon = () => {
    switch (healthStatus.status) {
      case 'checking':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getVariant = () => {
    switch (healthStatus.status) {
      case 'degraded':
        return 'default';
      case 'failed':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const getTitle = () => {
    switch (healthStatus.status) {
      case 'checking':
        return 'System Check in Progress';
      case 'degraded':
        return 'System Performance Degraded';
      case 'failed':
        return 'System Issues Detected';
      default:
        return 'System Status';
    }
  };

  return (
    <Alert variant={getVariant()} className="mb-4">
      {getIcon()}
      <AlertTitle>{getTitle()}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <div>
          {healthStatus.status === 'checking' && 'Running system diagnostics...'}
          {healthStatus.status === 'degraded' && 'Some features may be unavailable or slower than expected.'}
          {healthStatus.status === 'failed' && 'Critical system components are unavailable. Please contact support if issues persist.'}
        </div>
        
        {healthStatus.issues.length > 0 && (
          <div className="mt-2">
            <strong>Issues detected:</strong>
            <ul className="list-disc list-inside mt-1 text-sm">
              {healthStatus.issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between mt-3">
          <div className="text-xs text-muted-foreground">
            {healthStatus.lastChecked && 
              `Last checked: ${healthStatus.lastChecked.toLocaleTimeString()}`
            }
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={recheckHealth}
            disabled={healthStatus.status === 'checking'}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${healthStatus.status === 'checking' ? 'animate-spin' : ''}`} />
            Recheck
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}