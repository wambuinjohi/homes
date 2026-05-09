
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserCountry } from "@/hooks/useUserCountry";
import { filterPaymentMethodsByCountry, getCountryInfo } from "@/utils/countryService";
import { 
  CreditCard, 
  Smartphone, 
  Building2, 
  Settings,
  Star,
  Shield,
  Check,
  Bell,
  Clock,
  Wallet,
  ArrowRight,
  Info,
  CheckCircle2,
  Copy,
  ExternalLink
} from "lucide-react";

interface PaymentPreference {
  id?: string;
  user_id: string;
  preferred_method: string;
  auto_payment: boolean;
  payment_reminders: boolean;
  reminder_days: number;
  backup_method?: string;
  mpesa_number?: string;
  card_details?: any;
  bank_details?: any;
  payment_limit?: number;
  security_pin?: string;
}

interface LandlordPaymentPreference {
  id: string;
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

interface ApprovedMethod {
  id: string;
  payment_method_type: string;
  provider_name: string;
  country_code: string;
  is_active: boolean;
}

export const TenantPaymentPreferences: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { primaryCountry, loading: countryLoading } = useUserCountry();
  const [preferences, setPreferences] = useState<PaymentPreference>({
    user_id: user?.id || '',
    preferred_method: 'mpesa',
    auto_payment: false,
    payment_reminders: true,
    reminder_days: 3,
    payment_limit: 100000
  });
  const [landlordPaymentPrefs, setLandlordPaymentPrefs] = useState<LandlordPaymentPreference | null>(null);
  const [allApprovedMethods, setAllApprovedMethods] = useState<ApprovedMethod[]>([]);
  const [approvedMethods, setApprovedMethods] = useState<ApprovedMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [paymentInstructions, setPaymentInstructions] = useState('');

  useEffect(() => {
    if (user) {
      loadPreferences();
      loadApprovedMethods();
      loadLandlordPaymentPreferences();
    }
  }, [user]);

  const loadPreferences = async () => {
    try {
      // For now, use localStorage. In production, this would be in Supabase
      const saved = localStorage.getItem(`tenant_payment_preferences_${user?.id}`);
      if (saved) {
        setPreferences(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  const loadLandlordPaymentPreferences = async () => {
    try {
      // Get tenant's current lease to find landlord
      const { data: leaseData, error: leaseError } = await supabase
        .from('leases')
        .select(`
          *,
          units!leases_unit_id_fkey (
            *,
            properties!units_property_id_fkey (
              owner_id,
              manager_id
            )
          )
        `)
        .eq('tenant_id', user?.id)
        .eq('status', 'active')
        .maybeSingle();

      if (leaseError) throw leaseError;

      if (leaseData?.units?.properties?.owner_id) {
        const landlordId = leaseData.units.properties.owner_id;
        
        const { data: landlordPrefs, error: prefsError } = await supabase
          .from('landlord_payment_preferences')
          .select('*')
          .eq('landlord_id', landlordId)
          .maybeSingle();

        if (prefsError && prefsError.code !== 'PGRST116') throw prefsError;
        
        if (landlordPrefs) {
          setLandlordPaymentPrefs({
            id: landlordPrefs.id,
            landlord_id: landlordPrefs.landlord_id,
            preferred_payment_method: landlordPrefs.preferred_payment_method,
            mpesa_phone_number: landlordPrefs.mpesa_phone_number,
            bank_account_details: typeof landlordPrefs.bank_account_details === 'object' && landlordPrefs.bank_account_details !== null 
              ? landlordPrefs.bank_account_details as any
              : {},
            auto_payment_enabled: landlordPrefs.auto_payment_enabled || false,
            payment_reminders_enabled: landlordPrefs.payment_reminders_enabled || true
          });
        }
      }
    } catch (error) {
      console.error('Error loading landlord payment preferences:', error);
    }
  };

  const loadApprovedMethods = async () => {
    try {
      const { data, error } = await supabase
        .from('approved_payment_methods')
        .select('*')
        .eq('is_active', true)
        .order('payment_method_type');

      if (error) throw error;
      setAllApprovedMethods(data || []);
    } catch (error) {
      console.error('Error loading approved methods:', error);
    }
  };

  // Filter payment methods by user's country
  useEffect(() => {
    if (allApprovedMethods.length > 0 && !countryLoading) {
      const filtered = filterPaymentMethodsByCountry(allApprovedMethods, primaryCountry);
      setApprovedMethods(filtered);
    }
  }, [allApprovedMethods, primaryCountry, countryLoading]);

  const savePreferences = async () => {
    try {
      setLoading(true);
      
      // Save to localStorage for now
      localStorage.setItem(`tenant_payment_preferences_${user?.id}`, JSON.stringify(preferences));
      
      toast({
        title: "Success",
        description: "Payment preferences saved successfully",
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Error",
        description: "Failed to save preferences",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = (key: keyof PaymentPreference, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard`,
    });
  };

  const getMethodIcon = (type: string) => {
    switch (type) {
      case 'mpesa':
        return <Smartphone className="h-5 w-5 text-green-600" />;
      case 'card':
      case 'stripe':
        return <CreditCard className="h-5 w-5 text-blue-600" />;
      case 'bank_transfer':
        return <Building2 className="h-5 w-5 text-purple-600" />;
      default:
        return <CreditCard className="h-5 w-5" />;
    }
  };

  const getMethodDisplayName = (method: ApprovedMethod) => {
    return `${method.provider_name} (${method.payment_method_type.toUpperCase()})`;
  };

  return (
    <div className="space-y-8">
      {/* Header with Status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Information</h1>
          <p className="text-muted-foreground mt-2">
            Your landlord's payment details and your preferences
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="flex items-center gap-2">
            <span>{getCountryInfo(primaryCountry).flag}</span>
            {getCountryInfo(primaryCountry).name}
          </Badge>
          <Badge variant={isSetupComplete ? "default" : "outline"} className="flex items-center gap-2">
            {isSetupComplete ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <Clock className="h-3 w-3" />
            )}
            {isSetupComplete ? "Setup Complete" : "Setup Required"}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-2">
            <Shield className="h-3 w-3" />
            Bank-Level Security
          </Badge>
        </div>
      </div>

      {/* Landlord Payment Details */}
      {landlordPaymentPrefs && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Wallet className="h-5 w-5" />
              How to Pay Your Landlord
            </CardTitle>
            <p className="text-sm text-primary/80">
              Use these details to make your rent payments directly to your landlord
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {landlordPaymentPrefs.preferred_payment_method === 'mpesa' && landlordPaymentPrefs.mpesa_phone_number && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Smartphone className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-800">M-Pesa Payment Details</h3>
                    <p className="text-sm text-green-600">Pay directly via M-Pesa</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-green-700 font-medium">Phone Number</Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        value={landlordPaymentPrefs.mpesa_phone_number} 
                        readOnly 
                        className="bg-white border-green-300 text-green-800 font-mono"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(landlordPaymentPrefs.mpesa_phone_number!, "Phone number")}
                        className="border-green-300 text-green-700 hover:bg-green-50"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {landlordPaymentPrefs.preferred_payment_method === 'bank' && landlordPaymentPrefs.bank_account_details && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Building2 className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-purple-800">Bank Transfer Details</h3>
                    <p className="text-sm text-purple-600">Transfer directly to bank account</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {landlordPaymentPrefs.bank_account_details.bank_name && (
                    <div className="space-y-2">
                      <Label className="text-purple-700 font-medium">Bank Name</Label>
                      <Input 
                        value={landlordPaymentPrefs.bank_account_details.bank_name} 
                        readOnly 
                        className="bg-white border-purple-300 text-purple-800"
                      />
                    </div>
                  )}

                  {landlordPaymentPrefs.bank_account_details.account_name && (
                    <div className="space-y-2">
                      <Label className="text-purple-700 font-medium">Account Name</Label>
                      <Input 
                        value={landlordPaymentPrefs.bank_account_details.account_name} 
                        readOnly 
                        className="bg-white border-purple-300 text-purple-800"
                      />
                    </div>
                  )}

                  {landlordPaymentPrefs.bank_account_details.account_number && (
                    <div className="space-y-2">
                      <Label className="text-purple-700 font-medium">Account Number</Label>
                      <div className="flex items-center gap-2">
                        <Input 
                          value={landlordPaymentPrefs.bank_account_details.account_number} 
                          readOnly 
                          className="bg-white border-purple-300 text-purple-800 font-mono"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(landlordPaymentPrefs.bank_account_details!.account_number!, "Account number")}
                          className="border-purple-300 text-purple-700 hover:bg-purple-50"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {landlordPaymentPrefs.bank_account_details.branch && (
                    <div className="space-y-2">
                      <Label className="text-purple-700 font-medium">Branch</Label>
                      <Input 
                        value={landlordPaymentPrefs.bank_account_details.branch} 
                        readOnly 
                        className="bg-white border-purple-300 text-purple-800"
                      />
                    </div>
                  )}

                  {landlordPaymentPrefs.bank_account_details.swift_code && (
                    <div className="space-y-2">
                      <Label className="text-purple-700 font-medium">SWIFT Code</Label>
                      <Input 
                        value={landlordPaymentPrefs.bank_account_details.swift_code} 
                        readOnly 
                        className="bg-white border-purple-300 text-purple-800 font-mono"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {paymentInstructions && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Payment Instructions
                </h4>
                <p className="text-blue-700 text-sm whitespace-pre-wrap">
                  {paymentInstructions}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="card-payment-method">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="icon-bg-white">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-white/90">Primary Method</p>
                <p className="font-semibold text-white capitalize">{preferences.preferred_method.replace('_', ' ')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-auto-pay">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="icon-bg-white">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-white/90">Auto Pay</p>
                <p className="font-semibold text-white">{preferences.auto_payment ? "Enabled" : "Disabled"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="card-reminders">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="icon-bg-white">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-white/90">Reminders</p>
                <p className="font-semibold text-white">{preferences.reminder_days} days before</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Automation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Your Payment Preferences
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure your payment reminders and settings
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Bell className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <div className="font-medium">Payment Reminders</div>
                  <div className="text-sm text-muted-foreground">
                    Get notified before rent payment is due
                  </div>
                </div>
              </div>
              <Switch
                checked={preferences.payment_reminders}
                onCheckedChange={(checked) => updatePreference('payment_reminders', checked)}
              />
            </div>

            {preferences.payment_reminders && (
              <div className="ml-12 space-y-3">
                <Label className="text-sm font-medium">Reminder Timing</Label>
                <Select 
                  value={preferences.reminder_days?.toString()} 
                  onValueChange={(value) => updatePreference('reminder_days', parseInt(value))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day before</SelectItem>
                    <SelectItem value="3">3 days before</SelectItem>
                    <SelectItem value="5">5 days before</SelectItem>
                    <SelectItem value="7">1 week before</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end pt-6 border-t">
        <Button 
          onClick={savePreferences} 
          disabled={loading}
          size="lg"
          className="px-8"
        >
          {loading ? 'Saving Preferences...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
};
