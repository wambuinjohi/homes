
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  CreditCard, 
  Smartphone, 
  Building2, 
  Settings,
  Star,
  Shield,
  Check,
  Save,
  AlertCircle,
  Info
} from "lucide-react";

interface PaymentPreference {
  id?: string;
  landlord_id: string;
  preferred_payment_method: string;
  mpesa_phone_number?: string;
  bank_account_details?: {
    bank_name?: string;
    account_name?: string;
    account_number?: string;
    branch?: string;
    swift_code?: string;
  };
  auto_payment_enabled: boolean;
  payment_reminders_enabled: boolean;
}

export const LandlordPaymentPreferences: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<PaymentPreference>({
    landlord_id: user?.id || '',
    preferred_payment_method: 'mpesa',
    auto_payment_enabled: false,
    payment_reminders_enabled: true
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [mpesaDetails, setMpesaDetails] = useState({
    paybill_number: '',
    account_number: '',
    business_name: '',
    phone_number: ''
  });

  useEffect(() => {
    if (user) {
      loadPreferences();
    }
  }, [user]);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('landlord_payment_preferences')
        .select('*')
        .eq('landlord_id', user?.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setPreferences({
          id: data.id,
          landlord_id: data.landlord_id,
          preferred_payment_method: data.preferred_payment_method,
          mpesa_phone_number: data.mpesa_phone_number || '',
          bank_account_details: typeof data.bank_account_details === 'object' && data.bank_account_details !== null 
            ? data.bank_account_details as any 
            : {},
          auto_payment_enabled: data.auto_payment_enabled || false,
          payment_reminders_enabled: data.payment_reminders_enabled || true
        });
        
        // Handle M-Pesa details if they exist in a separate way
        if (data.mpesa_phone_number) {
          setMpesaDetails(prev => ({
            ...prev,
            phone_number: data.mpesa_phone_number
          }));
        }
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
      toast({
        title: "Error",
        description: "Failed to load payment preferences",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('landlord_payment_preferences')
        .upsert({
          landlord_id: preferences.landlord_id,
          preferred_payment_method: preferences.preferred_payment_method,
          mpesa_phone_number: preferences.preferred_payment_method === 'mpesa' ? mpesaDetails.phone_number : null,
          bank_account_details: preferences.preferred_payment_method === 'bank' ? preferences.bank_account_details : null,
          auto_payment_enabled: preferences.auto_payment_enabled,
          payment_reminders_enabled: preferences.payment_reminders_enabled
        }, { onConflict: 'landlord_id' });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payment preferences saved successfully",
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Error",
        description: "Failed to save payment preferences",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (key: keyof PaymentPreference, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const updateMpesaDetails = (key: string, value: string) => {
    setMpesaDetails(prev => ({ ...prev, [key]: value }));
  };

  const updateBankDetails = (key: string, value: string) => {
    setPreferences(prev => ({
      ...prev,
      bank_account_details: { ...prev.bank_account_details, [key]: value }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Preferences</h1>
          <p className="text-muted-foreground">
            Configure how tenants should pay you directly
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={preferences.auto_payment_enabled ? "default" : "secondary"}>
            {preferences.auto_payment_enabled ? "Auto Payment" : "Manual Payment"}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Shield className="h-3 w-3" />
            Secure
          </Badge>
        </div>
      </div>

      {/* Info Alert */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-900">
                Direct Tenant Payments
              </p>
              <p className="text-sm text-blue-700">
                Configure your payment details so tenants can pay you directly. These details will be shown to tenants on their payment page and invoices.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Method Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Preferred Payment Method
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div
              className={`group flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                preferences.preferred_payment_method === 'mpesa'
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => updatePreference('preferred_payment_method', 'mpesa')}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${
                  preferences.preferred_payment_method === 'mpesa'
                    ? 'bg-primary/10'
                    : 'bg-muted'
                }`}>
                  <Smartphone className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="font-semibold">M-Pesa</div>
                  <div className="text-sm text-muted-foreground">
                    Mobile money payments
                  </div>
                </div>
              </div>
              {preferences.preferred_payment_method === 'mpesa' && (
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  <Star className="h-3 w-3 mr-1" />
                  Selected
                </Badge>
              )}
            </div>

            <div
              className={`group flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                preferences.preferred_payment_method === 'bank'
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => updatePreference('preferred_payment_method', 'bank')}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${
                  preferences.preferred_payment_method === 'bank'
                    ? 'bg-primary/10'
                    : 'bg-muted'
                }`}>
                  <Building2 className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <div className="font-semibold">Bank Transfer</div>
                  <div className="text-sm text-muted-foreground">
                    Direct bank account transfer
                  </div>
                </div>
              </div>
              {preferences.preferred_payment_method === 'bank' && (
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  <Star className="h-3 w-3 mr-1" />
                  Selected
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* M-Pesa Details */}
      {preferences.preferred_payment_method === 'mpesa' && (
        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Smartphone className="h-5 w-5" />
              M-Pesa Payment Details
            </CardTitle>
            <p className="text-sm text-green-700">
              Configure your M-Pesa details for tenant payments
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paybill">Paybill Number</Label>
                <Input
                  id="paybill"
                  placeholder="e.g., 400200"
                  value={mpesaDetails.paybill_number || ''}
                  onChange={(e) => updateMpesaDetails('paybill_number', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account">Account Number</Label>
                <Input
                  id="account"
                  placeholder="e.g., 12345"
                  value={mpesaDetails.account_number || ''}
                  onChange={(e) => updateMpesaDetails('account_number', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business">Business Name</Label>
                <Input
                  id="business"
                  placeholder="Your business name"
                  value={mpesaDetails.business_name || ''}
                  onChange={(e) => updateMpesaDetails('business_name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+254712345678"
                  value={mpesaDetails.phone_number || ''}
                  onChange={(e) => updateMpesaDetails('phone_number', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bank Details */}
      {preferences.preferred_payment_method === 'bank' && (
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <Building2 className="h-5 w-5" />
              Bank Account Details
            </CardTitle>
            <p className="text-sm text-purple-700">
              Configure your bank details for tenant payments
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bank-name">Bank Name</Label>
                <Input
                  id="bank-name"
                  placeholder="e.g., KCB Bank"
                  value={preferences.bank_account_details?.bank_name || ''}
                  onChange={(e) => updateBankDetails('bank_name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-name">Account Name</Label>
                <Input
                  id="account-name"
                  placeholder="Account holder name"
                  value={preferences.bank_account_details?.account_name || ''}
                  onChange={(e) => updateBankDetails('account_name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank-account">Account Number</Label>
                <Input
                  id="bank-account"
                  placeholder="Account number"
                  value={preferences.bank_account_details?.account_number || ''}
                  onChange={(e) => updateBankDetails('account_number', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch">Branch</Label>
                <Input
                  id="branch"
                  placeholder="Branch name/code"
                  value={preferences.bank_account_details?.branch || ''}
                  onChange={(e) => updateBankDetails('branch', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="swift">SWIFT Code (Optional)</Label>
                <Input
                  id="swift"
                  placeholder="For international transfers"
                  value={preferences.bank_account_details?.swift_code || ''}
                  onChange={(e) => updateBankDetails('swift_code', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Payment Instructions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Optional instructions that will be shown to tenants
          </p>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="e.g., Please include your unit number as reference when making payment..."
            value={paymentInstructions}
            onChange={(e) => setPaymentInstructions(e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Auto Payment Processing</Label>
              <p className="text-xs text-muted-foreground">
                Enable automatic payment processing for tenant payments
              </p>
            </div>
            <Switch 
              checked={preferences.auto_payment_enabled}
              onCheckedChange={(checked) => updatePreference('auto_payment_enabled', checked)}
            />
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Payment Reminders</Label>
              <p className="text-xs text-muted-foreground">
                Send payment reminders to tenants before due dates
              </p>
            </div>
            <Switch 
              checked={preferences.payment_reminders_enabled}
              onCheckedChange={(checked) => updatePreference('payment_reminders_enabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end pt-6 border-t">
        <Button 
          onClick={savePreferences} 
          disabled={saving}
          size="lg"
          className="px-8"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Payment Preferences
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
