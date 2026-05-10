import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

interface MpesaCheckDiagnostics {
  invoiceId?: string;
  leaseId?: string;
  unitId?: string;
  propertyId?: string;
  landlordId?: string;
  hasCustomConfig?: boolean;
  usesPlatformDefault?: boolean;
  step?: string;
}

interface MpesaAvailabilityResult {
  isAvailable: boolean;
  isChecking: boolean;
  checkAvailability: (invoiceId: string) => Promise<boolean>;
  error: string | null;
  lastErrorType: MpesaCheckError | null;
  lastErrorDetails: string | null;
  lastCheck: MpesaCheckDiagnostics | null;
  lastCheckTimestamp: string | null;
  configSource?: 'custom' | 'platform';
}

type MpesaCheckError = 
  | 'invoice_not_found' 
  | 'lease_not_found' 
  | 'unit_not_found' 
  | 'property_not_found' 
  | 'landlord_not_found'
  | 'no_mpesa_config'
  | 'credentials_not_verified'
  | 'config_inactive'
  | 'payment_preference_check_failed'
  | 'config_check_failed'
  | 'network_error'
  | 'unknown_error';

const ERROR_MESSAGES: Record<MpesaCheckError, string> = {
  invoice_not_found: 'Invoice not found. Please refresh and try again.',
  lease_not_found: 'Lease information not found. Please contact support.',
  unit_not_found: 'Unit information not found. Please contact support.',
  property_not_found: 'Property information not found. Please contact support.',
  landlord_not_found: 'Landlord information not found. Please contact support.',
  no_mpesa_config: 'M-Pesa payment not configured for this property',
  credentials_not_verified: 'M-Pesa credentials require verification',
  config_inactive: 'M-Pesa configuration is inactive',
  payment_preference_check_failed: 'Unable to verify payment preferences',
  config_check_failed: 'Unable to verify M-Pesa configuration. Please try again.',
  network_error: 'Network error. Please check your connection and try again.',
  unknown_error: 'An unexpected error occurred. Please try again.',
};

export function useMpesaAvailability(): MpesaAvailabilityResult {
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastErrorType, setLastErrorType] = useState<MpesaCheckError | null>(null);
  const [lastErrorDetails, setLastErrorDetails] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<MpesaCheckDiagnostics | null>(null);
  const [lastCheckTimestamp, setLastCheckTimestamp] = useState<string | null>(null);
  const [configSource, setConfigSource] = useState<'custom' | 'platform' | undefined>(undefined);

  const handleError = (errorType: MpesaCheckError, details?: string, diagnosticData?: MpesaCheckDiagnostics) => {
    const timestamp = new Date().toISOString();
    const message = ERROR_MESSAGES[errorType];
    
    console.group('🔴 M-Pesa Availability Check Failed');
    console.error('Error Type:', errorType);
    console.error('Message:', message);
    console.error('Details:', details);
    console.error('Timestamp:', timestamp);
    console.error('Diagnostic Data:', diagnosticData);
    console.groupEnd();
    
    setError(message);
    setLastErrorType(errorType);
    setLastErrorDetails(details || null);
    setIsAvailable(false);
    setLastCheckTimestamp(timestamp);
    toast.error(`${message}`, { duration: 5000 });
    
    logger.error(`M-Pesa availability check failed: ${errorType}`, new Error(message), {
      errorType,
      details,
      timestamp,
      diagnosticData
    });
  };

  const checkAvailability = async (invoiceId: string): Promise<boolean> => {
    const checkStartTime = Date.now();
    const timestamp = new Date().toISOString();
    
    console.group('🔍 M-Pesa Availability Check Started (Backend Function)');
    console.log('Invoice ID:', invoiceId);
    console.log('Timestamp:', timestamp);
    console.groupEnd();
    
    setIsChecking(true);
    setError(null);
    setLastErrorType(null);
    setLastErrorDetails(null);
    
    const diagnostics: MpesaCheckDiagnostics = { invoiceId, step: 'calling_backend' };
    setLastCheck(diagnostics);
    
    try {
      // Call the backend edge function with service role permissions
      // This bypasses RLS issues for tenants without auth accounts
      console.log('📡 Calling check-mpesa-availability edge function...');
      
      const { data, error: functionError } = await supabase.functions.invoke(
        'check-mpesa-availability',
        {
          body: { invoiceId }
        }
      );

      if (functionError) {
        console.error('❌ Edge function error:', functionError);
        diagnostics.step = 'backend_error';
        setLastCheck(diagnostics);
        handleError('network_error', functionError.message, diagnostics);
        return false;
      }

      if (!data) {
        console.error('❌ No data returned from edge function');
        diagnostics.step = 'no_response';
        setLastCheck(diagnostics);
        handleError('network_error', 'No response from server', diagnostics);
        return false;
      }

      console.log('📦 Edge function response:', data);

      // Handle unsuccessful responses
      if (!data.available) {
        const errorType: MpesaCheckError = 
          data.error?.includes('not configured') ? 'no_mpesa_config' :
          data.error?.includes('Invoice not found') ? 'invoice_not_found' :
          data.error?.includes('Lease not found') ? 'lease_not_found' :
          data.error?.includes('Unit not found') ? 'unit_not_found' :
          data.error?.includes('Property not found') ? 'property_not_found' :
          'config_check_failed';

        diagnostics.step = 'unavailable';
        setLastCheck(diagnostics);
        handleError(errorType, data.details || data.error, diagnostics);
        return false;
      }

      // M-Pesa is available!
      console.log('✅ M-Pesa is available!');
      console.log(`   Source: ${data.source || 'custom'}`);
      console.log(`   Provider: ${data.provider}`);
      console.log(`   Type: ${data.configType}`);
      if (data.tillNumber) console.log(`   Till: ${data.tillNumber}`);
      if (data.paybillNumber) console.log(`   Paybill: ${data.paybillNumber}`);

      diagnostics.step = 'complete';
      diagnostics.hasCustomConfig = data.source === 'custom';
      diagnostics.usesPlatformDefault = data.source === 'platform';
      setLastCheck(diagnostics);
      setIsAvailable(true);
      setError(null);
      setLastErrorType(null);
      setLastCheckTimestamp(timestamp);
      setConfigSource(data.source);

      logger.info('M-Pesa availability check successful (backend)', {
        invoiceId,
        provider: data.provider,
        configType: data.configType,
        source: data.source
      });

      return true;

    } catch (error: any) {
      console.error('💥 Unexpected error:', error);
      diagnostics.step = 'exception';
      setLastCheck(diagnostics);
      logger.error('Unexpected error checking M-Pesa availability', error);
      handleError('unknown_error', error?.message, diagnostics);
      return false;
    } finally {
      setIsChecking(false);
      const checkDuration = Date.now() - checkStartTime;
      
      console.group('✅ M-Pesa Availability Check Completed');
      console.log('Duration:', `${checkDuration}ms`);
      console.log('Result:', isAvailable ? 'Available' : 'Not Available');
      console.log('Final Diagnostics:', diagnostics);
      console.groupEnd();
    }
  };

  // Polling effect: Re-check M-Pesa availability every 30 seconds if currently unavailable
  useEffect(() => {
    if (!isAvailable && lastErrorType === 'no_mpesa_config' && lastCheck?.invoiceId) {
      console.log('🔄 Setting up M-Pesa availability polling (30s interval)...');
      
      const interval = setInterval(() => {
        if (!isChecking && lastCheck.invoiceId) {
          console.log('🔄 Auto re-checking M-Pesa availability...');
          checkAvailability(lastCheck.invoiceId);
        }
      }, 30000); // 30 seconds

      return () => {
        console.log('🛑 Clearing M-Pesa availability polling');
        clearInterval(interval);
      };
    }
  }, [isAvailable, lastErrorType, isChecking, lastCheck?.invoiceId]);

  return {
    isAvailable,
    isChecking,
    checkAvailability,
    error,
    lastErrorType,
    lastErrorDetails,
    lastCheck,
    lastCheckTimestamp,
    configSource,
  };
}
