import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw,
  Database,
  Settings,
  Globe,
  Key,
  Phone,
  Clock
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  provider: string | null;
  checks: {
    database: { status: string; message?: string };
    provider_config: { status: string; message?: string; provider?: any };
    api_connectivity: { status: string; message?: string; response_time_ms?: number };
    authentication: { status: string; message?: string };
  };
  timestamp: string;
}

export function SMSHealthCheck() {
  const [healthCheck, setHealthCheck] = useState<HealthCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  const runHealthCheck = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sms-health-check');

      if (error) throw error;

      setHealthCheck(data);
      
      if (data.status === 'healthy') {
        toast.success("SMS provider is healthy");
      } else if (data.status === 'degraded') {
        toast.warning("SMS provider has some issues");
      } else {
        toast.error("SMS provider is unhealthy");
      }
    } catch (error: any) {
      console.error("Health check failed:", error);
      toast.error("Failed to run health check: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const sendTestSMS = async () => {
    if (!testPhone) {
      toast.error("Please enter a phone number");
      return;
    }

    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms-with-logging', {
        body: {
          phone_number: testPhone,
          message: `SMS Health Check Test - ${new Date().toLocaleString()}`,
          message_type: 'test'
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Test SMS sent successfully!");
      } else {
        toast.error("Failed to send test SMS: " + (data?.error || "Unknown error"));
      }
    } catch (error: any) {
      console.error("Test SMS failed:", error);
      toast.error("Failed to send test SMS: " + error.message);
    } finally {
      setSendingTest(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
      case 'healthy':
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'fail':
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'degraded':
        return <AlertCircle className="h-5 w-5 text-warning" />;
      default:
        return <Activity className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      healthy: "default",
      pass: "default",
      degraded: "secondary",
      unhealthy: "destructive",
      fail: "destructive"
    };
    
    return (
      <Badge variant={variants[status] || "outline"}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                SMS Health Check
              </CardTitle>
              <CardDescription>
                Monitor SMS provider status and test connectivity
              </CardDescription>
            </div>
            <Button onClick={runHealthCheck} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Run Check
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {healthCheck ? (
            <div className="space-y-6">
              {/* Overall Status */}
              <Alert>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(healthCheck.status)}
                    <div>
                      <div className="font-semibold">Overall Status</div>
                      <div className="text-sm text-muted-foreground">
                        Provider: {healthCheck.provider || 'Not configured'}
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(healthCheck.status)}
                </div>
              </Alert>

              {/* Individual Checks */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Database Check */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Database
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {healthCheck.checks.database.message}
                      </p>
                      {getStatusBadge(healthCheck.checks.database.status)}
                    </div>
                  </CardContent>
                </Card>

                {/* Provider Config Check */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Provider Config
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {healthCheck.checks.provider_config.message}
                        </p>
                        {getStatusBadge(healthCheck.checks.provider_config.status)}
                      </div>
                      {healthCheck.checks.provider_config.provider && (
                        <div className="text-xs text-muted-foreground space-y-1 mt-2 pt-2 border-t">
                          <div>Base URL: {healthCheck.checks.provider_config.provider.base_url}</div>
                          <div>Auth Token: {healthCheck.checks.provider_config.provider.has_auth_token ? '✓' : '✗'}</div>
                          <div>API Key: {healthCheck.checks.provider_config.provider.has_api_key ? '✓' : '✗'}</div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* API Connectivity Check */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      API Connectivity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {healthCheck.checks.api_connectivity.message}
                        </p>
                        {getStatusBadge(healthCheck.checks.api_connectivity.status)}
                      </div>
                      {healthCheck.checks.api_connectivity.response_time_ms && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {healthCheck.checks.api_connectivity.response_time_ms}ms
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Authentication Check */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Authentication
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {healthCheck.checks.authentication.message}
                      </p>
                      {getStatusBadge(healthCheck.checks.authentication.status)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Timestamp */}
              <div className="text-xs text-muted-foreground text-center">
                Last checked: {new Date(healthCheck.timestamp).toLocaleString()}
              </div>
            </div>
          ) : (
            <AlertDescription className="text-center py-8 text-muted-foreground">
              Click "Run Check" to test SMS provider health
            </AlertDescription>
          )}
        </CardContent>
      </Card>

      {/* Test SMS Sending */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Test SMS Sending
          </CardTitle>
          <CardDescription>
            Send a test SMS to verify end-to-end functionality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="test-phone">Phone Number</Label>
              <Input
                id="test-phone"
                placeholder="254712345678"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={sendTestSMS} disabled={sendingTest || !testPhone}>
                {sendingTest ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Phone className="h-4 w-4 mr-2" />
                    Send Test
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
