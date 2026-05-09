import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, Shield, Activity, Users, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface SecurityEvent {
  id: string;
  action: string;
  entity_type: string;
  details: any; // Changed from Record<string, any> to any to handle Supabase Json type
  performed_at: string;
  ip_address?: string;
  user_agent?: string;
  user_id?: string;
}

interface SecurityMetrics {
  total_events: number;
  critical_events: number;
  failed_logins: number;
  suspicious_activity: number;
}

export const SecurityDashboard = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [metrics, setMetrics] = useState<SecurityMetrics>({
    total_events: 0,
    critical_events: 0,
    failed_logins: 0,
    suspicious_activity: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchSecurityData = async () => {
    try {
      setLoading(true);
      
      // Fetch recent security events
      const { data: activityLogs, error: logsError } = await supabase
        .from('user_activity_logs')
        .select('*')
        .or('entity_type.eq.security,action.ilike.%security%,action.ilike.%failed%,action.ilike.%suspicious%')
        .order('performed_at', { ascending: false })
        .limit(100);

      if (logsError) throw logsError;

      // Transform the data to match our interface
      const transformedEvents: SecurityEvent[] = (activityLogs || []).map(log => ({
        id: log.id,
        action: log.action,
        entity_type: log.entity_type || 'unknown',
        details: log.details,
        performed_at: log.performed_at,
        ip_address: log.ip_address ? String(log.ip_address) : undefined,
        user_agent: log.user_agent || undefined,
        user_id: log.user_id || undefined
      }));

      setEvents(transformedEvents);

      // Calculate metrics
      const logs = transformedEvents;
      const criticalEvents = logs.filter(log => 
        log.action?.includes('security') || 
        log.action?.includes('suspicious') ||
        (typeof log.details === 'object' && log.details !== null && (log.details as any)?.pattern === 'rapid_requests')
      );
      
      const failedLogins = logs.filter(log => 
        log.action?.includes('failed_login') ||
        log.action?.includes('security_event_failed_auth')
      );

      const suspiciousActivity = logs.filter(log =>
        log.action?.includes('suspicious') ||
        (typeof log.details === 'object' && log.details !== null && 
         ((log.details as any)?.pattern === 'rapid_requests' ||
          (log.details as any)?.pattern === 'bulk_data_access'))
      );

      setMetrics({
        total_events: logs.length,
        critical_events: criticalEvents.length,
        failed_logins: failedLogins.length,
        suspicious_activity: suspiciousActivity.length
      });

    } catch (error) {
      console.error('Error fetching security data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchSecurityData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getSeverityColor = (event: SecurityEvent) => {
    const details = typeof event.details === 'object' && event.details !== null ? event.details as any : {};
    if (event.action?.includes('suspicious') || details?.pattern === 'rapid_requests') {
      return 'destructive';
    }
    if (event.action?.includes('failed_login')) {
      return 'secondary';
    }
    return 'outline';
  };

  const getSeverityIcon = (event: SecurityEvent) => {
    if (event.action?.includes('suspicious')) {
      return <AlertTriangle className="h-4 w-4" />;
    }
    if (event.action?.includes('security')) {
      return <Shield className="h-4 w-4" />;
    }
    return <Activity className="h-4 w-4" />;
  };

  const formatEventTitle = (event: SecurityEvent) => {
    if (event.action?.includes('security_event_')) {
      return event.action.replace('security_event_', '').replace('_', ' ').toUpperCase();
    }
    return event.action?.replace('_', ' ').toUpperCase() || 'Unknown Event';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-8 bg-muted rounded mb-2"></div>
                <div className="h-6 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Security Monitoring</h1>
          <p className="text-muted-foreground">Monitor security events and threats in real-time</p>
        </div>
        <Button onClick={fetchSecurityData} variant="outline">
          <Activity className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Security Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Events</p>
                <p className="text-2xl font-bold">{metrics.total_events}</p>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical Events</p>
                <p className="text-2xl font-bold text-destructive">{metrics.critical_events}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed Logins</p>
                <p className="text-2xl font-bold text-secondary-foreground">{metrics.failed_logins}</p>
              </div>
              <Lock className="h-8 w-8 text-secondary-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Suspicious Activity</p>
                <p className="text-2xl font-bold text-destructive">{metrics.suspicious_activity}</p>
              </div>
              <Shield className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alerts */}
      {metrics.critical_events > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Security Alert</AlertTitle>
          <AlertDescription>
            {metrics.critical_events} critical security event(s) detected. Review immediately.
          </AlertDescription>
        </Alert>
      )}

      {/* Security Events */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Events</TabsTrigger>
          <TabsTrigger value="critical">Critical</TabsTrigger>
          <TabsTrigger value="failed-auth">Failed Auth</TabsTrigger>
          <TabsTrigger value="suspicious">Suspicious</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Security Events</CardTitle>
              <CardDescription>All security-related events in the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {events.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No security events found</p>
                ) : (
                  events.map((event) => (
                    <div key={event.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                      <div className="flex-shrink-0">
                        {getSeverityIcon(event)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">{formatEventTitle(event)}</h4>
                          <Badge variant={getSeverityColor(event) as any}>
                            {event.action?.includes('suspicious') ? 'Critical' : 
                             event.action?.includes('failed') ? 'Warning' : 'Info'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date(event.performed_at).toLocaleString()}
                        </p>
                        {event.details && typeof event.details === 'object' && Object.keys(event.details as object).length > 0 && (
                          <div className="mt-2">
                            <details className="text-xs">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                View Details
                              </summary>
                              <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                                {JSON.stringify(event.details, null, 2)}
                              </pre>
                            </details>
                          </div>
                        )}
                        {event.ip_address && (
                          <p className="text-xs text-muted-foreground mt-1">
                            IP: {event.ip_address}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="critical">
          <Card>
            <CardHeader>
              <CardTitle>Critical Security Events</CardTitle>
              <CardDescription>Events requiring immediate attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {events.filter(e => {
                  const details = typeof e.details === 'object' && e.details !== null ? e.details as any : {};
                  return e.action?.includes('suspicious') || 
                         details?.pattern === 'rapid_requests';
                }).map((event) => (
                  <div key={event.id} className="flex items-start space-x-3 p-3 border border-destructive rounded-lg bg-destructive/5">
                    <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-destructive">{formatEventTitle(event)}</h4>
                      <p className="text-sm text-muted-foreground">
                        {new Date(event.performed_at).toLocaleString()}
                      </p>
                      {event.details && (
                        <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                          {JSON.stringify(event.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="failed-auth">
          <Card>
            <CardHeader>
              <CardTitle>Failed Authentication Attempts</CardTitle>
              <CardDescription>Login failures and authentication issues</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {events.filter(e => 
                  e.action?.includes('failed_login') ||
                  e.action?.includes('security_event_failed_auth')
                ).map((event) => (
                  <div key={event.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                    <Lock className="h-5 w-5 text-secondary-foreground flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium">{formatEventTitle(event)}</h4>
                      <p className="text-sm text-muted-foreground">
                        {new Date(event.performed_at).toLocaleString()}
                      </p>
                      {event.ip_address && (
                        <p className="text-xs text-muted-foreground">IP: {event.ip_address}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suspicious">
          <Card>
            <CardHeader>
              <CardTitle>Suspicious Activity</CardTitle>
              <CardDescription>Potentially malicious behavior patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {events.filter(e => {
                  const details = typeof e.details === 'object' && e.details !== null ? e.details as any : {};
                  return e.action?.includes('suspicious') ||
                         details?.pattern === 'rapid_requests' ||
                         details?.pattern === 'bulk_data_access';
                }).map((event) => (
                  <div key={event.id} className="flex items-start space-x-3 p-3 border border-destructive rounded-lg bg-destructive/5">
                    <Shield className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-destructive">{formatEventTitle(event)}</h4>
                      <p className="text-sm text-muted-foreground">
                        {new Date(event.performed_at).toLocaleString()}
                      </p>
                      {(() => {
                        const details = typeof event.details === 'object' && event.details !== null ? event.details as any : {};
                        return details?.pattern && (
                          <Badge variant="destructive" className="mt-2">
                            Pattern: {details.pattern}
                          </Badge>
                        );
                      })()}
                      {event.details && (
                        <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                          {JSON.stringify(event.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};