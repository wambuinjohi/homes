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
import { Building2, CheckCircle, XCircle, Loader2, Shield, Info, Copy, Smartphone } from "lucide-react";

export const KCBBuniConfig: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testingPayment, setTestingPayment] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(true);
  const [config, setConfig] = useState({
    merchant_code: '', // Till Number
    api_key: '', // Consumer Key
    consumer_secret: '',
    environment: 'sandbox' as 'sandbox' | 'production',
  });
  const [existingConfig, setExistingConfig] = useState<any>(null);
  const [ipnUrl, setIpnUrl] = useState('');

  useEffect(() => {
    checkAvailability();
    loadConfig();
    const callbackUrl = `https://kdpqimetajnhcqseajok.supabase.co/functions/v1/kcb-ipn-callback`;
    setIpnUrl(callbackUrl);
  }, []);

  const checkAvailability = async () => {
    try {
      const { data, error } = await supabase
        .from('approved_payment_methods')
        .select('is_active')
        .eq('payment_method_type', 'kcb_buni')
        .eq('country_code', 'KE')
        .maybeSingle();

      if (error) throw error;
      setIsEnabled(data?.is_active || false);
    } catch (error) {
      console.error('Error checking KCB Buni availability:', error);
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
        .from('landlord_bank_configs')
        .select('*')
        .eq('landlord_id', user.id)
        .eq('bank_code', 'kcb')
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
          environment: (data.environment as 'sandbox' | 'production') || 'sandbox',
        });
      }
    } catch (error) {
      console.error('Error loading KCB config:', error);
      toast({
        title: "Error",
        description: "Failed to load KCB Buni configuration",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !config.merchant_code) {
      toast({
        title: "Missing Fields",
        description: "Please fill in the Till Number",
        variant: "destructive"
      });
      return;
    }

    // Only require credentials for new configs or if explicitly updating
    if (!existingConfig && (!config.api_key || !config.consumer_secret)) {
      toast({
        title: "Missing Fields",
        description: "Please fill in Consumer Key and Consumer Secret",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const updateData: any = {
        landlord_id: user.id,
        bank_code: 'kcb',
        merchant_code: config.merchant_code,
        environment: config.environment,
        ipn_url: ipnUrl,
        is_active: true,
        credentials_verified: false
      };

      // Only update encrypted fields if new values provided
      if (config.api_key) {
        updateData.api_key_encrypted = config.api_key;
      }
      if (config.consumer_secret) {
        updateData.consumer_secret_encrypted = config.consumer_secret;
      }

      const { error } = await supabase
        .from('landlord_bank_configs')
        .upsert(updateData, { 
          onConflict: 'landlord_id,bank_code'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "KCB Buni configuration saved successfully"
      });

      await loadConfig();
    } catch (error) {
      console.error('Error saving KCB config:', error);
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
      const { data, error } = await supabase.functions.invoke('kcb-stk-push', {
        body: {
          phone: user.phone || '254722000000',
          amount: 1,
          accountReference: 'TEST-PAYMENT',
          transactionDesc: 'KCB Buni Configuration Test',
          landlordId: user.id
        }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        toast({
          title: "STK Push Sent",
          description: `Check your phone. You should receive an M-Pesa prompt.`
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

  if (checkingAvailability) {
    return null;
  }

  if (!isEnabled) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-green-600" />
          KCB Bank - Buni M-Pesa Configuration
        </CardTitle>
        <CardDescription>
          Configure your KCB Buni credentials to accept payments via paybill 522522
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
          </div>
        )}

        {/* Dual Payment Support Info */}
        <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle>Two Ways to Pay</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>Your tenants can pay using <strong>KCB Paybill 522522</strong> in two ways:</p>
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
                  <p className="text-sm text-muted-foreground">Tenant pays to 522522 using <strong>{config.merchant_code || '[TillNumber]'}-[UnitNumber]</strong> as account</p>
                </div>
              </div>
            </div>
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
                <p><strong>Paybill:</strong> 522522</p>
                <p><strong>Account Number:</strong> {config.merchant_code}-[Unit Number]</p>
                <p className="text-muted-foreground text-xs">Example: {config.merchant_code}-A101</p>
              </div>
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
              <Label className="text-muted-foreground">Callback URL for KCB Buni Dashboard</Label>
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
              <Label className="text-muted-foreground">Setup Steps</Label>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Log in to your KCB Buni Developer Portal</li>
                <li>Go to your application settings</li>
                <li>Configure the callback URL with the URL above</li>
                <li>Save and test the integration</li>
              </ol>
            </div>
          </div>
        </div>

        <Separator />

        {/* Configuration Form */}
        <div className="space-y-4">
          <h3 className="font-medium">API Credentials</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="merchant-code">Till Number *</Label>
              <Input
                id="merchant-code"
                value={config.merchant_code}
                onChange={(e) => setConfig({ ...config, merchant_code: e.target.value })}
                placeholder="Your KCB Till number"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">Your assigned KCB Buni till number</p>
            </div>

            <div className="space-y-2">
              <Label>Paybill Number</Label>
              <Input
                value="522522"
                readOnly
                className="bg-muted"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key">Consumer Key *</Label>
            <Input
              id="api-key"
              type="password"
              value={config.api_key}
              onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
              placeholder={existingConfig ? "••••••••••• (leave blank to keep existing)" : "Your KCB Buni Consumer Key"}
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
              placeholder={existingConfig ? "••••••••••• (leave blank to keep existing)" : "Your KCB Buni Consumer Secret"}
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

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button
            onClick={handleSave}
            disabled={loading || !config.merchant_code}
            className="flex-1"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </Button>
          
          {existingConfig?.is_active && (
            <Button
              variant="outline"
              onClick={testPayment}
              disabled={testingPayment}
            >
              {testingPayment ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Smartphone className="mr-2 h-4 w-4" />
                  Test Payment (1 KES)
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
