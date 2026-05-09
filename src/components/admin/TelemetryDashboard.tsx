
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TablePaginator } from '@/components/ui/table-paginator';
import { useUrlPageParam } from '@/hooks/useUrlPageParam';
import { formatDistanceToNow } from 'date-fns';
import { Activity, AlertTriangle, TrendingUp, Users, Server, Clock, AlertCircle } from 'lucide-react';

interface TelemetryData {
  heartbeats: any[];
  events: any[];
  errors: any[];
  instances: any[];
  heartbeatsTotal?: number;
  eventsTotal?: number;
  errorsTotal?: number;
}

export function TelemetryDashboard() {
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  
  // Pagination states for each tab
  const { page: hbPage, pageSize: hbPageSize, offset: hbOffset, setPage: setHbPage, setPageSize: setHbPageSize } = useUrlPageParam({ defaultPage: 1, pageSize: 25 });
  const { page: evPage, pageSize: evPageSize, offset: evOffset, setPage: setEvPage, setPageSize: setEvPageSize } = useUrlPageParam({ defaultPage: 1, pageSize: 25 });
  const { page: erPage, pageSize: erPageSize, offset: erOffset, setPage: setErPage, setPageSize: setErPageSize } = useUrlPageParam({ defaultPage: 1, pageSize: 25 });

  const { data: telemetryData, isLoading } = useQuery({
    queryKey: ['telemetry-dashboard', timeRange, selectedInstance, hbPage, hbPageSize, evPage, evPageSize, erPage, erPageSize],
    queryFn: async () => {
      const now = new Date();
      const startDate = new Date();
      
      switch (timeRange) {
        case '1d':
          startDate.setDate(now.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        default:
          startDate.setDate(now.getDate() - 7);
      }

      // Fetch instances
      let instancesQuery = supabase
        .from('self_hosted_instances')
        .select('*');
      
      if (selectedInstance) {
        instancesQuery = instancesQuery.eq('id', selectedInstance);
      }

      const { data: instances, error: instancesError } = await instancesQuery;
      if (instancesError) throw instancesError;

      const instanceIds = instances?.map(i => i.id) || [];

      // Fetch heartbeats with pagination
      const { data: heartbeats, error: heartbeatsError, count: heartbeatsCount } = await supabase
        .from('telemetry_heartbeats')
        .select(`
          *,
          self_hosted_instances!inner(name, domain)
        `, { count: 'exact' })
        .gte('reported_at', startDate.toISOString())
        .in('instance_id', instanceIds)
        .order('reported_at', { ascending: false })
        .range(hbOffset, hbOffset + hbPageSize - 1);

      if (heartbeatsError) throw heartbeatsError;

      // Fetch events with pagination
      const { data: events, error: eventsError, count: eventsCount } = await supabase
        .from('telemetry_events')
        .select(`
          *,
          self_hosted_instances!inner(name, domain)
        `, { count: 'exact' })
        .gte('occurred_at', startDate.toISOString())
        .in('instance_id', instanceIds)
        .order('occurred_at', { ascending: false })
        .range(evOffset, evOffset + evPageSize - 1);

      if (eventsError) throw eventsError;

      // Fetch errors with pagination
      const { data: errors, error: errorsError, count: errorsCount } = await supabase
        .from('telemetry_errors')
        .select(`
          *,
          self_hosted_instances!inner(name, domain)
        `, { count: 'exact' })
        .gte('created_at', startDate.toISOString())
        .in('instance_id', instanceIds)
        .order('created_at', { ascending: false })
        .range(erOffset, erOffset + erPageSize - 1);

      if (errorsError) throw errorsError;

      return {
        instances: instances || [],
        heartbeats: heartbeats || [],
        events: events || [],
        errors: errors || [],
        heartbeatsTotal: heartbeatsCount || 0,
        eventsTotal: eventsCount || 0,
        errorsTotal: errorsCount || 0,
      } as TelemetryData;
    }
  });

  const getInstanceStats = () => {
    if (!telemetryData) return { total: 0, active: 0, offline: 0 };
    
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    
    const total = telemetryData.instances.length;
    const active = telemetryData.instances.filter(instance => 
      instance.last_seen_at && new Date(instance.last_seen_at) > fifteenMinutesAgo
    ).length;
    const offline = total - active;
    
    return { total, active, offline };
  };

  const getErrorStats = () => {
    if (!telemetryData) return { total: 0, critical: 0, errors: 0 };
    
    const total = telemetryData.errors.length;
    const critical = telemetryData.errors.filter(e => e.severity === 'critical').length;
    const errors = telemetryData.errors.filter(e => e.severity === 'error').length;
    
    return { total, critical, errors };
  };

  const instanceStats = getInstanceStats();
  const errorStats = getErrorStats();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                  <div className="h-8 bg-muted rounded w-1/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1d">Last 24 hours</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={selectedInstance || 'all'} onValueChange={(v) => setSelectedInstance(v === 'all' ? null : v)}>
          <SelectTrigger className="w-60">
            <SelectValue placeholder="All instances" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All instances</SelectItem>
            {telemetryData?.instances.map((instance) => (
              <SelectItem key={instance.id} value={instance.id}>
                {instance.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Instances</p>
                <p className="text-2xl font-bold">{instanceStats.total}</p>
              </div>
              <Server className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Instances</p>
                <p className="text-2xl font-bold text-green-600">{instanceStats.active}</p>
              </div>
              <Activity className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Offline Instances</p>
                <p className="text-2xl font-bold text-red-600">{instanceStats.offline}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Recent Errors</p>
                <p className="text-2xl font-bold text-yellow-600">{errorStats.total}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="heartbeats" className="space-y-4">
        <TabsList>
          <TabsTrigger value="heartbeats">Heartbeats</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
        </TabsList>

        <TabsContent value="heartbeats">
          <Card>
            <CardHeader>
              <CardTitle>Recent Heartbeats</CardTitle>
              <CardDescription>Latest health reports from self-hosted instances</CardDescription>
            </CardHeader>
            <CardContent>
              {telemetryData?.heartbeats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No heartbeats found for the selected time range
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Instance</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Environment</TableHead>
                        <TableHead>Online Users</TableHead>
                        <TableHead>Reported</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {telemetryData?.heartbeats.map((heartbeat) => (
                        <TableRow key={heartbeat.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{heartbeat.self_hosted_instances.name}</p>
                              {heartbeat.self_hosted_instances.domain && (
                                <p className="text-xs text-muted-foreground">
                                  {heartbeat.self_hosted_instances.domain}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{heartbeat.app_version || 'Unknown'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{heartbeat.environment || 'Unknown'}</Badge>
                          </TableCell>
                          <TableCell>{heartbeat.online_users || 0}</TableCell>
                          <TableCell className="text-sm">
                            {formatDistanceToNow(new Date(heartbeat.reported_at), { addSuffix: true })}
                          </TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                   
                   <div className="mt-4">
                     <TablePaginator
                       currentPage={hbPage}
                       totalPages={Math.ceil((telemetryData?.heartbeatsTotal || 0) / hbPageSize)}
                       pageSize={hbPageSize}
                       totalItems={telemetryData?.heartbeatsTotal || 0}
                       onPageChange={setHbPage}
                       onPageSizeChange={setHbPageSize}
                       showPageSizeSelector={true}
                     />
                   </div>
                 </>
               )}
             </CardContent>
           </Card>
         </TabsContent>

         <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
              <CardDescription>Usage and performance events from self-hosted instances</CardDescription>
            </CardHeader>
            <CardContent>
              {telemetryData?.events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No events found for the selected time range
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Instance</TableHead>
                        <TableHead>Event Type</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Occurred</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {telemetryData?.events.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{event.self_hosted_instances.name}</p>
                              {event.self_hosted_instances.domain && (
                                <p className="text-xs text-muted-foreground">
                                  {event.self_hosted_instances.domain}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{event.event_type}</TableCell>
                          <TableCell>
                            <Badge variant={
                              event.severity === 'critical' ? 'destructive' :
                              event.severity === 'error' ? 'destructive' :
                              event.severity === 'warn' ? 'secondary' : 'outline'
                            }>
                              {event.severity || 'info'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDistanceToNow(new Date(event.occurred_at), { addSuffix: true })}
                          </TableCell>
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                   
                   <div className="mt-4">
                     <TablePaginator
                       currentPage={evPage}
                       totalPages={Math.ceil((telemetryData?.eventsTotal || 0) / evPageSize)}
                       pageSize={evPageSize}
                       totalItems={telemetryData?.eventsTotal || 0}
                       onPageChange={setEvPage}
                       onPageSizeChange={setEvPageSize}
                       showPageSizeSelector={true}
                     />
                   </div>
                 </>
               )}
             </CardContent>
           </Card>
         </TabsContent>

         <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle>Recent Errors</CardTitle>
              <CardDescription>Error reports from self-hosted instances</CardDescription>
            </CardHeader>
            <CardContent>
              {telemetryData?.errors.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No errors found for the selected time range
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Instance</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Severity</TableHead>
                        <TableHead>Occurred</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {telemetryData?.errors.map((error) => (
                        <TableRow key={error.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{error.self_hosted_instances.name}</p>
                              {error.self_hosted_instances.domain && (
                                <p className="text-xs text-muted-foreground">
                                  {error.self_hosted_instances.domain}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{error.message}</p>
                              {error.url && (
                                <p className="text-xs text-muted-foreground">{error.url}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              error.severity === 'critical' ? 'destructive' :
                              error.severity === 'error' ? 'destructive' : 'secondary'
                            }>
                              {error.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDistanceToNow(new Date(error.created_at), { addSuffix: true })}
                          </TableCell>
                        </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                   
                   <div className="mt-4">
                     <TablePaginator
                       currentPage={erPage}
                       totalPages={Math.ceil((telemetryData?.errorsTotal || 0) / erPageSize)}
                       pageSize={erPageSize}
                       totalItems={telemetryData?.errorsTotal || 0}
                       onPageChange={setErPage}
                       onPageSizeChange={setErPageSize}
                       showPageSizeSelector={true}
                     />
                   </div>
                 </>
               )}
             </CardContent>
           </Card>
         </TabsContent>
       </Tabs>
     </div>
   );
 }
