import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Shield, AlertTriangle, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SecurityEvent {
  id: string;
  event_type: string;
  severity: string;
  details: Record<string, any>;
  created_at: string;
  ip_address?: string;
  user_agent?: string;
  user_id?: string;
}

export const SecurityAlert = () => {
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSecurityEvents = async () => {
      try {
        const { data, error } = await supabase
          .from('security_events')
          .select('*')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
          .order('created_at', { ascending: false })
          .limit(5);

        if (!error && data) {
          setSecurityEvents(data.map(event => ({
            id: event.id,
            event_type: event.event_type,
            severity: event.severity,
            details: typeof event.details === 'object' && event.details !== null ? event.details as Record<string, any> : {},
            created_at: event.created_at,
            ip_address: typeof event.ip_address === 'string' ? event.ip_address : undefined,
            user_agent: typeof event.user_agent === 'string' ? event.user_agent : undefined,
            user_id: typeof event.user_id === 'string' ? event.user_id : undefined
          })));
        }
      } catch (error) {
        console.error('Error fetching security events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSecurityEvents();

    // Set up real-time subscription for security events
    const channel = supabase
      .channel('security_events')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'security_events' },
        (payload) => {
          const newEvent = payload.new as SecurityEvent;
          setSecurityEvents(prev => [newEvent, ...prev].slice(0, 5));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <Shield className="h-4 w-4 text-yellow-500" />;
      default:
        return <Lock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500 bg-red-50';
      case 'high':
        return 'border-orange-500 bg-orange-50';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50';
      default:
        return 'border-blue-500 bg-blue-50';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">Loading security status...</div>
        </CardContent>
      </Card>
    );
  }

  const criticalEvents = securityEvents.filter(event => event.severity === 'critical');
  const highEvents = securityEvents.filter(event => event.severity === 'high');

  if (criticalEvents.length === 0 && highEvents.length === 0) {
    return (
      <Alert className="border-green-500 bg-green-50">
        <Shield className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">Security Status: Good</AlertTitle>
        <AlertDescription className="text-green-700">
          No critical security events detected in the last 24 hours.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {securityEvents.map((event) => (
            <Alert 
              key={event.id} 
              className={getSeverityColor(event.severity)}
            >
              {getSeverityIcon(event.severity)}
              <AlertTitle className="capitalize">
                {event.severity} Security Event
              </AlertTitle>
              <AlertDescription>
                <div className="space-y-1">
                  <p><strong>Type:</strong> {event.event_type}</p>
                  <p><strong>Time:</strong> {new Date(event.created_at).toLocaleString()}</p>
                  {event.details?.ip && (
                    <p><strong>IP:</strong> {event.details.ip}</p>
                  )}
                  {event.details?.pattern && (
                    <p><strong>Pattern:</strong> {event.details.pattern}</p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};