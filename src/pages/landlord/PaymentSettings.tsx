import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaymentSettingsForm } from "@/components/landlord/PaymentSettingsForm";
import { MpesaCredentialsSection } from "@/components/landlord/MpesaCredentialsSection";
import { BankVerificationSection } from "@/components/landlord/BankVerificationSection";
import { JengaPayConfig } from "@/components/landlord/JengaPayConfig";
import { KCBBuniConfig } from "@/components/landlord/KCBBuniConfig";
import { CreditCard, Check, Shield, Settings, Smartphone, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useUserCountry } from "@/hooks/useUserCountry";
import { usePaymentMethodMetadata } from "@/hooks/usePaymentMethodMetadata";
import { filterPaymentMethodsByCountry, getCountryInfo } from "@/utils/countryService";

interface ApprovedMethod {
  id: string;
  payment_method_type: string;
  provider_name: string;
  is_active: boolean;
  country_code: string;
  configuration?: any;
}

interface PaymentPreferences {
  preferred_payment_method: string;
  mpesa_phone_number?: string;
  mpesa_config_preference?: 'custom' | 'platform_default';
  bank_account_details?: {
    bank_name?: string;
    account_name?: string;
    account_number?: string;
    branch?: string;
    swift_code?: string;
  };
  payment_instructions?: string;
  auto_payment_enabled: boolean;
  payment_reminders_enabled: boolean;
}

const PaymentSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { primaryCountry, loading: countryLoading, detectedFrom, confidence } = useUserCountry();
  const { getLabel } = usePaymentMethodMetadata(primaryCountry);
  const [allApprovedMethods, setAllApprovedMethods] = useState<ApprovedMethod[]>([]);
  const [approvedMethods, setApprovedMethods] = useState<ApprovedMethod[]>([]);
  const [preferences, setPreferences] = useState<PaymentPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [hasMpesaConfig, setHasMpesaConfig] = useState(false);

  // Filter payment methods by user's country when country is detected
  useEffect(() => {
    if (allApprovedMethods.length > 0 && !countryLoading) {
      const filtered = filterPaymentMethodsByCountry(allApprovedMethods, primaryCountry);
      setApprovedMethods(filtered);
    }
  }, [allApprovedMethods, primaryCountry, countryLoading]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Reload payment preferences when M-Pesa config is added
  useEffect(() => {
    if (hasMpesaConfig && user) {
      loadData();
    }
  }, [hasMpesaConfig]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load all approved payment methods
      const { data: methods, error: methodsError } = await supabase
        .from('approved_payment_methods')
        .select('*')
        .eq('is_active', true)
        .order('payment_method_type');

      if (methodsError) throw methodsError;
      setAllApprovedMethods(methods || []);

      // Load landlord payment preferences
      const { data: prefs, error: prefsError } = await supabase
        .from('landlord_payment_preferences')
        .select('*')
        .eq('landlord_id', user?.id)
        .maybeSingle();

      if (prefsError && prefsError.code !== 'PGRST116') throw prefsError;
      
      // Transform prefs data to match interface
      const transformedPrefs = prefs ? {
        preferred_payment_method: prefs.preferred_payment_method || 'mpesa',
        mpesa_phone_number: prefs.mpesa_phone_number || '',
        mpesa_config_preference: ((prefs as any).mpesa_config_preference === 'custom' ? 'custom' : 'platform_default') as 'custom' | 'platform_default',
        bank_account_details: typeof prefs.bank_account_details === 'object' && prefs.bank_account_details 
          ? prefs.bank_account_details as any
          : null,
        payment_instructions: (prefs as any).payment_instructions || '',
        auto_payment_enabled: prefs.auto_payment_enabled || false,
        payment_reminders_enabled: prefs.payment_reminders_enabled || true,
      } : {
        preferred_payment_method: 'mpesa',
        mpesa_phone_number: '',
        mpesa_config_preference: 'platform_default' as const,
        bank_account_details: null,
        payment_instructions: '',
        auto_payment_enabled: false,
        payment_reminders_enabled: true,
      };
      
      setPreferences(transformedPrefs);

    } catch (error) {
      console.error('Error loading payment data:', error);
      toast({
        title: "Error",
        description: "Failed to load payment settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async (newPreferences: PaymentPreferences) => {
    setPreferences(newPreferences);
    setShowEditForm(false);
    toast({
      title: "Settings Saved",
      description: "Your payment preferences have been updated successfully.",
    });
  };

  const getPaymentMethodIcon = (type: string) => {
    switch (type) {
      case 'mpesa': return '📱';
      case 'card': return '💳';
      case 'bank_transfer': return '🏦';
      default: return '💰';
    }
  };

  const getPaymentMethodLabel = (type: string, provider: string) => {
    return getLabel(type) || provider || type;
  };

  // Check if M-Pesa is available as a payment method
  const hasMpesaMethod = approvedMethods.some(method => method.payment_method_type === 'mpesa');

  const handleMpesaConfigChange = (hasConfig: boolean) => {
    setHasMpesaConfig(hasConfig);
  };

  const handleMpesaPreferenceChange = async () => {
    // Reload data when M-Pesa preference changes
    console.log('M-Pesa preference changed - refreshing payment settings...');
    await loadData();
  };

  if (loading || countryLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-3 sm:p-4 lg:p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="bg-tint-gray p-3 sm:p-4 lg:p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-primary">Payment Settings</h1>
            <p className="text-muted-foreground">
              Manage your payment methods and preferences
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <span>{getCountryInfo(primaryCountry).flag}</span>
              {getCountryInfo(primaryCountry).name}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Shield className="h-3 w-3" />
              Secure
            </Badge>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* M-Pesa Configuration - Show prominently if M-Pesa is available */}
          {hasMpesaMethod && (
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5 text-green-600" />
                    M-Pesa Integration Setup
                    {hasMpesaConfig && (
                      <Badge variant="default" className="gap-1">
                        <Check className="h-3 w-3" />
                        Configured
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Configure your M-Pesa credentials so tenant payments go directly to your paybill/till number
                  </p>
                </CardHeader>
                <CardContent>
                  <MpesaCredentialsSection 
                    onConfigChange={handleMpesaConfigChange}
                    onPreferenceChange={handleMpesaPreferenceChange}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Equity Bank - Jenga PAY Configuration */}
          <div className="lg:col-span-2">
            <JengaPayConfig />
          </div>

          {/* KCB Bank - Buni Configuration */}
          <div className="lg:col-span-2">
            <KCBBuniConfig />
          </div>

          {/* Other Bank Integrations (excludes Equity and KCB) */}
          <div className="lg:col-span-2">
            <BankVerificationSection onVerificationChange={loadData} />
          </div>

          {/* Approved Payment Methods */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-success" />
                Available Payment Methods
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Payment methods available in {getCountryInfo(primaryCountry).name}
                {detectedFrom !== 'default' && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Auto-detected from {detectedFrom}
                  </Badge>
                )}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {approvedMethods.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No payment methods available for {getCountryInfo(primaryCountry).name}</p>
                  <p className="text-xs">Contact administrator to add payment methods for your country</p>
                  {allApprovedMethods.length > 0 && (
                    <p className="text-xs mt-2">
                      {allApprovedMethods.length} method(s) available in other countries
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {approvedMethods.map((method) => (
                    <div
                      key={method.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">
                          {getPaymentMethodIcon(method.payment_method_type)}
                        </span>
                        <div>
                          <p className="font-medium">
                            {getPaymentMethodLabel(method.payment_method_type, method.provider_name)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {method.country_code}
                          </p>
                        </div>
                      </div>
                      <Badge variant="default">
                        <Check className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Payment Preferences
                </div>
                {!showEditForm && preferences && (
                  <button
                    onClick={() => setShowEditForm(true)}
                    className="text-sm text-primary hover:underline"
                  >
                    Edit
                  </button>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure your payment methods and tenant payment options
              </p>
            </CardHeader>
            <CardContent>
              {showEditForm ? (
                <PaymentSettingsForm
                  billingData={{
                    approved_payment_methods: approvedMethods,
                    payment_preferences: preferences!
                  }}
                  onSave={handleSavePreferences}
                  onCancel={() => setShowEditForm(false)}
                  hasMpesaConfig={hasMpesaConfig}
                />
              ) : preferences ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm font-medium">Preferred Method</span>
                    <span className="text-sm">
                      {getPaymentMethodLabel(
                        preferences.preferred_payment_method,
                        approvedMethods.find(m => m.payment_method_type === preferences.preferred_payment_method)?.provider_name || ''
                      )}
                    </span>
                  </div>
                  
                  {preferences.preferred_payment_method === 'mpesa' && (
                    <>
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm font-medium">M-Pesa Configuration</span>
                        <Badge variant={preferences.mpesa_config_preference === 'custom' ? 'default' : 'secondary'} className="gap-1">
                          {preferences.mpesa_config_preference === 'custom' ? (
                            <>
                              <Check className="h-3 w-3" />
                              Using Your Custom Credentials
                            </>
                          ) : (
                            'Platform Defaults'
                          )}
                        </Badge>
                      </div>
                      {preferences.mpesa_phone_number && (
                        <div className="flex items-center justify-between py-2 border-b">
                          <span className="text-sm font-medium">M-Pesa Number</span>
                          <span className="text-sm font-mono">
                            {preferences.mpesa_phone_number}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                  
                   {preferences.preferred_payment_method === 'bank_transfer' && preferences.bank_account_details && (
                     <div className="space-y-2">
                       {(preferences.bank_account_details as any)?.bank_name && (
                         <div className="flex items-center justify-between py-1 border-b">
                           <span className="text-sm font-medium">Bank</span>
                           <span className="text-sm">{(preferences.bank_account_details as any).bank_name}</span>
                         </div>
                       )}
                       {(preferences.bank_account_details as any)?.account_number && (
                         <div className="flex items-center justify-between py-1 border-b">
                           <span className="text-sm font-medium">Account</span>
                           <span className="text-sm font-mono">{(preferences.bank_account_details as any).account_number}</span>
                         </div>
                       )}
                     </div>
                   )}
                   
                   {preferences.payment_instructions && (
                     <div className="space-y-2">
                       <span className="text-sm font-medium">Payment Instructions</span>
                       <p className="text-sm text-muted-foreground p-2 bg-muted rounded">
                         {preferences.payment_instructions}
                       </p>
                     </div>
                   )}
                   
                   <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm font-medium">Auto Payment</span>
                    <Badge variant={preferences.auto_payment_enabled ? "default" : "secondary"}>
                      {preferences.auto_payment_enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium">Payment Reminders</span>
                    <Badge variant={preferences.payment_reminders_enabled ? "default" : "secondary"}>
                      {preferences.payment_reminders_enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No preferences set</p>
                  <button
                    onClick={() => setShowEditForm(true)}
                    className="text-primary hover:underline text-sm mt-2"
                  >
                    Set up payment preferences
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payment Rules Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Payment Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-medium">Security & Privacy</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• All payment data is encrypted</li>
                  <li>• PCI DSS compliant processing</li>
                  <li>• No card details stored locally</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Support</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 24/7 payment support available</li>
                  <li>• Transaction monitoring</li>
                  <li>• Dispute resolution assistance</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PaymentSettings;