import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ChevronDown, ChevronRight, Shield, CheckCircle, XCircle, Globe, Settings, Info, AlertTriangle, Building2, Smartphone, Zap, TestTube, Rocket, Key } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { MpesaTestPaymentDialog } from "./MpesaTestPaymentDialog";

interface MpesaConfig {
  id?: string;
  consumer_key: string;
  consumer_secret: string;
  passkey: string;
  business_shortcode: string;
  shortcode_type: 'paybill' | 'till_safaricom' | 'till_kopokopo';
  phone_number?: string;
  paybill_number?: string;
  till_number?: string;
  till_provider?: 'safaricom' | 'kopokopo';
  kopokopo_client_id?: string;
  kopokopo_client_secret?: string;
  environment: 'sandbox' | 'production';
  callback_url?: string;
  is_active: boolean;
  credentials_verified?: boolean;
  last_verified_at?: string;
}

interface MpesaCredentialsSectionProps {
  onConfigChange: (hasConfig: boolean) => void;
  onPreferenceChange?: () => void; // Callback to refresh parent when preference changes
}

export const MpesaCredentialsSection: React.FC<MpesaCredentialsSectionProps> = ({ onConfigChange, onPreferenceChange }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { mpesaShortcode, mpesaDisplayName } = usePlatformConfig();
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [hasConfig, setHasConfig] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [mpesaConfigPreference, setMpesaConfigPreference] = useState<'custom' | 'platform_default'>('platform_default');
  const [allConfigs, setAllConfigs] = useState<MpesaConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
  const hasInitializedRef = useRef(false);
  const hasDraftRef = useRef(false);
  
  // Refs for autofocus
  const consumerKeyRef = useRef<HTMLInputElement>(null);
  const businessShortcodeRef = useRef<HTMLInputElement>(null);
  const kopoTillRef = useRef<HTMLInputElement>(null);
  const kopoClientIdRef = useRef<HTMLInputElement>(null);
  
  const [config, setConfig] = useState<MpesaConfig>({
    consumer_key: '',
    consumer_secret: '',
    passkey: '',
    business_shortcode: '',
    shortcode_type: 'paybill',
    phone_number: '',
    paybill_number: '',
    till_number: '',
    till_provider: 'safaricom',
    kopokopo_client_id: '',
    kopokopo_client_secret: '',
    environment: 'sandbox',
    callback_url: '',
    is_active: true,
  });

  // SessionStorage keys for draft persistence
  const EDIT_KEY = `mpesa_editing_v1_${user?.id || 'guest'}`;
  const DRAFT_KEY = `mpesa_draft_v1_${user?.id || 'guest'}`;
  const DRAFT_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

  // Draft persistence helpers
  const loadDraft = () => {
    try {
      const draftStr = sessionStorage.getItem(DRAFT_KEY);
      if (!draftStr) {
        console.log('📭 No draft found in sessionStorage');
        return null;
      }
      const draft = JSON.parse(draftStr);
      if (Date.now() - draft.savedAt > DRAFT_EXPIRY_MS) {
        console.log('⏰ Draft expired');
        clearDraft();
        return null;
      }
      console.log('📬 Draft loaded:', {
        shortcode_type: draft.fields.shortcode_type,
        age_minutes: Math.round((Date.now() - draft.savedAt) / 60000)
      });
      return draft.fields;
    } catch (error) {
      console.error('Failed to load draft:', error);
      return null;
    }
  };

  const saveDraft = (fields: Partial<MpesaConfig>) => {
    try {
      // Load existing draft and merge to preserve all fields
      const existing = (loadDraft() || {}) as Partial<MpesaConfig>;
      const merged: Partial<MpesaConfig> = {
        // Preserve critical keys from previous draft or current config
        shortcode_type: existing.shortcode_type ?? config.shortcode_type,
        till_provider: existing.till_provider ?? config.till_provider,
        environment: existing.environment ?? config.environment,
        // Merge other fields
        ...existing,
        ...fields,
      };
      const draft = {
        fields: merged,
        savedAt: Date.now()
      };
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      sessionStorage.setItem(EDIT_KEY, '1'); // Always refresh EDIT_KEY
      console.log('💾 Draft saved (merged):', {
        shortcode_type: merged.shortcode_type,
        till_provider: merged.till_provider,
        environment: merged.environment,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  };

  const clearDraft = () => {
    sessionStorage.removeItem(EDIT_KEY);
    sessionStorage.removeItem(DRAFT_KEY);
  };

  // Load existing config - SECURITY: Only fetch non-sensitive metadata
  const loadConfig = async () => {
    if (!user?.id) return;

    // CRITICAL FIX: Don't reload config while user is editing or has draft to prevent field clearing
    if (showForm || hasDraftRef.current) {
      console.log('Skipping config reload - user is editing or has draft');
      return;
    }

    try {
      // Load payment preference to show correct badge
      const { data: prefData, error: prefError } = await supabase
        .from('landlord_payment_preferences')
        .select('mpesa_config_preference')
        .eq('landlord_id', user.id)
        .maybeSingle();
      
      if (!prefError && prefData) {
        setMpesaConfigPreference((prefData.mpesa_config_preference as 'custom' | 'platform_default') || 'platform_default');
      }

      // SECURITY: Load ALL configs (not just one), Only select non-sensitive fields, NEVER fetch encrypted credentials
      const { data, error } = await supabase
        .from('landlord_mpesa_configs')
        .select('id, callback_url, environment, is_active, business_shortcode, shortcode_type, till_provider, kopokopo_client_id, till_number, credentials_verified, last_verified_at')
        .eq('landlord_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading M-Pesa configs:', error);
        return;
      }

      if (data && data.length > 0) {
        // Store all configs
        const configs = data.map(d => ({
          id: d.id,
          callback_url: d.callback_url || '',
          environment: (d.environment === 'production' ? 'production' : 'sandbox') as 'sandbox' | 'production',
          is_active: d.is_active,
          business_shortcode: d.business_shortcode || '',
          shortcode_type: (d.shortcode_type || 'paybill') as 'paybill' | 'till_safaricom' | 'till_kopokopo',
          till_provider: (d.till_provider || 'safaricom') as 'safaricom' | 'kopokopo',
          till_number: d.till_number || '',
          kopokopo_client_id: d.kopokopo_client_id || '',
          credentials_verified: d.credentials_verified || false,
          last_verified_at: d.last_verified_at || undefined,
          // Explicitly clear sensitive fields for security
          consumer_key: '',
          consumer_secret: '',
          passkey: '',
          kopokopo_client_secret: ''
        }));
        
        setAllConfigs(configs);
        
        // Find active config
        const activeConfig = configs.find(c => c.is_active);
        if (activeConfig) {
          setConfig(activeConfig);
          setActiveConfigId(activeConfig.id || null);
        } else if (configs.length > 0) {
          // If no active config, load the first one
          setConfig(configs[0]);
          setActiveConfigId(configs[0].id || null);
        }
        
        setHasConfig(true);
        setIsOpen(true);
        
        // Only set showForm to false on initial load
        if (!hasInitializedRef.current) {
          setShowForm(false);
          hasInitializedRef.current = true;
        }
        
        onConfigChange(true);
      } else {
        setAllConfigs([]);
        setHasConfig(false);
        setIsOpen(true);
        
        // Only set showForm to false on initial load
        if (!hasInitializedRef.current) {
          setShowForm(false);
          hasInitializedRef.current = true;
        }
        
        onConfigChange(false);
      }
    } catch (error) {
      console.error('Error loading M-Pesa config:', error);
    }
  };

  useEffect(() => {
    // CRITICAL: Restore draft BEFORE loading config to prevent overwriting
    const isEditing = sessionStorage.getItem(EDIT_KEY) === '1';
    const draftFields = loadDraft();
    
    if (isEditing && draftFields) {
      console.log('🔄 Restoring draft from sessionStorage:', {
        shortcode_type: draftFields.shortcode_type,
        till_provider: draftFields.till_provider,
        has_till_number: !!draftFields.till_number,
        has_kopokopo_client_id: !!draftFields.kopokopo_client_id
      });
      
      hasDraftRef.current = true;
      setShowForm(true);
      setIsOpen(true);
      
      // CRITICAL FIX: Set config directly to draft (not merge with prev)
      // This ensures RadioGroup gets the correct value immediately
      // Safety: fallback to 'paybill' if shortcode_type is somehow missing
      const safeConfig = {
        ...draftFields,
        shortcode_type: draftFields.shortcode_type || 'paybill'
      } as MpesaConfig;
      setConfig(safeConfig);
      
      // Show toast notification that draft was restored
      toast({
        title: "Draft Restored",
        description: `Your ${
          draftFields.shortcode_type === 'till_kopokopo' ? 'Kopo Kopo' :
          draftFields.shortcode_type === 'till_safaricom' ? 'Till Safaricom' :
          'Paybill'
        } configuration has been restored. Continue where you left off.`,
        duration: 5000,
      });
      
      // DO NOT call loadConfig() when draft exists - prevents overwriting
      return;
    }
    
    // Only load config if no draft exists
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  
  // Autofocus logic when form opens
  useEffect(() => {
    if (showForm && isOpen) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        if (config.shortcode_type === 'till_kopokopo') {
          kopoTillRef.current?.focus();
        } else {
          consumerKeyRef.current?.focus();
        }
      }, 100);
    }
  }, [showForm, isOpen, config.shortcode_type]);

  // Warn before navigation if unsaved changes exist
  useEffect(() => {
    if (!showForm) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [showForm]);

  const handleContinueWithDefaults = async () => {
    if (!user?.id) return;
    
    setSaving(true);
    try {
      // Get existing preferences or create new
      const { data: existingPrefs } = await supabase
        .from('landlord_payment_preferences')
        .select('*')
        .eq('landlord_id', user.id)
        .maybeSingle();

      // Upsert with platform_default preference
      const { error } = await supabase
        .from('landlord_payment_preferences')
        .upsert({
          landlord_id: user.id,
          mpesa_config_preference: 'platform_default',
          preferred_payment_method: existingPrefs?.preferred_payment_method || 'mpesa',
          auto_payment_enabled: existingPrefs?.auto_payment_enabled ?? false,
          payment_reminders_enabled: existingPrefs?.payment_reminders_enabled ?? true,
        });

      if (error) throw error;

      // Notify parent to refresh
      onPreferenceChange?.();

      toast({
        title: "Platform Defaults Confirmed",
        description: `Tenants can now pay via M-Pesa using ${mpesaDisplayName || 'platform'} shortcode ${mpesaShortcode || '4155923'}`,
      });
      
      // Reload config to update badge
      await loadConfig();
      
      // Optionally close the section
      setIsOpen(false);
    } catch (error) {
      console.error('Error saving platform default preference:', error);
      toast({
        title: "Error",
        description: "Failed to save platform default preference",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfig = async () => {
    if (!user?.id || !config.id) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('landlord_mpesa_configs')
        .delete()
        .eq('id', config.id);

      if (error) throw error;

      // Remove from allConfigs
      const updatedConfigs = allConfigs.filter(c => c.id !== config.id);
      setAllConfigs(updatedConfigs);

      // If there are other configs, switch to one of them
      if (updatedConfigs.length > 0) {
        const nextConfig = updatedConfigs[0];
        setConfig(nextConfig);
        setActiveConfigId(nextConfig.id || null);
        setHasConfig(true);
        onConfigChange(true);

        toast({
          title: "Configuration Deleted",
          description: "The M-Pesa configuration has been deleted. Switched to another saved configuration.",
        });
      } else {
        // No more configs, switch to platform defaults
        const { error: prefError } = await supabase
          .from('landlord_payment_preferences')
          .upsert({
            landlord_id: user.id,
            mpesa_config_preference: 'platform_default'
          }, {
            onConflict: 'landlord_id',
            ignoreDuplicates: false
          });

        if (prefError) {
          console.error('Failed to update preference:', prefError);
        }

        setConfig({
          consumer_key: '',
          consumer_secret: '',
          passkey: '',
          business_shortcode: '',
          shortcode_type: 'paybill',
          phone_number: '',
          paybill_number: '',
          till_number: '',
          till_provider: 'safaricom',
          kopokopo_client_id: '',
          kopokopo_client_secret: '',
          environment: 'sandbox',
          callback_url: '',
          is_active: true,
        });
        setHasConfig(false);
        onConfigChange(false);

        // Notify parent to refresh
        onPreferenceChange?.();
        
        // Reload to update badge
        await loadConfig();

        toast({
          title: "Configuration Deleted",
          description: "Switched to platform default M-Pesa configuration. Tenants will now use the platform shortcode.",
        });
      }

      setShowForm(false);
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Error deleting config:', error);
      toast({
        title: "Error", 
        description: "Failed to delete configuration.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchToDefaults = async () => {
    if (!user?.id) return;
    
    setSaving(true);
    try {
      // Set all configs to inactive instead of deleting
      const { error } = await supabase
        .from('landlord_mpesa_configs')
        .update({ is_active: false })
        .eq('landlord_id', user.id);

      if (error) throw error;

      // Update preference to platform_default
      const { error: prefError } = await supabase
        .from('landlord_payment_preferences')
        .upsert({
          landlord_id: user.id,
          mpesa_config_preference: 'platform_default'
        }, {
          onConflict: 'landlord_id',
          ignoreDuplicates: false
        });

      if (prefError) {
        console.error('Failed to update preference:', prefError);
      }

      // Notify parent to refresh
      onPreferenceChange?.();
      
      // Reload config to show updated state
      await loadConfig();
      setShowForm(false);

      toast({
        title: "Switched to Platform Defaults",
        description: "Your saved configurations are preserved and can be reactivated anytime.",
      });
    } catch (error) {
      console.error('Error switching to platform defaults:', error);
      toast({
        title: "Error", 
        description: "Failed to switch to platform defaults.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleActivateConfig = async (configId: string) => {
    if (!user?.id) return;
    
    setSaving(true);
    try {
      // Set all configs to inactive
      await supabase
        .from('landlord_mpesa_configs')
        .update({ is_active: false })
        .eq('landlord_id', user.id);

      // Activate selected config
      const { error } = await supabase
        .from('landlord_mpesa_configs')
        .update({ is_active: true })
        .eq('id', configId);

      if (error) throw error;

      // Update preference to custom
      const { error: prefError } = await supabase
        .from('landlord_payment_preferences')
        .upsert({
          landlord_id: user.id,
          mpesa_config_preference: 'custom'
        }, {
          onConflict: 'landlord_id',
          ignoreDuplicates: false
        });

      if (prefError) {
        console.error('Failed to update preference:', prefError);
      }

      // Invalidate tenant-side M-Pesa availability cache
      // This ensures tenants see the newly activated config immediately
      console.log('🔄 Invalidating M-Pesa availability cache after config activation');
      
      // Notify parent to refresh
      onPreferenceChange?.();
      
      // Reload config
      await loadConfig();

      const activatedConfig = allConfigs.find(cfg => cfg.id === configId);
      const configType = activatedConfig?.shortcode_type === 'till_kopokopo' 
        ? `Till ${activatedConfig?.till_number}` 
        : `${activatedConfig?.shortcode_type === 'paybill' ? 'Paybill' : 'Till'} ${activatedConfig?.business_shortcode}`;
      
      toast({
        title: "Configuration Activated Successfully",
        description: `Tenants can now pay via M-Pesa using ${configType}. Test it with 'Test STK Push'.`,
      });
    } catch (error) {
      console.error('Error activating config:', error);
      toast({
        title: "Error",
        description: "Failed to activate configuration.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditConfig = (configToEdit: MpesaConfig) => {
    setConfig(configToEdit);
    saveDraft(configToEdit); // Seed the draft immediately
    setShowForm(true);
    setIsOpen(true);
    sessionStorage.setItem(EDIT_KEY, '1');
  };

  const handleSave = async () => {
    if (!user?.id) return;

    // Validate required fields based on shortcode type
    if (config.shortcode_type === 'till_kopokopo') {
      if (!config.till_number || !config.kopokopo_client_id || !config.kopokopo_client_secret) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required Kopo Kopo credentials: Till Number, Client ID, and Client Secret.",
          variant: "destructive",
        });
        return;
      }

      // Test Kopo Kopo credentials before saving
      setSaving(true);
      try {
        toast({
          title: "Testing Connection",
          description: "Validating your Kopo Kopo credentials...",
        });

        const { data: testResult, error: testError } = await supabase.functions.invoke('test-kopokopo-credentials', {
          body: {
            client_id: config.kopokopo_client_id,
            client_secret: config.kopokopo_client_secret,
            environment: config.environment,
          },
        });

        if (testError || !testResult?.success) {
          toast({
            title: "Credential Validation Failed",
            description: testResult?.error || testError?.message || "Unable to authenticate with Kopo Kopo. Please verify your credentials.",
            variant: "destructive",
          });
          setSaving(false);
          return;
        }

        toast({
          title: "Connection Successful",
          description: "Your Kopo Kopo credentials have been validated successfully.",
        });

      } catch (error) {
        console.error('Error testing Kopo Kopo credentials:', error);
        toast({
          title: "Validation Error",
          description: "Failed to test credentials. Please try again.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }
    } else {
      if (!config.consumer_key || !config.consumer_secret || !config.passkey || !config.business_shortcode) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required M-Pesa credentials.",
          variant: "destructive",
        });
        return;
      }
    }

    // Save encrypted credentials via edge function
    setSaving(true);
    try {
      // Find if we're updating an existing config for this payment type
      const existingConfigForType = allConfigs.find(c => c.shortcode_type === config.shortcode_type);
      
      const { data, error } = await supabase.functions.invoke('save-mpesa-credentials', {
        body: {
          config_id: existingConfigForType?.id || config.id, // Pass config_id to help backend identify update vs insert
          consumer_key: config.consumer_key,
          consumer_secret: config.consumer_secret,
          shortcode: config.business_shortcode,
          shortcode_type: config.shortcode_type,
          till_number: config.till_number,
          till_provider: config.till_provider,
          kopokopo_client_id: config.kopokopo_client_id,
          kopokopo_client_secret: config.kopokopo_client_secret,
          passkey: config.passkey,
          callback_url: config.callback_url,
          environment: config.environment,
          is_active: config.is_active
        }
      });

      // Handle edge function errors
      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to save credentials');
      }
      
      // Handle application-level errors from the edge function
      if (data?.error) {
        console.error('Application error from edge function:', data.error, data?.details);
        throw new Error(data?.details || data.error);
      }

      // Success
      setHasConfig(true);
      setShowForm(false); // Exit form
      setIsOpen(false); // Collapse section to return to main page
      hasDraftRef.current = false;
      clearDraft(); // Clear draft after successful save
      onConfigChange(true);
      
      // Clear sensitive data from local state for security
      setConfig(prev => ({
        ...prev,
        consumer_key: '',
        consumer_secret: '',
        passkey: '',
        kopokopo_client_secret: ''
      }));

      // Notify parent to refresh
      onPreferenceChange?.();

      toast({
        title: "Credentials Saved Successfully",
        description: "Your M-Pesa credentials have been saved and activated. Tenant payments will now go directly to your paybill/till number.",
      });
      
      // Reload config to refresh summary view with latest data
      await loadConfig();
    } catch (error: any) {
      console.error('Error saving M-Pesa config:', error);
      
      // Extract detailed error message with specific handling
      let errorTitle = "Error Saving Credentials";
      let errorMessage = "Failed to save M-Pesa credentials. Please try again.";
      
      if (error.message) {
        const msg = error.message.toLowerCase();
        
        // Handle encryption-related errors
        if (msg.includes('encryption') || msg.includes('invalid key') || msg.includes('dataerror')) {
          errorTitle = "Server Configuration Error";
          errorMessage = "There's a problem with the server encryption configuration. Please contact support or try again later.";
        }
        // Handle validation errors
        else if (msg.includes('validation') || msg.includes('required')) {
          errorTitle = "Validation Error";
          errorMessage = error.message;
        }
        // Handle database constraint violations
        else if (msg.includes('constraint') || msg.includes('violates') || msg.includes('not-null')) {
          errorTitle = "Database Constraint Error";
          errorMessage = "Database validation error. Please ensure all required fields are filled correctly for your payment type.";
        }
        // Handle other database errors
        else if (msg.includes('database') || msg.includes('unique')) {
          errorTitle = "Database Error";
          errorMessage = "Failed to save credentials to database. Please try again or contact support.";
        }
        // Handle network errors
        else if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) {
          errorTitle = "Network Error";
          errorMessage = "Unable to connect to server. Please check your internet connection and try again.";
        }
        // Kopo Kopo specific errors
        else if (msg.includes('kopo') || msg.includes('kopokopo')) {
          errorTitle = "Kopo Kopo Configuration Error";
          errorMessage = error.message || "Failed to save Kopo Kopo credentials. Please verify all OAuth credentials are correct.";
        }
        // Generic error with the actual message
        else {
          errorMessage = error.message;
        }
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestKopokopoConnection = async () => {
    console.log('🧪 [STEP 1] Test Connection clicked');
    console.log('📋 Current config:', {
      config_id: config.id || 'new',
      client_id: config.kopokopo_client_id ? '✓ present' : '✗ missing',
      client_secret: config.kopokopo_client_secret ? '✓ present' : '✗ missing',
      environment: config.environment,
    });

    if (!user?.id) {
      console.log('❌ [STEP 2] No user ID - aborting');
      return;
    }

    // For existing configs, we only need client_id to be visible (secret is in DB)
    // For new configs, we need both
    const isExistingConfig = !!config.id;
    const hasRequiredFields = isExistingConfig 
      ? !!config.kopokopo_client_id  // Existing: just need client_id
      : !!(config.kopokopo_client_id && config.kopokopo_client_secret); // New: need both

    if (!hasRequiredFields) {
      console.log('❌ [STEP 3] Missing credentials - showing error toast');
      toast({
        title: "Missing Credentials",
        description: isExistingConfig
          ? "Configuration data is incomplete. Please edit and re-enter your credentials."
          : "Please enter both Client ID and Client Secret to test the connection.",
        variant: "destructive",
      });
      return;
    }

    console.log('🚀 [STEP 4] Validation passed, starting test...');
    setTesting(true);
    
    try {
      console.log('📢 [STEP 5] Showing "Testing Connection..." toast');
      toast({
        title: "Testing Connection",
        description: "Validating your Kopo Kopo credentials...",
      });

      console.log('📡 [STEP 6] Calling edge function with:', {
        config_id: config.id || 'new',
        client_id: config.kopokopo_client_id?.substring(0, 10) + '...',
        environment: config.environment,
        using_stored_secret: isExistingConfig && !config.kopokopo_client_secret
      });

      const { data: testResult, error: testError } = await supabase.functions.invoke('test-kopokopo-credentials', {
        body: {
          config_id: config.id, // Pass config ID if editing
          landlord_id: user.id,
          client_id: config.kopokopo_client_id,
          client_secret: config.kopokopo_client_secret || undefined, // Only pass if re-entered
          environment: config.environment,
        },
      });

      console.log('📥 [STEP 7] Response received:', {
        success: testResult?.success,
        hasError: !!testError,
        errorMessage: testError?.message || testResult?.error,
        fullTestResult: testResult,
        fullTestError: testError
      });

      if (testError || !testResult?.success) {
        console.log('❌ [STEP 8] Test failed - showing error toast');
        toast({
          title: "Connection Failed",
          description: testResult?.error || testError?.message || "Unable to authenticate with Kopo Kopo. Please verify your credentials.",
          variant: "destructive",
        });
        console.log('✅ [STEP 8.1] Error toast called, returning');
        return;
      }

      console.log('✅ [STEP 9] Test successful!');
      
      // Mark credentials as verified if this is an existing config
      if (config.id) {
        console.log('📝 [STEP 10] Updating database verification status...');
        try {
          const { error: updateError } = await supabase
            .from('landlord_mpesa_configs')
            .update({
              credentials_verified: true,
              last_verified_at: new Date().toISOString()
            })
            .eq('id', config.id)
            .eq('landlord_id', user.id);
          
          if (updateError) {
            console.error('[STEP 11] Failed to mark credentials as verified:', updateError);
          } else {
            console.log('✅ [STEP 12] Credentials marked as verified in database');
            console.log('🔄 [STEP 13] Calling loadConfig() - showForm:', showForm, 'hasDraft:', hasDraftRef.current);
            await loadConfig();
            console.log('✅ [STEP 14] loadConfig() completed');
          }
        } catch (err) {
          console.error('[STEP 15] Exception updating verification status:', err);
        }
      } else {
        console.log('ℹ️ [STEP 16] No config.id, skipping database update');
      }
      
      console.log('🎉 [STEP 17] About to show SUCCESS toast');
      console.log('Toast function type:', typeof toast);
      console.log('Toast function:', toast);
      
      const toastResult = toast({
        title: "Connection Successful! ✓",
        description: "Your Kopo Kopo credentials are valid and working correctly.",
      });
      
      console.log('✅ [STEP 18] SUCCESS toast called, returned:', toastResult);

    } catch (error) {
      console.error('💥 [STEP 19] Exception in test function:', error);
      console.error('Error type:', error?.constructor?.name);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      toast({
        title: "Test Failed",
        description: `Failed to test credentials: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      console.log('🏁 [STEP 20] Finally block - resetting state');
      setTesting(false);
    }
  };

  const handleTestConfiguration = () => {
    if (!user?.id) return;
    
    // Check if active config is verified (ONLY for Kopo Kopo configs)
    const activeConfig = allConfigs.find(cfg => cfg.is_active);
    
    // Kopo Kopo configs must be verified via Test OAuth first
    if (activeConfig && 
        activeConfig.shortcode_type === 'till_kopokopo' && 
        !activeConfig.credentials_verified) {
      toast({
        title: "Verification Required",
        description: "Kopo Kopo configurations must be verified first. Please click 'Test OAuth' to verify your credentials.",
        variant: "destructive",
      });
      return;
    }
    
    // Safaricom configs can proceed directly - Test STK Push serves as verification
    setShowTestDialog(true);
  };

  // Test credentials for a saved config (Kopo Kopo only)
  const handleTestSavedConfigCredentials = async (cfg: MpesaConfig) => {
    if (!user?.id || cfg.shortcode_type !== 'till_kopokopo') return;
    
    console.log('🧪 Testing saved config credentials:', cfg.id);
    setTesting(true);
    
    try {
      toast({
        title: "Testing Credentials",
        description: "Validating your Kopo Kopo credentials...",
      });

      const { data: testResult, error: testError } = await supabase.functions.invoke('test-kopokopo-credentials', {
        body: {
          config_id: cfg.id,
          landlord_id: user.id,
          client_id: cfg.kopokopo_client_id,
          environment: cfg.environment,
        },
      });

      console.log('📥 Test result:', {
        success: testResult?.success,
        error: testError?.message || testResult?.error,
      });

      if (testError || !testResult?.success) {
        console.log('❌ Test failed');
        toast({
          title: "Credentials Test Failed",
          description: testResult?.error || testError?.message || "Unable to authenticate with Kopo Kopo.",
          variant: "destructive",
        });
        return;
      }

      // Mark as verified
      const { error: updateError } = await supabase
        .from('landlord_mpesa_configs')
        .update({
          credentials_verified: true,
          last_verified_at: new Date().toISOString()
        })
        .eq('id', cfg.id!)
        .eq('landlord_id', user.id);
      
      if (!updateError) {
        console.log('✅ Credentials verified and marked in database');
        await loadConfig();
      }

      toast({
        title: "Credentials Verified! ✓",
        description: "Your Kopo Kopo credentials are working correctly.",
      });

    } catch (error) {
      console.error('💥 Test error:', error);
      toast({
        title: "Test Failed",
        description: `Failed to test credentials: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      console.log('🏁 Test completed');
      setTesting(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-4 border border-border rounded-lg p-4">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-accent rounded">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <Shield className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-medium">
                  M-Pesa API Credentials
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {mpesaConfigPreference === 'custom' ? (
                  <Badge variant="default" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Using Custom Credentials
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <Globe className="h-3 w-3" />
                    Using Platform Defaults
                  </Badge>
                )}
                {allConfigs.length > 1 && (
                  <Badge variant="outline" className="text-xs">
                    {allConfigs.length} configs saved
                  </Badge>
                )}
              </div>
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-4 pt-4">
            {/* Initial State - No Configuration */}
            {!hasConfig && !showForm && (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      <p className="font-medium mb-1">Choose M-Pesa Configuration</p>
                      <p>Configure your own M-Pesa API credentials for direct payments to your account, or use platform defaults.</p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Option 1: Configure Custom Credentials */}
                  <Card className="border-2 hover:border-primary transition-colors cursor-pointer">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">My Own M-Pesa</CardTitle>
                      </div>
                      <CardDescription>
                        Tenant payments go directly to your paybill/till number
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                          <span>Direct payments to your account</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                          <span>Full control over your funds</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                          <span>Instant settlement</span>
                        </li>
                      </ul>
                      <Button 
                        onClick={() => {
                          const newConfig: MpesaConfig = {
                            consumer_key: '',
                            consumer_secret: '',
                            passkey: '',
                            business_shortcode: '',
                            shortcode_type: 'paybill',
                            phone_number: '',
                            paybill_number: '',
                            till_number: '',
                            till_provider: 'safaricom',
                            kopokopo_client_id: '',
                            kopokopo_client_secret: '',
                            environment: 'sandbox',
                            callback_url: '',
                            is_active: true,
                          };
                          setConfig(newConfig);
                          saveDraft(newConfig); // Seed the draft immediately
                          setShowForm(true);
                          setIsOpen(true);
                          sessionStorage.setItem(EDIT_KEY, '1');
                        }}
                        className="w-full"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Configure Custom Credentials
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Option 2: Platform Defaults */}
                  <Card className="border-2 hover:border-primary transition-colors cursor-pointer">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">Platform Defaults</CardTitle>
                      </div>
                      <CardDescription>
                        Use system-wide M-Pesa configuration
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                          <span>Quick setup, no API keys needed</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                          <span>Platform manages integration</span>
                        </li>
                         <li className="flex items-start gap-2">
                          <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                          <span className="text-blue-600 dark:text-blue-400">Using Shortcode: {mpesaShortcode || '4155923'}</span>
                        </li>
                      </ul>
                      <Button 
                        variant="secondary"
                        className="w-full"
                        onClick={handleContinueWithDefaults}
                        disabled={saving}
                      >
                        <Globe className="h-4 w-4 mr-2" />
                        {saving ? "Saving..." : "Continue with Defaults"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Configured State - Summary View with All Configs */}
            {hasConfig && !showForm && (
              <div className="space-y-4">
                {/* Tenants Currently See Indicator */}
                {(() => {
                  const activeVerifiedConfig = allConfigs.find(cfg => cfg.is_active && cfg.credentials_verified);
                  const activeUnverifiedConfig = allConfigs.find(cfg => cfg.is_active && !cfg.credentials_verified);
                  
                  if (activeVerifiedConfig) {
                    const configDisplay = activeVerifiedConfig.shortcode_type === 'till_kopokopo' 
                      ? `Till ${activeVerifiedConfig.till_number}` 
                      : `${activeVerifiedConfig.shortcode_type === 'paybill' ? 'Paybill' : 'Till'} ${activeVerifiedConfig.business_shortcode}`;
                    
                    return (
                      <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertTitle>Tenant Payment Status: Active</AlertTitle>
                        <AlertDescription>
                          Tenants can pay using: <strong>{configDisplay}</strong>
                        </AlertDescription>
                      </Alert>
                    );
                  } else if (mpesaConfigPreference === 'platform_default' && mpesaShortcode) {
                    return (
                      <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertTitle>Tenant Payment Status: Active</AlertTitle>
                        <AlertDescription>
                          Tenants can pay using: <strong>Paybill {mpesaShortcode}</strong> (Platform Defaults)
                        </AlertDescription>
                      </Alert>
                    );
                  } else if (activeUnverifiedConfig) {
                    return (
                      <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        <AlertTitle>Tenant Payment Status: Blocked</AlertTitle>
                        <AlertDescription>
                          Your active config is <strong>unverified</strong>. Tenants cannot make payments. Please verify credentials or activate a verified config.
                        </AlertDescription>
                      </Alert>
                    );
                  } else {
                    return (
                      <Alert className="bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <AlertTitle>Tenant Payment Status: Unavailable</AlertTitle>
                        <AlertDescription>
                          No verified config is active. Tenants cannot make M-Pesa payments. Please activate a verified config.
                        </AlertDescription>
                      </Alert>
                    );
                  }
                })()}
                
                {/* Show all saved configurations */}
                {allConfigs.map((cfg) => (
                  <Card key={cfg.id} className={cfg.is_active ? "border-primary" : ""}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {cfg.is_active && <CheckCircle className="h-5 w-5 text-green-600" />}
                            {cfg.shortcode_type === 'paybill' && 'Paybill Number'}
                            {cfg.shortcode_type === 'till_safaricom' && 'Till Number - Safaricom'}
                            {cfg.shortcode_type === 'till_kopokopo' && 'Till Number - Kopo Kopo'}
                            {cfg.credentials_verified && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="ml-2 gap-1 border-green-600 text-green-600 bg-green-50 dark:bg-green-950">
                                      <Shield className="h-3 w-3" />
                                      Verified
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="font-medium">OAuth Credentials Verified</p>
                                    {cfg.last_verified_at && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Last verified: {new Date(cfg.last_verified_at).toLocaleString()}
                                      </p>
                                    )}
                                    <p className="text-xs text-yellow-600 mt-1">
                                      ⚠️ Note: This only verifies OAuth authentication. Use "Test STK Push" to verify payment capability.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {cfg.is_active ? 'Currently Active' : 'Inactive Configuration'}
                          </CardDescription>
                        </div>
                        {cfg.is_active && (
                          <Badge variant="default">Active</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid md:grid-cols-3 gap-4 p-3 bg-accent rounded-lg text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {cfg.shortcode_type === 'till_kopokopo' ? 'Till Number' : 'Shortcode'}
                          </p>
                          <p className="font-medium">
                            {cfg.shortcode_type === 'till_kopokopo' ? cfg.till_number : cfg.business_shortcode}
                          </p>
                        </div>
                        {cfg.shortcode_type === 'till_kopokopo' && (
                          <div>
                            <p className="text-xs text-muted-foreground">Client ID</p>
                            <p className="font-medium">{cfg.kopokopo_client_id}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-muted-foreground">Environment</p>
                          <p className="font-medium capitalize">{cfg.environment}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {!cfg.is_active && (
                          cfg.credentials_verified ? (
                            <Button 
                              variant="default"
                              size="sm"
                              onClick={() => handleActivateConfig(cfg.id!)}
                              disabled={saving}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Activate
                            </Button>
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Button 
                                      variant="outline"
                                      size="sm"
                                      disabled
                                      className="opacity-60"
                                    >
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      Cannot Activate
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="font-medium">Verification Required</p>
                                  <p className="text-xs mt-1">This config must be verified before activation. Tenants cannot pay with unverified configs.</p>
                                  <p className="text-xs mt-1 text-yellow-600">
                                    💡 Tip: Activate this config first, then click {cfg.shortcode_type === 'till_kopokopo' ? '"Test OAuth"' : '"Test STK Push"'} to verify.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )
                        )}
                        {cfg.is_active && (
                          <>
                            {/* Test OAuth Connection button - Kopo Kopo only */}
                            {cfg.shortcode_type === 'till_kopokopo' && (
                              <Button 
                                variant="default"
                                size="sm"
                                onClick={() => handleTestSavedConfigCredentials(cfg)}
                                disabled={testing}
                              >
                                <Key className="h-3 w-3 mr-1" />
                                {testing ? "Testing..." : "Test OAuth"}
                              </Button>
                            )}
                            {/* Test STK Push button - for actual payment */}
                            <Button 
                              variant="outline"
                              size="sm"
                              onClick={handleTestConfiguration}
                              disabled={testing}
                            >
                              <Smartphone className="h-3 w-3 mr-1" />
                              Test STK Push
                            </Button>
                          </>
                        )}
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditConfig(cfg)}
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setConfig(cfg);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Add New Configuration Button */}
                <Button 
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const newConfig: MpesaConfig = {
                      consumer_key: '',
                      consumer_secret: '',
                      passkey: '',
                      business_shortcode: '',
                      shortcode_type: 'paybill',
                      phone_number: '',
                      paybill_number: '',
                      till_number: '',
                      till_provider: 'safaricom',
                      kopokopo_client_id: '',
                      kopokopo_client_secret: '',
                      environment: 'sandbox',
                      callback_url: '',
                      is_active: true,
                    };
                    setConfig(newConfig);
                    saveDraft(newConfig); // Seed the draft immediately
                    setShowForm(true);
                    setIsOpen(true);
                    sessionStorage.setItem(EDIT_KEY, '1');
                  }}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Add New M-Pesa Configuration
                </Button>

                {/* Switch to Platform Defaults Button */}
                <Button 
                  variant="outline"
                  className="w-full"
                  onClick={handleSwitchToDefaults}
                  disabled={saving}
                >
                  <Globe className="h-4 w-4 mr-2" />
                  {saving ? "Switching..." : "Use Platform Defaults (Preserve Configs)"}
                </Button>
              </div>
            )}

              {/* Form State - Edit/Create Credentials */}
            {showForm && (
              <div className="space-y-4">
                {/* DRAFT INDICATOR */}
                {hasDraftRef.current && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        <strong>Draft in progress:</strong> Your changes are being saved automatically. Complete the form to save permanently.
                      </p>
                    </div>
                  </div>
                )}

                {/* SECURITY NOTICE */}
                {hasConfig && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div className="text-sm text-amber-800 dark:text-amber-200">
                      <p className="font-medium">Credentials are encrypted</p>
                      <p>For security, stored credentials are never displayed. Re-enter credentials to update them.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Shortcode Type Selection - Always show first */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label>Payment Type *</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">Choose your M-Pesa payment type based on your business setup</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                
                <RadioGroup 
                  value={config.shortcode_type}
                  onValueChange={(value: 'paybill' | 'till_safaricom' | 'till_kopokopo') => {
                    const newConfig = {
                      ...config,
                      shortcode_type: value,
                      till_provider: value === 'till_kopokopo' ? 'kopokopo' as const : 'safaricom' as const
                    };
                    setConfig(newConfig);
                    saveDraft(newConfig);
                    
                    // CRITICAL: Refresh EDIT_KEY to ensure draft persists
                    sessionStorage.setItem(EDIT_KEY, '1');
                    
                    console.log('💾 Payment type changed to:', value, '- Draft saved');
                  }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-3"
                >
                  {/* Paybill Option */}
                  <label 
                    htmlFor="paybill"
                    className={`
                      relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all
                      ${config.shortcode_type === 'paybill' 
                        ? 'border-primary bg-primary/5 shadow-sm' 
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value="paybill" id="paybill" className="mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          <span className="font-medium">Paybill Number</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Best for businesses collecting rent
                        </p>
                      </div>
                    </div>
                    {config.shortcode_type === 'paybill' && (
                      <CheckCircle className="absolute top-3 right-3 h-5 w-5 text-primary" />
                    )}
                  </label>

                  {/* Till Safaricom Option */}
                  <label 
                    htmlFor="till_safaricom"
                    className={`
                      relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all
                      ${config.shortcode_type === 'till_safaricom' 
                        ? 'border-primary bg-primary/5 shadow-sm' 
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value="till_safaricom" id="till_safaricom" className="mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4 text-green-600" />
                          <span className="font-medium">Till - Safaricom Direct</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Direct M-Pesa till from Safaricom
                        </p>
                      </div>
                    </div>
                    {config.shortcode_type === 'till_safaricom' && (
                      <CheckCircle className="absolute top-3 right-3 h-5 w-5 text-primary" />
                    )}
                  </label>

                  {/* Kopo Kopo Option */}
                  <label 
                    htmlFor="till_kopokopo"
                    className={`
                      relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all
                      ${config.shortcode_type === 'till_kopokopo' 
                        ? 'border-primary bg-primary/5 shadow-sm' 
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value="till_kopokopo" id="till_kopokopo" className="mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-orange-600" />
                          <span className="font-medium">Till - Kopo Kopo</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Payment gateway with advanced features
                        </p>
                      </div>
                    </div>
                    {config.shortcode_type === 'till_kopokopo' && (
                      <CheckCircle className="absolute top-3 right-3 h-5 w-5 text-primary" />
                    )}
                  </label>
                </RadioGroup>
              </div>

              {/* Conditional credential fields based on payment type */}
              {config.shortcode_type === 'till_kopokopo' ? (
                // Kopo Kopo Till Fields
                <div className="grid grid-cols-1 gap-4 p-4 bg-accent/50 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <h3 className="font-medium">Kopo Kopo OAuth Credentials</h3>
                  </div>

                  <div className="space-y-2">
                    <Label>Till Number *</Label>
                    <Input 
                      ref={kopoTillRef}
                      type="text"
                      placeholder="e.g., 855087"
                      value={config.till_number || ''}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setConfig(prev => ({ ...prev, till_number: newValue }));
                        saveDraft({ till_number: newValue });
                      }}
                      onBlur={() => saveDraft({ till_number: config.till_number })}
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">
                      Your Kopo Kopo till number
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Environment *</Label>
                    <Select 
                      value={config.environment} 
                      onValueChange={(value: 'sandbox' | 'production') => {
                        setConfig(prev => ({ ...prev, environment: value }));
                        saveDraft({ environment: value });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select environment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                        <SelectItem value="production">Production (Live)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {config.environment === 'sandbox' 
                        ? 'Use sandbox for testing with test credentials'
                        : 'Use production for live transactions'}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Kopo Kopo Client ID *</Label>
                    <Input 
                      ref={kopoClientIdRef}
                      type="text"
                      placeholder="Enter your Kopo Kopo Client ID"
                      value={config.kopokopo_client_id || ''}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setConfig(prev => ({ ...prev, kopokopo_client_id: newValue }));
                        saveDraft({ kopokopo_client_id: newValue });
                      }}
                      onBlur={() => saveDraft({ kopokopo_client_id: config.kopokopo_client_id })}
                    />
                    <p className="text-xs text-muted-foreground">Get this from your Kopo Kopo dashboard</p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>
                        Kopo Kopo Client Secret * {hasConfig && <span className="text-xs text-muted-foreground">(Re-enter to update)</span>}
                      </Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">OAuth client secret from your Kopo Kopo dashboard</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Input 
                      type="password"
                      placeholder={hasConfig ? "••••••••••••••••" : "Enter your Kopo Kopo Client Secret"}
                      value={config.kopokopo_client_secret || ''}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setConfig(prev => ({ ...prev, kopokopo_client_secret: newValue }));
                        saveDraft({ kopokopo_client_secret: newValue });
                      }}
                      onBlur={() => saveDraft({ kopokopo_client_secret: config.kopokopo_client_secret })}
                    />
                    <p className="text-xs text-muted-foreground">Encrypted using AES-256-GCM before storage</p>
                  </div>

                  {/* Test Connection Button */}
                  <div className="flex items-center justify-start pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestKopokopoConnection}
                      disabled={testing || !config.kopokopo_client_id}
                      className="gap-2"
                    >
                      {testing ? (
                        <>
                          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          Testing Connection...
                        </>
                      ) : (
                        <>
                          <Key className="h-4 w-4" />
                          Test OAuth Connection
                        </>
                      )}
                    </Button>
                    {!config.kopokopo_client_id || !config.kopokopo_client_secret ? (
                      <p className="text-xs text-muted-foreground ml-3">
                        Enter credentials above to test
                      </p>
                    ) : null}
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-2">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <p className="text-xs text-blue-800 dark:text-blue-200">
                        Draft values are temporarily saved in your browser until you save or cancel. Safe to switch tabs to copy credentials.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                // Standard M-Pesa Fields
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>
                      Consumer Key * {hasConfig && <span className="text-xs text-muted-foreground">(Re-enter to update)</span>}
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Get this from your M-Pesa Daraja Portal under "Apps"</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input 
                    ref={consumerKeyRef}
                    type="password"
                    placeholder={hasConfig ? "••••••••••••••••" : "Enter M-Pesa Consumer Key"}
                    value={config.consumer_key}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setConfig(prev => ({ ...prev, consumer_key: newValue }));
                      saveDraft({ consumer_key: newValue });
                    }}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">Never shared or stored in plain text</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>
                      Consumer Secret * {hasConfig && <span className="text-xs text-muted-foreground">(Re-enter to update)</span>}
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">Secret key from M-Pesa Daraja Portal - keep this secure</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input 
                    type="password"
                    placeholder={hasConfig ? "••••••••••••••••" : "Enter M-Pesa Consumer Secret"}
                    value={config.consumer_secret}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setConfig(prev => ({ ...prev, consumer_secret: newValue }));
                      saveDraft({ consumer_secret: newValue });
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Encrypted using AES-256-GCM</p>
                </div>
                
                <div className="space-y-2">
                  <Label>
                    {config.shortcode_type === 'paybill' ? 'Paybill Number' : 'Till Number'} *
                  </Label>
                  <Input 
                    ref={businessShortcodeRef}
                    type="text"
                    placeholder={config.shortcode_type === 'paybill' ? "e.g., 4155923" : "e.g., 5071852"}
                    value={config.business_shortcode}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setConfig(prev => ({ ...prev, business_shortcode: newValue }));
                      saveDraft({ business_shortcode: newValue });
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Your {config.shortcode_type === 'paybill' ? 'paybill' : 'till'} number where payments are received
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>
                      Passkey * {hasConfig && <span className="text-xs text-muted-foreground">(Re-enter to update)</span>}
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">STK Push passkey from M-Pesa Daraja Portal</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input 
                    type="password"
                    placeholder={hasConfig ? "••••••••••••••••••••••••" : "Enter M-Pesa Passkey"}
                    value={config.passkey}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setConfig(prev => ({ ...prev, passkey: newValue }));
                      saveDraft({ passkey: newValue });
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Stored with end-to-end encryption</p>
                </div>
              </div>
              )}
                
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Environment</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={config.environment === 'sandbox' ? 'default' : 'outline'}
                      className={`flex-1 ${config.environment === 'sandbox' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`}
                      onClick={() => {
                        setConfig(prev => ({ ...prev, environment: 'sandbox' }));
                        saveDraft({ environment: 'sandbox' });
                      }}
                    >
                      <TestTube className="h-4 w-4 mr-2" />
                      Sandbox
                    </Button>
                    <Button
                      type="button"
                      variant={config.environment === 'production' ? 'default' : 'outline'}
                      className={`flex-1 ${config.environment === 'production' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
                      onClick={() => {
                        setConfig(prev => ({ ...prev, environment: 'production' }));
                        saveDraft({ environment: 'production' });
                      }}
                    >
                      <Rocket className="h-4 w-4 mr-2" />
                      Production
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {config.environment === 'sandbox' 
                      ? '⚠️ Testing mode - use test credentials'
                      : '✅ Live mode - real payments will be processed'
                    }
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Test Phone Number
                  </Label>
                  <Input 
                    type="tel"
                    placeholder="+254701234567"
                    value={config.phone_number || ''}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setConfig(prev => ({ ...prev, phone_number: newValue }));
                      saveDraft({ phone_number: newValue });
                    }}
                    className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {saving ? 'Saving...' : 'Save Credentials'}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    hasDraftRef.current = false;
                    clearDraft();
                    loadConfig();
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Delete M-Pesa Configuration?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>This will permanently delete this M-Pesa configuration.</p>
              <p className="font-medium">What happens next:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>{allConfigs.length > 1 ? 'You have other saved configurations that can be activated' : 'You will be switched back to platform defaults'}</li>
                <li>This action cannot be undone</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfig}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? "Deleting..." : "Delete Configuration"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Test Payment Dialog */}
      <MpesaTestPaymentDialog 
        open={showTestDialog}
        onOpenChange={setShowTestDialog}
        landlordId={user?.id || ''}
      />
    </div>
  </TooltipProvider>
  );
};
