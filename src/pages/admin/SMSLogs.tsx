import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Send, Search, Filter, Download } from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SMSLog {
  id: string;
  phone_number: string;
  phone_number_formatted: string;
  message_content: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  failed_at: string | null;
  error_message: string | null;
  provider_name: string | null;
  message_type: string;
  retry_count: number;
  created_at: string;
}

export default function SMSLogs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Fetch SMS logs
  const { data: smsLogs, isLoading, refetch } = useQuery({
    queryKey: ['sms-logs', statusFilter, typeFilter],
    queryFn: async () => {
      let query = supabase
        .from('sms_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (typeFilter !== 'all') {
        query = query.eq('message_type', typeFilter);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as SMSLog[];
    },
  });

  // Test SMS mutation
  const testSMS = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('test-sms');
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Test SMS sent",
        description: "Check the SMS logs below for delivery status.",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Test SMS failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Resend SMS mutation
  const resendSMS = useMutation({
    mutationFn: async (log: SMSLog) => {
      const { data, error } = await supabase.functions.invoke('send-sms-with-logging', {
        body: {
          phone_number: log.phone_number_formatted,
          message: log.message_content,
          message_type: log.message_type,
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "SMS resent",
        description: "The SMS has been queued for resending.",
      });
      queryClient.invalidateQueries({ queryKey: ['sms-logs'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to resend SMS",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter logs based on search term
  const filteredLogs = smsLogs?.filter(log => 
    log.phone_number_formatted.includes(searchTerm) ||
    log.message_content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.status.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Get status badge color
  const getStatusBadge = (status: string) => {
    const colors = {
      pending: "bg-yellow-500",
      sent: "bg-blue-500",
      delivered: "bg-green-500",
      failed: "bg-red-500",
    };
    return (
      <Badge className={colors[status as keyof typeof colors] || "bg-gray-500"}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!filteredLogs || filteredLogs.length === 0) {
      toast({
        title: "No data to export",
        variant: "destructive",
      });
      return;
    }

    const headers = ['Date', 'Phone Number', 'Message', 'Status', 'Provider', 'Type', 'Error'];
    const rows = filteredLogs.map(log => [
      format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      log.phone_number_formatted,
      log.message_content.replace(/\n/g, ' '),
      log.status,
      log.provider_name || 'N/A',
      log.message_type,
      log.error_message || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sms-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Exported successfully",
      description: `${filteredLogs.length} SMS logs exported to CSV`,
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">SMS Logs</h1>
          <p className="text-muted-foreground">
            Monitor and manage all SMS messages sent from the system
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => testSMS.mutate()} disabled={testSMS.isPending}>
            <Send className="mr-2 h-4 w-4" />
            Test SMS (254722241745)
          </Button>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SMS Statistics</CardTitle>
          <CardDescription>Overview of SMS delivery status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold">
                {smsLogs?.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Total SMS</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {smsLogs?.filter(l => l.status === 'delivered' || l.status === 'sent').length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Delivered</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {smsLogs?.filter(l => l.status === 'pending').length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {smsLogs?.filter(l => l.status === 'failed').length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>SMS Logs</CardTitle>
              <CardDescription>
                All SMS messages with delivery status and resend capability
              </CardDescription>
            </div>
            <Button onClick={exportToCSV} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by phone, message, or status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="credentials">Credentials</SelectItem>
                <SelectItem value="notification">Notification</SelectItem>
                <SelectItem value="reminder">Reminder</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Message Preview</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Retries</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Loading SMS logs...
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No SMS logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">
                        {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="font-mono">
                        {log.phone_number_formatted}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {log.message_content}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.message_type}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.provider_name || 'N/A'}
                      </TableCell>
                      <TableCell className="text-center">
                        {log.retry_count}
                      </TableCell>
                      <TableCell>
                        {log.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resendSMS.mutate(log)}
                            disabled={resendSMS.isPending}
                          >
                            <RefreshCw className="mr-1 h-3 w-3" />
                            Resend
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!isLoading && filteredLogs.length > 0 && (
            <div className="text-sm text-muted-foreground text-center">
              Showing {filteredLogs.length} of {smsLogs?.length || 0} SMS logs
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
