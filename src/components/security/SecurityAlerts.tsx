import React from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SecurityEvent {
  id: string;
  type: 'success' | 'warning' | 'error';
  title: string;
  description: string;
  timestamp: Date;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

interface SecurityAlertsProps {
  events: SecurityEvent[];
  maxDisplay?: number;
}

export const SecurityAlerts: React.FC<SecurityAlertsProps> = ({ 
  events, 
  maxDisplay = 5 
}) => {
  const getIcon = (type: SecurityEvent['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
      case 'error':
        return <Shield className="h-4 w-4 text-red-600" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const getSeverityBadge = (severity?: SecurityEvent['severity']) => {
    if (!severity) return null;

    const variants = {
      low: 'secondary',
      medium: 'default',
      high: 'destructive',
      critical: 'destructive'
    } as const;

    return (
      <Badge variant={variants[severity]} className="ml-2">
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const getAlertVariant = (type: SecurityEvent['type']) => {
    switch (type) {
      case 'error':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const recentEvents = events.slice(0, maxDisplay);

  if (recentEvents.length === 0) {
    return (
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Security Status</AlertTitle>
        <AlertDescription>
          No recent security events to display.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Security Alerts</h3>
      </div>
      
      {recentEvents.map((event) => (
        <Alert key={event.id} variant={getAlertVariant(event.type)}>
          {getIcon(event.type)}
          <AlertTitle className="flex items-center">
            {event.title}
            {getSeverityBadge(event.severity)}
          </AlertTitle>
          <AlertDescription className="mt-2">
            <div>{event.description}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {event.timestamp.toLocaleString()}
            </div>
          </AlertDescription>
        </Alert>
      ))}
      
      {events.length > maxDisplay && (
        <div className="text-sm text-muted-foreground text-center">
          Showing {maxDisplay} of {events.length} recent events
        </div>
      )}
    </div>
  );
};