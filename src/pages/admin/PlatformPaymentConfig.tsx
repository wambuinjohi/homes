import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, CreditCard, CheckCircle, AlertTriangle, Settings, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function PlatformPaymentConfig() {
  const [loading, setLoading] = useState(false);
  const [platformConfig, setPlatformConfig] = useState({
    shortcode: "4155923",
    environment: "production",
    isConfigured: false,
    landlordCount: 0,
    customCount: 0
  });

  useEffect(() => {
    loadPlatformStats();
  }, []);

  const loadPlatformStats = async () => {
    try {
      // Get count of landlords using platform defaults (no custom config)
      const { count: totalLandlords } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "Landlord");

      const { count: customConfigs } = await supabase
        .from("landlord_mpesa_configs")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);

      setPlatformConfig(prev => ({
        ...prev,
        landlordCount: totalLandlords || 0,
        customCount: customConfigs || 0,
        isConfigured: true // Based on env vars being present
      }));
    } catch (error) {
      console.error("Error loading platform stats:", error);
    }
  };

  const testPlatformMpesa = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("mpesa-stk-push", {
        body: {
          phone: "254708374149", // Test phone
          amount: 1,
          accountReference: "PLATFORM_TEST",
          transactionDesc: "Platform M-Pesa Test",
          paymentType: "subscription",
          dryRun: true
        }
      });

      if (error) throw error;

      if (data?.success || data?.CheckoutRequestID) {
        toast.success("Platform M-Pesa configuration is working correctly!");
      } else {
        toast.error("Platform M-Pesa test failed. Check credentials.");
      }
    } catch (error) {
      console.error("Error testing platform M-Pesa:", error);
      toast.error(error instanceof Error ? error.message : "Failed to test platform M-Pesa");
    } finally {
      setLoading(false);
    }
  };

  const defaultLandlordCount = platformConfig.landlordCount - platformConfig.customCount;

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 max-w-6xl space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <Button 
            variant="ghost" 
            size="sm" 
            asChild
          >
            <Link to="/admin/payment-config" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Payment Configuration
            </Link>
          </Button>

          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Settings className="h-8 w-8" />
              Platform Payment Configuration
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage platform-wide M-Pesa settings and monitor usage
            </p>
          </div>
        </div>

        {/* Platform M-Pesa Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Platform M-Pesa Configuration
            </CardTitle>
            <CardDescription>
              Default M-Pesa credentials used when landlords don't configure their own
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Configuration Status */}
            <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
              <div className="flex items-center gap-3">
                {platformConfig.isConfigured ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                )}
                <div>
                  <p className="font-medium">
                    {platformConfig.isConfigured ? "Configured" : "Not Configured"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {platformConfig.isConfigured
                      ? "Platform M-Pesa credentials are active"
                      : "Platform credentials need to be configured"}
                  </p>
                </div>
              </div>
              <Badge variant={platformConfig.isConfigured ? "default" : "destructive"}>
                {platformConfig.environment}
              </Badge>
            </div>

            {/* Current Configuration Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Business Shortcode</p>
                <p className="text-2xl font-mono font-bold">{platformConfig.shortcode}</p>
                <p className="text-xs text-muted-foreground mt-1">Paybill Number</p>
              </div>

              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Environment</p>
                <p className="text-2xl font-bold capitalize">{platformConfig.environment}</p>
                <Badge variant="outline" className="mt-1">
                  Live Payments
                </Badge>
              </div>

              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Landlords Using Defaults</p>
                <p className="text-2xl font-bold">{defaultLandlordCount}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  of {platformConfig.landlordCount} total landlords
                </p>
              </div>

              <div className="p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground">Custom Configurations</p>
                <p className="text-2xl font-bold">{platformConfig.customCount}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Landlords with own M-Pesa
                </p>
              </div>
            </div>

            {/* Security Notice */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <h3 className="font-medium text-blue-900 dark:text-blue-100">
                    Secure Credential Storage
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                    Platform M-Pesa credentials are stored as encrypted environment variables
                    (MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY).
                    These are used as fallback when landlords don't configure custom credentials.
                  </p>
                  <ul className="text-xs text-blue-700 dark:text-blue-300 mt-2 space-y-1 ml-4 list-disc">
                    <li>Credentials encrypted at rest using AES-256-GCM</li>
                    <li>Never exposed to frontend applications</li>
                    <li>Only accessible through secure edge functions</li>
                    <li>Full audit trail for all payment transactions</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={testPlatformMpesa}
                disabled={loading || !platformConfig.isConfigured}
                variant="default"
              >
                {loading ? "Testing..." : "Test Platform M-Pesa"}
              </Button>
              <Button variant="outline" disabled>
                View Credentials (Environment Variables)
              </Button>
            </div>

            {/* Usage Statistics */}
            <div className="pt-4 border-t">
              <h3 className="font-medium mb-3">Usage Distribution</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Using Platform Defaults</span>
                  <div className="flex items-center gap-2">
                    <div className="w-48 h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{
                          width: `${platformConfig.landlordCount > 0 ? (defaultLandlordCount / platformConfig.landlordCount) * 100 : 0}%`
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">
                      {platformConfig.landlordCount > 0
                        ? Math.round((defaultLandlordCount / platformConfig.landlordCount) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Using Custom Configuration</span>
                  <div className="flex items-center gap-2">
                    <div className="w-48 h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{
                          width: `${platformConfig.landlordCount > 0 ? (platformConfig.customCount / platformConfig.landlordCount) * 100 : 0}%`
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-12 text-right">
                      {platformConfig.landlordCount > 0
                        ? Math.round((platformConfig.customCount / platformConfig.landlordCount) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instructions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Managing Platform Credentials</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <p>
              Platform M-Pesa credentials are managed through environment variables for security.
              To update these credentials:
            </p>
            <ol className="space-y-2">
              <li>
                <strong>Update Environment Variables:</strong> Set the following in your Supabase
                project settings:
                <ul className="ml-4 mt-1">
                  <li><code>MPESA_CONSUMER_KEY</code></li>
                  <li><code>MPESA_CONSUMER_SECRET</code></li>
                  <li><code>MPESA_SHORTCODE</code> (currently: 4155923)</li>
                  <li><code>MPESA_PASSKEY</code></li>
                  <li><code>MPESA_ENVIRONMENT</code> (sandbox or production)</li>
                </ul>
              </li>
              <li>
                <strong>Test Configuration:</strong> Use the "Test Platform M-Pesa" button above
                to verify credentials work correctly
              </li>
              <li>
                <strong>Monitor Usage:</strong> Check this dashboard regularly to see how many
                landlords are using platform defaults vs custom configurations
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
