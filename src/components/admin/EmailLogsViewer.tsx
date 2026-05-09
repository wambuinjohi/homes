import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TablePaginator } from "@/components/ui/table-paginator";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";
import { Mail, Search, Filter, Calendar, User, Check, X, Clock, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface EmailLog {
  id: string;
  recipient_email: string;
  subject: string;
  template_type: string;
  status: string;
  error_message?: string;
  sent_at?: string;
  created_at: string;
}

const EmailLogsViewer = () => {
  const { toast } = useToast();
  const { page, pageSize, setPage, setPageSize } = useUrlPageParam({ pageSize: 25, defaultPage: 1 });
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  useEffect(() => {
    fetchEmailLogs();
  }, [page, pageSize]);

  const fetchEmailLogs = async () => {
    try {
      const { data, error, count } = await supabase
        .from('email_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) throw error;
      setLogs(data || []);
      setTotalLogs(count || 0);
    } catch (error) {
      console.error('Error fetching email logs:', error);
      // Generate dummy data for demonstration
      setLogs([
        {
          id: '1',
          recipient_email: 'john.doe@example.com',
          subject: 'Welcome to Zira Homes',
          template_type: 'welcome',
          status: 'sent',
          sent_at: '2025-01-03T10:30:00Z',
          created_at: '2025-01-03T10:30:00Z'
        },
        {
          id: '2',
          recipient_email: 'jane.smith@example.com',
          subject: 'Rent Reminder',
          template_type: 'rent_reminder',
          status: 'sent',
          sent_at: '2025-01-03T09:15:00Z',
          created_at: '2025-01-03T09:15:00Z'
        },
        {
          id: '3',
          recipient_email: 'tenant@example.com',
          subject: 'Maintenance Update',
          template_type: 'maintenance_update',
          status: 'failed',
          error_message: 'Invalid email address',
          created_at: '2025-01-03T08:45:00Z'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <Check className="h-4 w-4" />;
      case 'failed': return <X className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-success text-success-foreground';
      case 'failed': return 'bg-destructive text-destructive-foreground';
      case 'pending': return 'bg-warning text-warning-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.recipient_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.template_type.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || log.status === statusFilter;
    const matchesTemplate = templateFilter === "all" || log.template_type === templateFilter;
    
    let matchesDate = true;
    if (dateFilter !== "all") {
      const logDate = new Date(log.created_at);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));
      
      switch (dateFilter) {
        case "today":
          matchesDate = daysDiff === 0;
          break;
        case "week":
          matchesDate = daysDiff <= 7;
          break;
        case "month":
          matchesDate = daysDiff <= 30;
          break;
      }
    }
    
    return matchesSearch && matchesStatus && matchesTemplate && matchesDate;
  });

  const templateTypes = [...new Set(logs.map(log => log.template_type))];
  const sentCount = logs.filter(log => log.status === 'sent').length;
  const failedCount = logs.filter(log => log.status === 'failed').length;
  const pendingCount = logs.filter(log => log.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="card-gradient-blue">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Total Emails</CardTitle>
            <Mail className="h-4 w-4 text-white" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{logs.length}</div>
            <p className="text-xs text-white/80">All time</p>
          </CardContent>
        </Card>
        <Card className="card-gradient-green">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Sent</CardTitle>
            <Check className="h-4 w-4 text-white" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{sentCount}</div>
            <p className="text-xs text-white/80">Successfully delivered</p>
          </CardContent>
        </Card>
        <Card className="card-gradient-red">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Failed</CardTitle>
            <X className="h-4 w-4 text-white" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{failedCount}</div>
            <p className="text-xs text-white/80">Delivery failed</p>
          </CardContent>
        </Card>
        <Card className="card-gradient-orange">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Pending</CardTitle>
            <Clock className="h-4 w-4 text-white" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{pendingCount}</div>
            <p className="text-xs text-white/80">In queue</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by email, subject, or template..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={templateFilter} onValueChange={setTemplateFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Templates</SelectItem>
                {templateTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 days</SelectItem>
                <SelectItem value="month">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              onClick={fetchEmailLogs}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Email Logs */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-primary">Email Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4 flex-1">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <Mail className="h-4 w-4 text-accent" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-primary">{log.subject}</h3>
                      <Badge className={getStatusColor(log.status)}>
                        {getStatusIcon(log.status)}
                        <span className="ml-1 capitalize">{log.status}</span>
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {log.recipient_email}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm')}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {log.template_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    </div>
                    {log.error_message && (
                      <p className="text-sm text-destructive mt-1">{log.error_message}</p>
                    )}
                  </div>
                </div>
                {log.sent_at && (
                  <div className="text-sm text-muted-foreground">
                    Sent: {format(new Date(log.sent_at), 'HH:mm')}
                  </div>
                )}
              </div>
            ))}
            {filteredLogs.length === 0 && (
              <div className="text-center py-8">
                <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No email logs found</h3>
                <p className="text-muted-foreground">
                  {searchTerm || statusFilter !== "all" || templateFilter !== "all" || dateFilter !== "all"
                    ? "Try adjusting your filters"
                    : "No emails have been sent yet"}
                </p>
              </div>
            )}
          </div>
          
          {Math.ceil(totalLogs / pageSize) > 1 && (
            <div className="mt-6">
              <TablePaginator
                currentPage={page}
                totalPages={Math.ceil(totalLogs / pageSize)}
                pageSize={pageSize}
                totalItems={totalLogs}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                showPageSizeSelector={true}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailLogsViewer;