import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePaginator } from "@/components/ui/table-paginator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Monitor, Smartphone, Globe, Clock, X } from "lucide-react";

interface UserSession {
  id: string;
  login_time: string;
  logout_time: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_info: any;
  location: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  session_token?: string | null;
  user_id?: string;
}

interface UserSessionsDialogProps {
  userId: string;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserSessionsDialog({ userId, userName, open, onOpenChange }: UserSessionsDialogProps) {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  
  const pageSize = 10;

  useEffect(() => {
    if (open && userId) {
      fetchUserSessions();
    }
  }, [open, userId]);

  const fetchUserSessions = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('get-user-sessions', {
        body: { userId, limit: 20 }
      });

      if (error) throw error;

      const response = result as any;
      if (!response?.success) {
        throw new Error(response?.error || "Failed to fetch sessions");
      }

      setSessions(response.sessions || []);
    } catch (error) {
      console.error('Error fetching user sessions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch user sessions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const terminateSession = async (sessionId: string) => {
    try {
      const { data: result, error } = await supabase.functions.invoke('admin-user-operations', {
        body: {
          operation: 'revoke_sessions',
          userId,
          sessionId,
          revokeAll: false
        }
      });

      if (error) throw error;

      const response = result as any;
      if (!response?.success) {
        throw new Error(response?.error || "Failed to terminate session");
      }

      toast({
        title: "Success",
        description: "Session terminated successfully",
      });
      
      fetchUserSessions();
    } catch (error) {
      console.error('Error terminating session:', error);
      toast({
        title: "Error",
        description: "Failed to terminate session",
        variant: "destructive",
      });
    }
  };

  const terminateAllSessions = async () => {
    try {
      const { data: result, error } = await supabase.functions.invoke('admin-user-operations', {
        body: {
          operation: 'revoke_sessions',
          userId,
          revokeAll: true
        }
      });

      if (error) throw error;

      const response = result as any;
      if (!response?.success) {
        throw new Error(response?.error || "Failed to terminate sessions");
      }

      toast({
        title: "Success",
        description: `${response.sessions_revoked} sessions terminated successfully`,
      });
      
      fetchUserSessions();
    } catch (error) {
      console.error('Error terminating sessions:', error);
      toast({
        title: "Error",
        description: "Failed to terminate sessions",
        variant: "destructive",
      });
    }
  };

  const getDeviceIcon = (userAgent: string | null) => {
    if (!userAgent) return <Globe className="h-4 w-4" />;
    
    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      return <Smartphone className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  const getBrowserInfo = (userAgent: string | null) => {
    if (!userAgent) return "Unknown Browser";
    
    if (userAgent.includes('Chrome')) return "Chrome";
    if (userAgent.includes('Firefox')) return "Firefox";
    if (userAgent.includes('Safari')) return "Safari";
    if (userAgent.includes('Edge')) return "Edge";
    return "Other Browser";
  };

  const activeSessions = sessions.filter(s => s.is_active);
  const inactiveSessions = sessions.filter(s => !s.is_active);
  
  // Pagination for inactive sessions
  const totalInactiveItems = inactiveSessions.length;
  const totalInactivePages = Math.ceil(totalInactiveItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedInactiveSessions = inactiveSessions.slice(startIndex, startIndex + pageSize);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="text-primary">
            Login Sessions for {userName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="card-gradient-blue">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white">Total Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{sessions.length}</div>
              </CardContent>
            </Card>
            <Card className="card-gradient-green">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white">Active Sessions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{activeSessions.length}</div>
              </CardContent>
            </Card>
            <Card className="card-gradient-orange">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white">Recent Logins</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">
                  {sessions.filter(s => {
                    const loginTime = new Date(s.login_time);
                    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                    return loginTime > oneDayAgo;
                  }).length}
                </div>
                <p className="text-xs text-white/80">Last 24 hours</p>
              </CardContent>
            </Card>
          </div>

          {/* Active Sessions */}
          {activeSessions.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-primary">Active Sessions</h3>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={terminateAllSessions}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <X className="h-3 w-3 mr-1" />
                  Terminate All
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Browser</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Login Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4">
                        Loading sessions...
                      </TableCell>
                    </TableRow>
                  ) : activeSessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getDeviceIcon(session.user_agent)}
                          <span className="text-sm">
                            {session.user_agent?.includes('Mobile') || 
                             session.user_agent?.includes('Android') || 
                             session.user_agent?.includes('iPhone') ? 'Mobile' : 'Desktop'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getBrowserInfo(session.user_agent)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {session.ip_address || 'Unknown'}
                      </TableCell>
                      <TableCell>{session.location || 'Unknown'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(session.login_time), 'MMM dd, yyyy HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-success text-success-foreground">
                          Active
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => terminateSession(session.id)}
                          className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Terminate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Recent Inactive Sessions */}
          {inactiveSessions.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-primary mb-3">Recent Login History</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Browser</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Login Time</TableHead>
                    <TableHead>Logout Time</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInactiveSessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getDeviceIcon(session.user_agent)}
                          <span className="text-sm">
                            {session.user_agent?.includes('Mobile') || 
                             session.user_agent?.includes('Android') || 
                             session.user_agent?.includes('iPhone') ? 'Mobile' : 'Desktop'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getBrowserInfo(session.user_agent)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {session.ip_address || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(session.login_time), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        {session.logout_time 
                          ? format(new Date(session.logout_time), 'MMM dd, yyyy HH:mm')
                          : 'Unknown'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          Ended
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {totalInactivePages > 1 && (
                <div className="mt-4">
                  <TablePaginator
                    currentPage={currentPage}
                    totalPages={totalInactivePages}
                    pageSize={pageSize}
                    totalItems={totalInactiveItems}
                    onPageChange={setCurrentPage}
                    showPageSizeSelector={false}
                  />
                </div>
              )}
            </div>
          )}

          {sessions.length === 0 && !loading && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No login sessions found for this user.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}