import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Building2, CheckCircle, XCircle, Loader2, Shield, Info, Copy, AlertTriangle, ExternalLink, Key, Smartphone } from "lucide-react";

export const JengaPayConfig: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testingPayment, setTestingPayment] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(true);
  const [config, setConfig] = useState({
    merchant_code: '',
    api_key: '',
    consumer_secret: '',
    paybill_number: '247247',
    environment: 'sandbox' as 'sandbox' | 'production',
    ipn_username: '',
    ipn_password: ''
  });
  const [existingConfig, setExistingConfig] = useState<any>(null);
  const [ipnUrl, setIpnUrl] = useState('');

  useEffect(() => {
    checkAvailability();
    loadConfig();
    // Generate IPN URL - always use the Supabase project URL
    const callbackUrl = `https://kdpqimetajnhcqseajok.supabase.co/functions/v1/jenga-ipn-callback`;
    setIpnUrl(callbackUrl);
  }, []);

  const checkAvailability = async () => {
    try {
      const { data, error } = await supabase
        .from('approved_payment_methods')
        .select('is_active')
        .eq('payment_method_type', 'jenga_pay')
        .eq('country_code', 'KE')
        .maybeSingle();

      if (error) throw error;
      setIsEnabled(data?.is_active || false);
    } catch (error) {
      console.error('Error checking Jenga PAY availability:', error);
      setIsEnabled(false);
    } finally {
      setCheckingAvailability(false);
    }
  };

  const loadConfig = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('landlord_jenga_configs')
        .select('*')
        .eq('landlord_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setExistingConfig(data);
        setConfig({
          merchant_code: data.merchant_code || '',
          api_key: '',
          consumer_secret: '',
          paybill_number: data.paybill_number || '247247',
          environment: (data.environment as 'sandbox' | 'production') || 'sandbox',
          ipn_username: data.ipn_username || '',
          ipn_password: ''
        });
      }
    } catch (error) {
      console.error('Error loading Jenga config:', error);
      toast({
        title: "Error",
        description: "Failed to load Jenga PAY configuration",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !config.merchant_code || !config.api_key || !config.consumer_secret) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields (Merchant Code, API Key, Consumer Secret)",
        variant: "destructive"
      });
      return;
    }

    // Warn if going to production without IPN auth
    if (config.environment === 'production' && (!config.ipn_username || !config.ipn_password)) {
      toast({
        title: "Security Warning",
        description: "It's recommended to set IPN Username and Password for production environment",
        variant: "destructive"
      });
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('landlord_jenga_configs')
        .upsert({
          landlord_id: user.id,
          merchant_code: config.merchant_code,
          api_key_encrypted: config.api_key,
          consumer_secret_encrypted: config.consumer_secret,
          paybill_number: config.paybill_number,
          environment: config.environment,
          ipn_username: config.ipn_username || null,
          ipn_password_encrypted: config.ipn_password || null,
          ipn_url: ipnUrl,
          is_active: true,
          credentials_verified: false
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Jenga PAY configuration saved successfully"
      });

      await loadConfig();
    } catch (error) {
      console.error('Error saving Jenga config:', error);
      toast({
        title: "Error",
        description: "Failed to save configuration",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const testPayment = async () => {
    if (!user) return;
    
    setTestingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('jenga-stk-push', {
        body: {
          phone: user.phone || '254722000000', // Use user's phone or test number
          amount: 1, // Test with 1 KES
          accountReference: 'TEST-PAYMENT',
          transactionDesc: 'Jenga PAY Configuration Test',
          landlordId: user.id
        }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        toast({
          title: "STK Push Sent",
          description: `Check your phone (${data.checkoutRequestId}). You should receive an M-Pesa prompt.`
        });
      } else {
        throw new Error(data?.error || 'STK Push failed');
      }
    } catch (error: any) {
      console.error('Error testing payment:', error);
      toast({
        title: "Test Failed",
        description: error.message || "Failed to test payment. Please check your credentials.",
        variant: "destructive"
      });
    } finally {
      setTestingPayment(false);
    }
  };

  const copyToClipboard = (text: string, label: string = "URL") => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`
    });
  };

  // Don't render if checking availability
  if (checkingAvailability) {
    return null;
  }

  // Don't render if Jenga PAY is not enabled by admin
  if (!isEnabled) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-green-600" />
          Equity Bank - Jenga PAY Configuration
        </CardTitle>
        <CardDescription>
          Configure your Equity Bank Jenga PAY credentials to accept payments via paybill 247247
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Badge */}
        {existingConfig && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <Badge variant={existingConfig.is_active ? "default" : "secondary"}>
              {existingConfig.is_active ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3 mr-1" />
                  Inactive
                </>
              )}
            </Badge>
            <Badge variant="outline">
              {config.environment === 'production' ? 'Production' : 'Sandbox'}
            </Badge>
            {existingConfig.ipn_username && (
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <Key className="h-3 w-3 mr-1" />
                IPN Auth Enabled
              </Badge>
            )}
          </div>
        )}

        {/* Dual Payment Support Info */}
        <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle>Two Ways to Pay</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>Your tenants can pay using <strong>Equity Bank Paybill 247247</strong> in two ways:</p>
            <div className="grid gap-2 mt-2">
              <div className="flex items-start gap-2 p-2 bg-background/50 rounded">
                <Smartphone className="h-4 w-4 mt-0.5 text-green-600" />
                <div>
                  <strong>STK Push (Instant Prompt)</strong>
                  <p className="text-sm text-muted-foreground">You initiate payment from the app, tenant receives M-Pesa prompt</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 bg-background/50 rounded">
                <Building2 className="h-4 w-4 mt-0.5 text-green-600" />
                <div>
                  <strong>Direct Paybill Payment</strong>
                  <p className="text-sm text-muted-foreground">Tenant pays to 247247 using <strong>{config.merchant_code || '[MerchantCode]'}-[UnitNumber]</strong> as account</p>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-2">Both methods trigger instant payment notifications (IPN) to automatically match payments.</p>
          </AlertDescription>
        </Alert>

        {/* Tenant Payment Instructions */}
        {config.merchant_code && (
          <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle>Tenant Payment Instructions</AlertTitle>
            <AlertDescription className="space-y-2">
              <p className="text-sm">Share these instructions with your tenants:</p>
              <div className="p-3 bg-background rounded-lg border font-mono text-sm space-y-1">
                <p><strong>Paybill:</strong> 247247</p>
                <p><strong>Account Number:</strong> {config.merchant_code}-[Unit Number]</p>
                <p className="text-muted-foreground text-xs">Example: {config.merchant_code}-A101</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Payments are matched by unit number. If a payment can't be matched automatically, it will appear in your <strong>Unmatched Payments</strong> queue for manual allocation.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* IPN Setup Section */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <h3 className="font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            IPN Setup Instructions
          </h3>
          
          <div className="space-y-3 text-sm">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Step 1: Copy IPN Callback URL</Label>
              <div className="flex gap-2">
                <Input 
                  value={ipnUrl} 
                  readOnly 
                  className="font-mono text-xs bg-background"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(ipnUrl, "IPN URL")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-muted-foreground">Step 2: Register IPN in Jenga Dashboard</Label>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Log in to your <a href="https://v3.jengahq.io/dashboard/settings/create-ipn" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Jenga Dashboard <ExternalLink className="h-3 w-3" /></a></li>
                <li>Go to Settings → IPN Configuration</li>
                <li>Paste the IPN Callback URL above</li>
                <li>Set username and password (use the same values below)</li>
                <li>Enable the IPN</li>
              </ol>
            </div>

            <Alert variant="default" className="border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <strong>Important:</strong> Tell your tenants to use <strong>[MerchantCode]-[UnitNumber]</strong> as the Account Number when paying.
                Example: <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">{config.merchant_code || 'ABC123'}-A101</code>
              </AlertDescription>
            </Alert>
          </div>
        </div>

        <Separator />

        {/* Configuration Form */}
        <div className="space-y-4">
          <h3 className="font-medium">API Credentials</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="merchant-code">Merchant Code *</Label>
              <Input
                id="merchant-code"
                value={config.merchant_code}
                onChange={(e) => setConfig({ ...config, merchant_code: e.target.value })}
                placeholder="Your Jenga merchant code"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paybill">Paybill Number</Label>
              <Input
                id="paybill"
                value={config.paybill_number}
                readOnly
                className="bg-muted"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key">API Key *</Label>
            <Input
              id="api-key"
              type="password"
              value={config.api_key}
              onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
              placeholder={existingConfig ? "••••••••••• (leave blank to keep existing)" : "Your Jenga API key"}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="consumer-secret">Consumer Secret *</Label>
            <Input
              id="consumer-secret"
              type="password"
              value={config.consumer_secret}
              onChange={(e) => setConfig({ ...config, consumer_secret: e.target.value })}
              placeholder={existingConfig ? "••••••••••• (leave blank to keep existing)" : "Your Jenga consumer secret"}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="environment">Environment</Label>
            <Select
              value={config.environment}
              onValueChange={(value: 'sandbox' | 'production') => 
                setConfig({ ...config, environment: value })
              }
            >
              <SelectTrigger id="environment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                <SelectItem value="production">Production (Live)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* IPN Authentication Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium flex items-center gap-2">
              <Key className="h-4 w-4" />
              IPN Authentication
            </h3>
            {config.environment === 'production' && !config.ipn_username && (
              <Badge variant="destructive" className="text-xs">
                Recommended for Production
              </Badge>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground">
            These credentials authenticate IPN callbacks from Jenga. Use the same username/password you configured in the Jenga dashboard.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ipn-username">IPN Username</Label>
              <Input
                id="ipn-username"
                value={config.ipn_username}
                onChange={(e) => setConfig({ ...config, ipn_username: e.target.value })}
                placeholder="e.g., rentflow_ipn"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ipn-password">IPN Password</Label>
              <Input
                id="ipn-password"
                type="password"
                value={config.ipn_password}
                onChange={(e) => setConfig({ ...config, ipn_password: e.target.value })}
                placeholder={existingConfig?.ipn_username ? "••••••••••• (leave blank to keep)" : "Secure password"}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Save Configuration
              </>
            )}
          </Button>

          {existingConfig && (
            <Button
              onClick={testPayment}
              variant="outline"
              disabled={testingPayment}
            >
              {testingPayment ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Payment'
              )}
            </Button>
          )}
        </div>

        {/* Documentation Link */}
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Need help? Visit the{' '}
            <a
              href="https://developer.jengahq.io/guides/jenga-pgw/instant-payment-notifications"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              Jenga PAY IPN Documentation <ExternalLink className="h-3 w-3" />
            </a>
            {' '}or{' '}
            <a
              href="https://v3.jengahq.io/dashboard/settings/create-ipn"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              Jenga IPN Setup Dashboard <ExternalLink className="h-3 w-3" />
            </a>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
