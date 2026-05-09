import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TablePaginator } from "@/components/ui/table-paginator";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Shield,
  AlertTriangle,
  CheckCircle,
  Eye,
  FileText,
} from "lucide-react";
import { format } from "date-fns";

interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
  performed_at: string;
  profile?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
}

const AuditLogs = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const { page, pageSize, offset, setPage, setPageSize } = useUrlPageParam({ defaultPage: 1, pageSize: 10 });

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, actionFilter, dateFilter, setPage]);

  useEffect(() => {
    fetchLogs();
  }, [page, pageSize, searchTerm, actionFilter, dateFilter]);

  const fetchLogs = async () => {
    try {
      // Get total count first
      const [activityCountResult, emailCountResult] = await Promise.all([
        supabase
          .from("user_activity_logs")
          .select('*', { count: 'exact', head: true }),
        supabase
          .from("email_logs")
          .select('*', { count: 'exact', head: true })
      ]);

      const totalCount = (activityCountResult.count || 0) + (emailCountResult.count || 0);
      setTotalLogs(totalCount);

      // Fetch more data than needed for client-side pagination
      const fetchLimit = Math.max(pageSize * 3, 200); // Fetch 3x pageSize or minimum 200
      
      const [logsResult, emailLogsResult] = await Promise.all([
        supabase
          .from("user_activity_logs")
          .select("*")
          .order("performed_at", { ascending: false })
          .limit(fetchLimit),
        supabase
          .from("email_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(fetchLimit)
      ]);

      if (logsResult.error) throw logsResult.error;
      if (emailLogsResult.error) throw emailLogsResult.error;

      const logsData = logsResult.data || [];
      const emailLogs = emailLogsResult.data || [];

      // Get unique user IDs from logs
      const userIds = [...new Set(logsData?.map(log => log.user_id).filter(Boolean))];
      
      // Fetch profiles for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds);

      if (profilesError) {
        console.warn("Error fetching profiles:", profilesError);
      }

      // Create a map of user profiles
      const profilesMap = new Map();
      profilesData?.forEach(profile => {
        profilesMap.set(profile.id, profile);
      });

      // Combine logs with profile data
      const logsWithProfile: ActivityLog[] = logsData?.map(log => ({
        id: log.id,
        user_id: log.user_id,
        action: log.action,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        details: log.details,
        ip_address: log.ip_address?.toString(),
        user_agent: log.user_agent,
        performed_at: log.performed_at,
        profile: profilesMap.get(log.user_id) || null
      })) || [];

      // Combine activity logs and email logs with proper typing
      const combinedLogs: ActivityLog[] = [
        ...logsWithProfile,
        ...(emailLogs?.map(log => ({
          id: log.id,
          user_id: log.recipient_email, // Using email as identifier for email logs
          action: `email_${log.status}`,
          entity_type: 'email',
          entity_id: log.id,
          details: {
            recipient: log.recipient_email,
            subject: log.subject,
            template_type: log.template_type,
            provider: log.provider,
            error_message: log.error_message
          },
          ip_address: undefined,
          user_agent: undefined,
          performed_at: log.created_at,
          profile: {
            first_name: log.recipient_name?.split(' ')[0],
            last_name: log.recipient_name?.split(' ')[1],
            email: log.recipient_email
          }
        })) || [])
      ].sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime());

      setLogs(combinedLogs);
    } catch (error) {
      console.error("Error fetching logs:", error);
      toast({
        title: "Error",
        description: "Failed to fetch activity logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "login":
      case "user_created":
        return "default";
      case "role_assigned":
      case "permission_granted":
        return "secondary";
      case "password_changed":
      case "account_updated":
        return "outline";
      case "failed_login":
      case "account_locked":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "login":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed_login":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "role_assigned":
        return <Shield className="h-4 w-4 text-blue-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getUserDisplayName = (log: ActivityLog) => {
    if (log.profile?.first_name && log.profile?.last_name) {
      return `${log.profile.first_name} ${log.profile.last_name}`;
    }
    return log.profile?.email || "Unknown User";
  };

  const exportLogs = () => {
    const csv = [
      ["Timestamp", "User", "Action", "Entity Type", "IP Address", "Details"].join(","),
      ...logs.map(log => [
        log.performed_at,
        getUserDisplayName(log),
        log.action,
        log.entity_type || "",
        log.ip_address || "",
        JSON.stringify(log.details || {})
      ].join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();

    toast({
      title: "Export Complete",
      description: "Audit logs have been exported successfully.",
    });
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      getUserDisplayName(log).toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entity_type?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction = actionFilter === "all" || log.action === actionFilter;

    // Date filtering logic
    let matchesDate = true;
    if (dateFilter === "today") {
      const today = new Date();
      const logDate = new Date(log.performed_at);
      matchesDate = logDate.toDateString() === today.toDateString();
    } else if (dateFilter === "week") {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      matchesDate = new Date(log.performed_at) >= weekAgo;
    } else if (dateFilter === "month") {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      matchesDate = new Date(log.performed_at) >= monthAgo;
    }

    return matchesSearch && matchesAction && matchesDate;
  });

  const logStats = {
    total: logs.length,
    today: logs.filter(log => {
      const today = new Date();
      const logDate = new Date(log.performed_at);
      return logDate.toDateString() === today.toDateString();
    }).length,
    logins: logs.filter(log => log.action === "login").length,
    failures: logs.filter(log => log.action === "failed_login").length,
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="bg-tint-gray p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">Audit Logs</h1>
            <p className="text-muted-foreground">
              Monitor user activities and system events
            </p>
          </div>
          <Button onClick={exportLogs} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Logs
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card className="card-gradient-blue hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white">Total Events</CardTitle>
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <Activity className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">{logStats.total}</div>
              <p className="text-sm text-white/90 font-medium">All time</p>
            </CardContent>
          </Card>

          <Card className="card-gradient-green hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white">Today's Activity</CardTitle>
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <Calendar className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">{logStats.today}</div>
              <p className="text-sm text-white/90 font-medium">Events today</p>
            </CardContent>
          </Card>

          <Card className="card-gradient-orange hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white">Successful Logins</CardTitle>
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">{logStats.logins}</div>
              <p className="text-sm text-white/90 font-medium">Login events</p>
            </CardContent>
          </Card>

          <Card className="card-gradient-red hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white">Failed Attempts</CardTitle>
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">{logStats.failures}</div>
              <p className="text-sm text-white/90 font-medium">Failed logins</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-card">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="failed_login">Failed Login</SelectItem>
                  <SelectItem value="role_assigned">Role Assigned</SelectItem>
                  <SelectItem value="account_updated">Account Updated</SelectItem>
                  <SelectItem value="password_changed">Password Changed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-48">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Activity Logs Table */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-primary">Activity Logs ({totalLogs})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.slice(offset, offset + pageSize).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(log.performed_at), "MMM dd, yyyy")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(log.performed_at), "h:mm a")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{getUserDisplayName(log)}</p>
                          <p className="text-xs text-muted-foreground">{log.profile?.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action)}
                        <Badge variant={getActionColor(log.action)}>
                          {log.action}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {log.entity_type && (
                          <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {log.entity_type}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-mono">
                        {log.ip_address || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {log.details && Object.keys(log.details).length > 0 ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Activity Details</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <strong>Action:</strong> {log.action}
                                </div>
                                <div>
                                  <strong>User:</strong> {getUserDisplayName(log)}
                                </div>
                                <div>
                                  <strong>Timestamp:</strong> {format(new Date(log.performed_at), "PPpp")}
                                </div>
                                {log.entity_type && (
                                  <div>
                                    <strong>Entity Type:</strong> {log.entity_type}
                                  </div>
                                )}
                                {log.ip_address && (
                                  <div>
                                    <strong>IP Address:</strong> {log.ip_address}
                                  </div>
                                )}
                                <div>
                                  <strong>Details:</strong>
                                  <pre className="mt-2 p-3 bg-muted rounded text-sm overflow-auto">
                                    {JSON.stringify(log.details, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <span className="text-muted-foreground">No details</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <div className="mt-4">
                <TablePaginator
                  currentPage={page}
                  totalPages={Math.ceil(Math.max(filteredLogs.length, 1) / pageSize)}
                  pageSize={pageSize}
                  totalItems={filteredLogs.length}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  showPageSizeSelector={true}
                />
              </div>
            </CardContent>
          </Card>
        </div>
    </DashboardLayout>
  );
};

export default AuditLogs;