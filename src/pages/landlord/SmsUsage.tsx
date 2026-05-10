import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useSmsCredits } from "@/hooks/useSmsCredits";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { 
  MessageSquare, TrendingUp, DollarSign, Clock, CheckCircle, XCircle, 
  AlertCircle, RefreshCw, CreditCard 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { FeatureGate } from "@/components/ui/feature-gate";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";

interface SmsLog {
  id: string;
  phone_number: string;
  message_type: string;
  status: string;
  provider_name: string;
  created_at: string;
  error_message?: string;
}

interface SmsStats {
  total_sent: number;
  total_failed: number;
  total_pending: number;
  total_cost: number;
}

interface Landlord {
  id: string;
  email: string;
}

const SmsUsage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { balance, isLow, loading: creditsLoading, refresh: refreshCredits } = useSmsCredits();
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [stats, setStats] = useState<SmsStats>({
    total_sent: 0,
    total_failed: 0,
    total_pending: 0,
    total_cost: 0
  });
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [selectedLandlordId, setSelectedLandlordId] = useState<string>("");
  const [currentLandlordId, setCurrentLandlordId] = useState<string>("");

  useEffect(() => {
    if (user) {
      checkAdminRole();
      const effectiveLandlordId = selectedLandlordId || user.id;
      setCurrentLandlordId(effectiveLandlordId);
      loadSmsData(effectiveLandlordId);
      
      // Real-time subscription
      const channel = supabase
        .channel('sms_logs_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'sms_logs',
            filter: `landlord_id=eq.${effectiveLandlordId}`
          },
          (payload) => {
            console.log('📱 SMS log change:', payload);
            if (payload.eventType === 'INSERT') {
              setLogs(prev => {
                const newLogs = [payload.new as SmsLog, ...prev].slice(0, 50);
                recalculateStats(newLogs);
                return newLogs;
              });
            } else if (payload.eventType === 'UPDATE') {
              setLogs(prev => {
                const newLogs = prev.map(log => 
                  log.id === payload.new.id ? payload.new as SmsLog : log
                );
                recalculateStats(newLogs);
                return newLogs;
              });
            }
            refreshCredits();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, selectedLandlordId]);

  const checkAdminRole = async () => {
    try {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user?.id);
      
      if (roles?.some(r => r.role === 'Admin')) {
        setIsAdmin(true);
        loadLandlords();
      }
    } catch (error) {
      console.error('Error checking admin role:', error);
    }
  };

  const loadLandlords = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email')
        .order('email');
      
      if (!error && data) {
        setLandlords(data.map(p => ({ 
          id: p.id, 
          email: p.email
        })));
      }
    } catch (error) {
      console.error('Error loading landlords:', error);
    }
  };

  const recalculateStats = (logsList: SmsLog[]) => {
    const newStats: SmsStats = {
      total_sent: logsList.filter(log => log.status === 'sent').length,
      total_failed: logsList.filter(log => log.status === 'failed').length,
      total_pending: logsList.filter(log => log.status === 'pending').length,
      total_cost: logsList.filter(log => log.status === 'sent').length * 2.5,
    };
    setStats(newStats);
  };

  const loadSmsData = async (landlordId: string) => {
    try {
      setLoading(true);

      // Load SMS logs for current month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: logsData, error: logsError } = await supabase
        .from('sms_logs')
        .select('*')
        .eq('landlord_id', landlordId)
        .gte('created_at', startOfMonth.toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      if (logsError) {
        console.error('Error fetching SMS logs:', logsError);
        throw logsError;
      }

      console.log(`✅ Loaded ${logsData?.length || 0} SMS logs for landlord`);
      setLogs(logsData || []);
      recalculateStats(logsData || []);

    } catch (error) {
      console.error('Error loading SMS data:', error);
      toast.error("Failed to load SMS usage data");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default" className="bg-green-500">Sent</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-3 sm:p-4 lg:p-6 space-y-6">
        <FeatureGate
          feature={FEATURES.SMS_NOTIFICATIONS}
          fallbackTitle="SMS Usage & Analytics"
          fallbackDescription="Track your SMS delivery, monitor costs, and analyze messaging patterns with detailed usage reports."
          allowReadOnly={false}
        >
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">SMS Usage</h1>
              <p className="text-muted-foreground">Monitor your SMS delivery and costs</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Badge variant={isLow ? "destructive" : "default"} className="text-sm">
                  <CreditCard className="mr-1 h-3 w-3" />
                  Credits: {balance}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => navigate('/billing')}>
                  Top up
                </Button>
              </div>
              <Button onClick={() => loadSmsData(currentLandlordId)} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {isAdmin && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>You're viewing SMS logs. Select a landlord to view their activity:</span>
                <Select value={selectedLandlordId} onValueChange={setSelectedLandlordId}>
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="View your own logs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Your own logs (Admin)</SelectItem>
                    {landlords.map(landlord => (
                      <SelectItem key={landlord.id} value={landlord.id}>
                        {landlord.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </AlertDescription>
            </Alert>
          )}

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_sent}</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Failed</CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">{stats.total_failed}</div>
                <p className="text-xs text-muted-foreground">Delivery failures</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.total_sent + stats.total_failed > 0
                    ? Math.round((stats.total_sent / (stats.total_sent + stats.total_failed)) * 100)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">Delivery success</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">KES {stats.total_cost.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent SMS Logs */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent SMS Activity</CardTitle>
                  <CardDescription>Last 50 SMS sent this month</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No SMS Activity</h3>
                  <p className="text-muted-foreground mb-2">
                    You haven't sent any SMS messages this month.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Send SMS from Bulk Messaging or when resending tenant credentials
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start justify-between border-b pb-3 last:border-0">
                      <div className="flex items-start gap-3">
                        {getStatusIcon(log.status)}
                        <div>
                          <p className="font-medium">To: {log.phone_number}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {log.message_type} • {log.provider_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </p>
                          {log.error_message && (
                            <p className="text-xs text-red-500 mt-1">Error: {log.error_message}</p>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(log.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </FeatureGate>
      </div>
    </DashboardLayout>
  );
};

export default SmsUsage;
