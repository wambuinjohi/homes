import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, CreditCard, AlertCircle, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useToast } from "@/hooks/use-toast";
import { useUserCountry } from "@/hooks/useUserCountry";
import { filterPaymentMethodsByCountry } from "@/utils/countryService";
import { MpesaCredentialsSection } from "./MpesaCredentialsSection";
import { usePhoneValidation } from "@/hooks/usePhoneValidation";
import { usePaymentMethodMetadata } from "@/hooks/usePaymentMethodMetadata";

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

interface ApprovedMethod {
  id: string;
  payment_method_type: string;
  provider_name: string;
  is_active: boolean;
  country_code: string;
}

interface BillingData {
  approved_payment_methods: ApprovedMethod[];
  payment_preferences: PaymentPreferences;
}

interface PaymentSettingsFormProps {
  billingData: BillingData | null;
  onSave: (preferences: PaymentPreferences) => void;
  onCancel: () => void;
  hasMpesaConfig?: boolean;
}

export const PaymentSettingsForm: React.FC<PaymentSettingsFormProps> = ({
  billingData,
  onSave,
  onCancel,
  hasMpesaConfig = false
}) => {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { toast } = useToast();
  const { primaryCountry, loading: countryLoading } = useUserCountry();
  const { formatPhone, placeholder, countryCode } = usePhoneValidation();
  const { getLabel } = usePaymentMethodMetadata(primaryCountry);
  const [saving, setSaving] = useState(false);
  const [allApprovedMethods, setAllApprovedMethods] = useState<ApprovedMethod[]>([]);
  const [approvedMethods, setApprovedMethods] = useState<ApprovedMethod[]>([]);
  const [bankDetailsOpen, setBankDetailsOpen] = useState(false);
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState('mpesa');
  
  // Get landlord's phone number with dynamic country formatting
  const landlordPhone = profile?.phone ? formatPhone(profile.phone) : `${countryCode}700000000`;
  
  const [preferences, setPreferences] = useState<PaymentPreferences>({
    preferred_payment_method: defaultPaymentMethod,
    mpesa_phone_number: landlordPhone,
    mpesa_config_preference: 'platform_default',
    bank_account_details: {
      bank_name: '',
      account_name: '',
      account_number: '',
      branch: '',
      swift_code: '',
    },
    payment_instructions: '',
    auto_payment_enabled: billingData?.payment_preferences.auto_payment_enabled || false,
    payment_reminders_enabled: billingData?.payment_preferences.payment_reminders_enabled || true,
  });

  // Fetch approved payment methods and default payment method
  useEffect(() => {
    const fetchPaymentConfig = async () => {
      try {
        // Fetch approved methods
        const { data: methodsData, error: methodsError } = await supabase
          .from('approved_payment_methods')
          .select('*')
          .eq('is_active', true)
          .order('payment_method_type');

        if (methodsError) throw methodsError;
        setAllApprovedMethods(methodsData || []);

        // Fetch default payment method for user's country
        const { data: defaultsData, error: defaultsError } = await supabase
          .from('billing_settings')
          .select('setting_value')
          .eq('setting_key', 'default_payment_methods')
          .single();

        if (!defaultsError && defaultsData) {
          const defaults = defaultsData.setting_value as any;
          const countryDefault = defaults[primaryCountry] || defaults['default'] || 'bank_transfer';
          setDefaultPaymentMethod(countryDefault);
          
          // Update preferences if not already set
          setPreferences(prev => ({
            ...prev,
            preferred_payment_method: prev.preferred_payment_method || countryDefault
          }));
        }
      } catch (error) {
        console.error('Error fetching payment configuration:', error);
        setAllApprovedMethods([]);
      }
    };

    fetchPaymentConfig();
  }, [primaryCountry]);

  // Filter payment methods by user's country
  useEffect(() => {
    if (allApprovedMethods.length > 0 && !countryLoading) {
      const filtered = filterPaymentMethodsByCountry(allApprovedMethods, primaryCountry);
      setApprovedMethods(filtered);
    }
  }, [allApprovedMethods, primaryCountry, countryLoading]);

  // Update preferences when profile loads or approved methods change
  useEffect(() => {
    if (billingData?.payment_preferences) {
      const bankDetails = typeof billingData.payment_preferences.bank_account_details === 'object' 
        ? billingData.payment_preferences.bank_account_details as any
        : {};
        
      // Check if bank details are empty to decide if we should open the section
      const hasExistingBankDetails = bankDetails?.bank_name || bankDetails?.account_number;
      setBankDetailsOpen(!hasExistingBankDetails); // Open by default if no existing details
        
      setPreferences(prev => ({
        ...prev,
        preferred_payment_method: billingData.payment_preferences.preferred_payment_method || 'mpesa',
        mpesa_phone_number: billingData.payment_preferences.mpesa_phone_number || landlordPhone,
        mpesa_config_preference: (billingData.payment_preferences as any).mpesa_config_preference || 'platform_default',
        bank_account_details: {
          bank_name: bankDetails?.bank_name || '',
          account_name: bankDetails?.account_name || '',
          account_number: bankDetails?.account_number || '',
          branch: bankDetails?.branch || '',
          swift_code: bankDetails?.swift_code || '',
        },
        payment_instructions: (billingData.payment_preferences as any).payment_instructions || '',
        auto_payment_enabled: billingData.payment_preferences.auto_payment_enabled || false,
        payment_reminders_enabled: billingData.payment_preferences.payment_reminders_enabled || true,
      }));
    } else {
      // If no existing preferences, use defaults and open bank details for setup
      setBankDetailsOpen(true);
      setPreferences(prev => ({
        ...prev,
        mpesa_phone_number: landlordPhone,
      }));
    }
  }, [billingData, landlordPhone]);

  // Use dynamic payment method labels from metadata
  const getPaymentMethodLabel = (type: string, provider: string) => {
    return getLabel(type) || provider || type;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validate M-Pesa phone number if selected
      if (preferences.preferred_payment_method === 'mpesa' && !preferences.mpesa_phone_number) {
        toast({
          title: "Validation Error",
          description: "M-Pesa phone number is required when M-Pesa is selected as preferred method.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }

      // Phone validation removed - now handled dynamically via usePhoneValidation hook

      // Save to database
      const { error } = await supabase
        .from('landlord_payment_preferences')
        .upsert({
          landlord_id: user?.id,
          preferred_payment_method: preferences.preferred_payment_method,
          mpesa_phone_number: preferences.mpesa_phone_number,
          mpesa_config_preference: preferences.mpesa_config_preference,
          bank_account_details: preferences.bank_account_details,
          payment_instructions: preferences.payment_instructions,
          auto_payment_enabled: preferences.auto_payment_enabled,
          payment_reminders_enabled: preferences.payment_reminders_enabled,
        });

      if (error) throw error;

      onSave(preferences);
    } catch (error) {
      console.error('Error saving payment preferences:', error);
      toast({
        title: "Error",
        description: "Failed to save payment preferences. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-1">
      {/* Configuration Status Alert */}
      {!hasMpesaConfig && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                M-Pesa Configuration Required
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Configure your M-Pesa API credentials in the M-Pesa Integration Setup section above to enable direct payments from tenants. 
                You can also use platform defaults if you don't have your own M-Pesa integration.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Preferred Payment Method */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Preferred Payment Method
        </Label>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          This will be the default payment method shown to your tenants
        </p>
        <Select 
          value={preferences.preferred_payment_method}
          onValueChange={(value) => {
            setPreferences(prev => ({
              ...prev,
              preferred_payment_method: value
            }));
          }}
        >
          <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
            {approvedMethods.map(method => (
              <SelectItem 
                key={method.id} 
                value={method.payment_method_type}
                className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {getPaymentMethodLabel(method.payment_method_type, method.provider_name)}
              </SelectItem>
            ))}
            {/* Add bank transfer option */}
            <SelectItem 
              value="bank_transfer"
              className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Bank Transfer
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* M-Pesa Configuration Selection */}
      {preferences.preferred_payment_method === 'mpesa' && hasMpesaConfig && (
        <div className="space-y-3">
          <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">
            M-Pesa Configuration
          </Label>
          <Select 
            value={preferences.mpesa_config_preference || 'platform_default'}
            onValueChange={(value: 'custom' | 'platform_default') => {
              setPreferences(prev => ({
                ...prev,
                mpesa_config_preference: value
              }));
            }}
          >
            <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
              <SelectItem 
                value="custom"
                className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Use My Custom M-Pesa Credentials
              </SelectItem>
              <SelectItem 
                value="platform_default"
                className="text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Use Platform Default M-Pesa
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {preferences.mpesa_config_preference === 'custom' 
              ? 'Payments will go directly to your configured paybill/till number' 
              : 'Payments will use the platform\'s M-Pesa configuration'}
          </p>
        </div>
      )}

      {/* M-Pesa Phone Number */}
      {preferences.preferred_payment_method === 'mpesa' && (
        <div className="space-y-3">
          <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">
            M-Pesa Phone Number
          </Label>
          <Input 
            type="tel"
            placeholder="+254701234567"
            value={preferences.mpesa_phone_number || ''}
            onChange={(e) => {
              setPreferences(prev => ({
                ...prev,
                mpesa_phone_number: e.target.value
              }));
            }}
            className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Enter your M-Pesa registered phone number (format: +254XXXXXXXXX)
          </p>
        </div>
      )}

      {/* Jenga PAY Configuration */}
      {preferences.preferred_payment_method === 'bank_transfer' && (
        <div className="space-y-3 border border-green-200 dark:border-green-800 rounded-lg p-4 bg-green-50 dark:bg-green-950">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-green-600" />
            <h4 className="font-medium text-green-900 dark:text-green-100">
              Equity Bank - Jenga PAY
            </h4>
          </div>
          <p className="text-sm text-green-700 dark:text-green-300">
            Accept payments via Equity Bank paybill 247247. Configure your Jenga PAY credentials
            in the M-Pesa Integration Setup section above to enable instant payment notifications.
          </p>
        </div>
      )}

      {/* Bank Account Details - Always visible for easy access */}
      <div className="space-y-4 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <Collapsible open={bankDetailsOpen} onOpenChange={setBankDetailsOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
            <div className="flex items-center gap-3">
              {bankDetailsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <CreditCard className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Bank Account Details</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">For bank transfer payments</p>
              </div>
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Bank Name
                </Label>
                <Input 
                  type="text"
                  placeholder="e.g., KCB Bank"
                  value={preferences.bank_account_details?.bank_name || ''}
                  onChange={(e) => {
                    setPreferences(prev => ({
                      ...prev,
                      bank_account_details: {
                        ...prev.bank_account_details,
                        bank_name: e.target.value
                      }
                    }));
                  }}
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Account Name
                </Label>
                <Input 
                  type="text"
                  placeholder="Account holder name"
                  value={preferences.bank_account_details?.account_name || ''}
                  onChange={(e) => {
                    setPreferences(prev => ({
                      ...prev,
                      bank_account_details: {
                        ...prev.bank_account_details,
                        account_name: e.target.value
                      }
                    }));
                  }}
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Account Number
                </Label>
                <Input 
                  type="text"
                  placeholder="Bank account number"
                  value={preferences.bank_account_details?.account_number || ''}
                  onChange={(e) => {
                    setPreferences(prev => ({
                      ...prev,
                      bank_account_details: {
                        ...prev.bank_account_details,
                        account_number: e.target.value
                      }
                    }));
                  }}
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Branch
                </Label>
                <Input 
                  type="text"
                  placeholder="Branch name/code"
                  value={preferences.bank_account_details?.branch || ''}
                  onChange={(e) => {
                    setPreferences(prev => ({
                      ...prev,
                      bank_account_details: {
                        ...prev.bank_account_details,
                        branch: e.target.value
                      }
                    }));
                  }}
                  className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            
            <div className="space-y-2 mt-4">
              <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                SWIFT Code (Optional)
              </Label>
              <Input 
                type="text"
                placeholder="For international transfers"
                value={preferences.bank_account_details?.swift_code || ''}
                onChange={(e) => {
                  setPreferences(prev => ({
                    ...prev,
                    bank_account_details: {
                      ...prev.bank_account_details,
                      swift_code: e.target.value
                    }
                  }));
                }}
                className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Payment Instructions */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Additional Payment Instructions (Optional)
        </Label>
        <Textarea
          placeholder="Any additional instructions for tenants making payments..."
          value={preferences.payment_instructions || ''}
          onChange={(e) => {
            setPreferences(prev => ({
              ...prev,
              payment_instructions: e.target.value
            }));
          }}
          rows={3}
          className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <p className="text-xs text-gray-600 dark:text-gray-400">
          These instructions will be shown to tenants when they make payments
        </p>
      </div>

      {/* Auto Payment */}
      <div className="flex items-center justify-between py-2">
        <div className="space-y-1">
          <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Auto Payment
          </Label>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Automatically pay service charges when due
          </p>
        </div>
        <Switch 
          checked={preferences.auto_payment_enabled}
          onCheckedChange={(checked) => {
            setPreferences(prev => ({
              ...prev,
              auto_payment_enabled: checked
            }));
          }}
          className="data-[state=checked]:bg-blue-600"
        />
      </div>

      {/* Payment Reminders */}
      <div className="flex items-center justify-between py-2">
        <div className="space-y-1">
          <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Payment Reminders
          </Label>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Get notified before payments are due
          </p>
        </div>
        <Switch 
          checked={preferences.payment_reminders_enabled}
          onCheckedChange={(checked) => {
            setPreferences(prev => ({
              ...prev,
              payment_reminders_enabled: checked
            }));
          }}
          className="data-[state=checked]:bg-blue-600"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button 
          variant="outline" 
          onClick={onCancel}
          disabled={saving}
          className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
};
