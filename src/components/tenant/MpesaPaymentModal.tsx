import { useState, useCallback, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseMpesaError } from "@/utils/mpesaErrorHandler";
import { Smartphone, DollarSign, Loader2, Clock, CheckCircle2, XCircle, AlertCircle, Radio } from "lucide-react";
import { formatAmount, getGlobalCurrencySync } from "@/utils/currency";
import { cn } from "@/lib/utils";
import { useRealtimeMpesaStatus } from "@/hooks/useRealtimeMpesaStatus";
import { useQueryClient } from "@tanstack/react-query";

interface MpesaPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: {
    id: string;
    invoice_number: string;
    amount: number;
    description: string;
  };
  onPaymentInitiated?: () => void;
}

type PaymentStatus = 'idle' | 'sending' | 'sent' | 'verifying' | 'success' | 'error' | 'cancelled';

export function MpesaPaymentModal({ 
  open, 
  onOpenChange, 
  invoice, 
  onPaymentInitiated 
}: MpesaPaymentModalProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [paymentAmount, setPaymentAmount] = useState<number>(invoice.amount);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<string>('');
  const [tillNumber, setTillNumber] = useState<string>('');
  
  // Reset payment amount when invoice changes
  useEffect(() => {
    setPaymentAmount(invoice.amount);
  }, [invoice.amount]);
  
  // React Query client for cache invalidation
  const queryClient = useQueryClient();
  
  // Use realtime hook for payment status updates (with invoice_id for Kopo Kopo)
  const { transaction, isListening } = useRealtimeMpesaStatus(checkoutRequestId, {
    invoiceId: invoice.id,
    provider: paymentProvider
  });
  
  // Polling state
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingAttemptsRef = useRef<number>(0);
  const maxPollingAttempts = 12; // 12 attempts * 10 seconds = 2 minutes
  
  // Kopo Kopo verify fallback state
  const verifyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const verifyAttemptedRef = useRef(false);
  const [manualVerifyLoading, setManualVerifyLoading] = useState(false);
  
  // Refs to prevent duplicate processing and status flicker
  const lastProcessedResultCodeRef = useRef<number | null>(null);
  const isProcessingRef = useRef(false);

  const formatPhoneNumber = (phone: string) => {
    let cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      cleaned = '254' + cleaned;
    } else if (!cleaned.startsWith('254')) {
      cleaned = '254' + cleaned;
    }
    
    return cleaned;
  };

  // Handle realtime transaction updates
  useEffect(() => {
    if (!transaction) return;

    // Don't overwrite success state with later updates
    if (status === 'success') {
      console.log('⚠️ Ignoring update - payment already succeeded');
      return;
    }
    
    // Prevent concurrent processing
    if (isProcessingRef.current) {
      console.log('⏸️ Already processing status change, skipping...');
      return;
    }

    console.log('📊 Transaction object changed:', {
      resultCode: transaction.result_code,
      resultCodeType: typeof transaction.result_code,
      resultDesc: transaction.result_desc,
      lastProcessed: lastProcessedResultCodeRef.current,
      currentModalStatus: status,
      timestamp: new Date().toISOString()
    });
    
    // Stop polling when realtime update arrives
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      pollingAttemptsRef.current = 0;
    }

    const txStatus = transaction.status?.toLowerCase();
    
    // Success conditions: result_code === 0 (Safaricom) OR status === 'completed' (Kopo Kopo)
    if (transaction.result_code !== null && transaction.result_code !== undefined) {
      // Convert to number for reliable comparison
      const resultCode = Number(transaction.result_code);
      
      // Skip if we've already processed this exact result_code
      if (lastProcessedResultCodeRef.current === resultCode) {
        console.log('⏭️ Skipping - already processed result_code:', resultCode);
        return;
      }
      
      console.log('🔍 Processing new result code:', {
        raw: transaction.result_code,
        converted: resultCode,
        isZero: resultCode === 0,
        status: txStatus,
        previouslyProcessed: lastProcessedResultCodeRef.current
      });
      
      // Update the last processed result code
      lastProcessedResultCodeRef.current = resultCode;
      
      if (resultCode === 0) {
        isProcessingRef.current = true;
        setStatus('success');
        setStatusMessage('Payment completed successfully!');
        
        // Update invoice status
        (async () => {
          try {
            await supabase
              .from('invoices')
              .update({ 
                status: 'paid',
                mpesa_receipt_number: transaction.mpesa_receipt_number || transaction.result_desc 
              })
              .eq('id', invoice.id);
            
            toast.success("Payment successful!");
            
            // Invalidate tenant dashboard cache for instant refresh
            queryClient.invalidateQueries({ queryKey: ['tenant-dashboard'] });
            
            setTimeout(() => {
              onPaymentInitiated?.();
              onOpenChange(false);
              resetDialog();
            }, 2000);
          } finally {
            isProcessingRef.current = false;
          }
        })();
      } else {
        isProcessingRef.current = true;
        setStatus('error');
        setStatusMessage(transaction.result_desc || `Payment failed (Code: ${transaction.result_code})`);
        toast.error(transaction.result_desc || 'Payment failed');
        isProcessingRef.current = false;
      }
    } else if (txStatus === 'completed') {
      // Kopo Kopo completed status (no result_code set yet)
      console.log('✅ Kopo Kopo payment completed (status-based)');
      lastProcessedResultCodeRef.current = 0; // Mark as processed
      
      isProcessingRef.current = true;
      setStatus('success');
      setStatusMessage('Payment completed successfully!');
      
      // Update invoice status
      (async () => {
        try {
          await supabase
            .from('invoices')
            .update({ 
              status: 'paid',
              mpesa_receipt_number: transaction.mpesa_receipt_number || transaction.result_desc 
            })
            .eq('id', invoice.id);
          
          toast.success("Payment successful!");
          
          // Invalidate tenant dashboard cache for instant refresh
          queryClient.invalidateQueries({ queryKey: ['tenant-dashboard'] });
          
          setTimeout(() => {
            onPaymentInitiated?.();
            onOpenChange(false);
            resetDialog();
          }, 2000);
        } finally {
          isProcessingRef.current = false;
        }
      })();
    } else if (txStatus === 'failed') {
      // Kopo Kopo failed status
      console.log('❌ Kopo Kopo payment failed (status-based)');
      lastProcessedResultCodeRef.current = 1; // Mark as processed
      
      isProcessingRef.current = true;
      setStatus('error');
      setStatusMessage(transaction.result_desc || 'Payment failed');
      toast.error(transaction.result_desc || 'Payment failed');
      isProcessingRef.current = false;
    }
  }, [transaction, status, invoice.id, onPaymentInitiated, onOpenChange, queryClient]);

  // Kopo Kopo verify fallback (after 30-45 seconds of verifying)
  useEffect(() => {
    // Only for Kopo Kopo payments in verifying state
    if (status !== 'verifying' || !checkoutRequestId || paymentProvider !== 'kopokopo' || verifyAttemptedRef.current) {
      return;
    }

    console.log('⏱️ Starting Kopo Kopo verify timeout (45 seconds)...');
    
    verifyTimeoutRef.current = setTimeout(async () => {
      console.log('🔍 Triggering Kopo Kopo manual verification...');
      verifyAttemptedRef.current = true;
      
      try {
        setStatusMessage('Contacting payment provider for verification...');
        
        const { data, error } = await supabase.functions.invoke('kopokopo-verify', {
          body: { checkoutRequestId }
        });

        if (error) {
          console.error('❌ Verify function error:', error);
          return; // Continue with normal polling
        }

        console.log('✅ Verify response:', data);

        if (data.status === 'completed') {
          setStatus('success');
          setStatusMessage('Payment completed successfully!');
          
          // Invoice already updated by edge function
          toast.success("Payment successful!");
          queryClient.invalidateQueries({ queryKey: ['tenant-dashboard'] });
          
          setTimeout(() => {
            onPaymentInitiated?.();
            onOpenChange(false);
            resetDialog();
          }, 2000);
        } else if (data.status === 'failed') {
          setStatus('error');
          setStatusMessage(data.result_desc || 'Payment failed');
          toast.error(data.result_desc || 'Payment failed');
        }
      } catch (err) {
        console.error('Verify exception:', err);
        // Continue with normal polling
      }
    }, 45000); // 45 seconds

    return () => {
      if (verifyTimeoutRef.current) {
        clearTimeout(verifyTimeoutRef.current);
        verifyTimeoutRef.current = null;
      }
    };
  }, [status, checkoutRequestId, paymentProvider, invoice.id, onPaymentInitiated, onOpenChange, queryClient, supabase]);

  // Fallback polling mechanism
  useEffect(() => {
    // Only start polling when in verifying state and checkoutRequestId exists
    if (status !== 'verifying' || !checkoutRequestId) {
      return;
    }

    console.log('🔄 Starting fallback polling for transaction:', checkoutRequestId);
    pollingAttemptsRef.current = 0;

    const pollTransaction = async () => {
      pollingAttemptsRef.current += 1;
      console.log(`🔍 Polling attempt ${pollingAttemptsRef.current}/${maxPollingAttempts}`);

      try {
        // First try by checkout_request_id
        let { data, error } = await supabase
          .from('mpesa_transactions')
          .select('*')
          .eq('checkout_request_id', checkoutRequestId)
          .maybeSingle();

        // If no result and Kopo Kopo, also try by invoice_id (after a few attempts)
        if (!data && paymentProvider === 'kopokopo' && pollingAttemptsRef.current > 2) {
          console.log('🔄 Polling by invoice_id as fallback for Kopo Kopo');
          const invoiceQuery = await supabase
            .from('mpesa_transactions')
            .select('*')
            .eq('invoice_id', invoice.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          data = invoiceQuery.data;
          error = invoiceQuery.error;
        }

        if (error) {
          console.error('Polling error:', error);
          return;
        }

        const pollStatus = data?.status?.toLowerCase();
        
        // Success conditions: result_code === 0 OR status === 'completed'
        if ((data && data.result_code !== null && data.result_code !== undefined) || pollStatus === 'completed' || pollStatus === 'failed') {
          console.log('✅ Polling found transaction result:', {
            resultCode: data.result_code,
            resultCodeType: typeof data.result_code,
            status: pollStatus,
            resultDesc: data.result_desc
          });
          
          // Clear polling interval
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }

          // Convert to number for reliable comparison
          const resultCode = data.result_code !== null ? Number(data.result_code) : null;
          
          console.log('🔍 Polling result code comparison:', {
            raw: data.result_code,
            converted: resultCode,
            status: pollStatus,
            isSuccess: resultCode === 0 || pollStatus === 'completed'
          });

          // Process the result: result_code === 0 OR status === 'completed'
          if (resultCode === 0 || pollStatus === 'completed') {
            setStatus('success');
            setStatusMessage('Payment completed successfully!');
            
            // Update invoice status
            await supabase
              .from('invoices')
              .update({ 
                status: 'paid',
                mpesa_receipt_number: data.mpesa_receipt_number || data.result_desc 
              })
              .eq('id', invoice.id);

            toast.success("Payment successful!");
            
            // Invalidate tenant dashboard cache for instant refresh
            queryClient.invalidateQueries({ queryKey: ['tenant-dashboard'] });
            
            setTimeout(() => {
              onPaymentInitiated?.();
              onOpenChange(false);
              resetDialog();
            }, 2000);
          } else {
            setStatus('error');
            setStatusMessage(data.result_desc || `Payment failed (Code: ${data.result_code || 'N/A'})`);
            toast.error(data.result_desc || 'Payment failed');
          }
        } else if (pollingAttemptsRef.current >= maxPollingAttempts) {
          // Max attempts reached
          console.warn('⏱️ Polling timeout - max attempts reached');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setStatus('error');
          setStatusMessage('Payment verification timed out. Please check your M-Pesa messages or contact support.');
          toast.error('Verification timed out');
        }
      } catch (err) {
        console.error('Polling exception:', err);
      }
    };

    // Start polling every 10 seconds
    pollingIntervalRef.current = setInterval(pollTransaction, 10000);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [status, checkoutRequestId, paymentProvider, invoice.id, onPaymentInitiated, onOpenChange, queryClient]);

  const handlePayment = async () => {
    if (!phoneNumber.trim()) {
      toast.error("Please enter your phone number");
      return;
    }

    setStatus('sending');
    setStatusMessage('Initiating payment request...');
    setLoading(true);
    
    try {
      // Pre-flight auth check
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        toast.error("Your session has expired. Please log in again.");
        setStatus('error');
        setStatusMessage('Session expired');
        setLoading(false);
        return;
      }
      
      // Refresh token if close to expiry (within 5 minutes)
      const expiresAt = session.expires_at;
      const now = Math.floor(Date.now() / 1000);
      if (expiresAt && (expiresAt - now) < 300) {
        console.log('🔄 Refreshing session before M-Pesa payment...');
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          toast.error("Failed to refresh session. Please log in again.");
          setStatus('error');
          setStatusMessage('Session refresh failed');
          setLoading(false);
          return;
        }
      }
      
      const formattedPhone = formatPhoneNumber(phoneNumber);
      
      // Validate phone number format
      if (!/^254[17]\d{8}$/.test(formattedPhone)) {
        toast.error("Please enter a valid Kenyan phone number");
        setStatus('error');
        setStatusMessage('Invalid phone number');
        setLoading(false);
        return;
      }

      // Validate payment amount
      if (paymentAmount < 1) {
        toast.error("Minimum payment amount is KES 1");
        setStatus('idle');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
        body: {
          phone: formattedPhone,
          amount: paymentAmount,
          invoiceId: invoice.id,
          accountReference: invoice.invoice_number,
          transactionDesc: invoice.description || `Payment for ${invoice.invoice_number}`,
          paymentType: 'rent'
        }
      });

      if (error) {
        console.error('STK push error - FULL ERROR OBJECT:', JSON.stringify(error, null, 2));
        
        const mpesaError = parseMpesaError(error);
        
        setStatus('error');
        
        // Build detailed error message
        let fullMessage = mpesaError.userMessage;
        if (mpesaError.errorId) {
          fullMessage += `\n\nError code: ${mpesaError.errorId}`;
        }
        if (mpesaError.requiresAction) {
          fullMessage += `\n\n${mpesaError.requiresAction}`;
        }
        
        setStatusMessage(fullMessage);
        
        toast.error(mpesaError.userMessage, {
          description: mpesaError.errorId ? `Error: ${mpesaError.errorId}` : undefined
        });
        return;
      }

      // Handle both top-level and nested CheckoutRequestID
      const crId = data?.CheckoutRequestID ?? data?.data?.CheckoutRequestID;
      const branch = data?.branch || 'unknown';
      const provider = data?.provider ?? data?.data?.provider ?? 'mpesa';
      const till = data?.tillNumber ?? data?.data?.tillNumber ?? '';
      
      console.log('✅ Payment initiated:', { branch, crId, success: data?.success, provider, till, fullData: data });
      
      // Capture provider and till info
      setPaymentProvider(provider);
      setTillNumber(till);
      
      if (crId) {
        setCheckoutRequestId(crId);
        setStatus('sent');
        setStatusMessage('Check your phone for the M-Pesa prompt and enter your PIN');
        
        toast.success("Payment request sent! Check your phone.");
        
        // Move to verifying state to keep modal open for realtime updates
        setTimeout(() => {
          setStatus('verifying');
          setStatusMessage('Waiting for payment confirmation...');
        }, 1500);
      } else if (data?.success) {
        // Fallback for unexpected response shape - still try to stay in verifying
        console.warn('⚠️ Success but no CheckoutRequestID:', data);
        toast.success("Payment request sent! Please check your phone and enter your M-Pesa PIN.");
        setStatus('verifying');
        setStatusMessage('Waiting for payment confirmation...');
      } else {
        throw new Error(data?.error || data?.userMessage || "Failed to initiate payment");
      }
    } catch (error: any) {
      console.error("Error initiating M-Pesa payment:", error);
      setStatus('error');
      setStatusMessage(error.message || 'An unexpected error occurred');
      toast.error("Failed to initiate payment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetDialog = () => {
    // Clear polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    pollingAttemptsRef.current = 0;
    
    // Clear verify timeout
    if (verifyTimeoutRef.current) {
      clearTimeout(verifyTimeoutRef.current);
      verifyTimeoutRef.current = null;
    }
    verifyAttemptedRef.current = false;
    
    // Reset processing refs
    lastProcessedResultCodeRef.current = null;
    isProcessingRef.current = false;
    
    setStatus('idle');
    setStatusMessage('');
    setCheckoutRequestId(null);
    setPaymentProvider('');
    setTillNumber('');
    setPhoneNumber('');
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  const handleRetry = () => {
    resetDialog();
  };

  const handleManualVerify = async () => {
    if (!checkoutRequestId || paymentProvider !== 'kopokopo' || manualVerifyLoading) {
      return;
    }

    console.log('🔍 Manual verification triggered by user');
    setManualVerifyLoading(true);
    
    try {
      setStatusMessage('Verifying payment with provider...');
      
      const { data, error } = await supabase.functions.invoke('kopokopo-verify', {
        body: { checkoutRequestId }
      });

      if (error) {
        console.error('❌ Manual verify error:', error);
        toast.error('Verification failed. We\'ll keep trying automatically.');
        setStatusMessage('Waiting for payment confirmation...');
        return;
      }

      console.log('✅ Manual verify response:', data);

      if (data.status === 'completed') {
        verifyAttemptedRef.current = true; // Prevent duplicate auto-verify
        setStatus('success');
        setStatusMessage('Payment completed successfully!');
        
        // Invoice already updated by edge function
        toast.success("Payment verified successfully!");
        queryClient.invalidateQueries({ queryKey: ['tenant-dashboard'] });
        
        setTimeout(() => {
          onPaymentInitiated?.();
          onOpenChange(false);
          resetDialog();
        }, 2000);
      } else if (data.status === 'failed') {
        setStatus('error');
        setStatusMessage(data.result_desc || 'Payment failed');
        toast.error(data.result_desc || 'Payment failed');
      } else {
        // Still pending
        toast.info('Payment still processing. Please wait...');
        setStatusMessage('Payment still processing at provider...');
      }
    } catch (err) {
      console.error('Manual verify exception:', err);
      toast.error('Verification failed. We\'ll keep trying automatically.');
      setStatusMessage('Waiting for payment confirmation...');
    } finally {
      setManualVerifyLoading(false);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return <Loader2 className="h-6 w-6 animate-spin text-blue-500" />;
      case 'sent':
        return <Smartphone className="h-6 w-6 animate-pulse text-orange-500" />;
      case 'verifying':
        return <Clock className="h-6 w-6 animate-pulse text-blue-500" />;
      case 'success':
        return <CheckCircle2 className="h-6 w-6 text-green-500" />;
      case 'error':
        return <XCircle className="h-6 w-6 text-red-500" />;
      case 'cancelled':
        return <AlertCircle className="h-6 w-6 text-gray-500" />;
      default:
        return <Smartphone className="h-6 w-6 text-primary" />;
    }
  };

  useEffect(() => {
    if (!open) {
      resetDialog();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-green-600" />
            Pay with M-Pesa
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Invoice Details */}
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Invoice:</span>
                  <span className="font-medium">{invoice.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Invoice Amount:</span>
                  <span className="font-medium flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    {formatAmount(invoice.amount)} {getGlobalCurrencySync()}
                  </span>
                </div>
                {status === 'idle' && (
                  <div className="flex justify-between items-center pt-1">
                    <Label htmlFor="paymentAmount" className="text-sm text-muted-foreground">Pay Amount:</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{getGlobalCurrencySync()}</span>
                      <Input
                        id="paymentAmount"
                        type="number"
                        min="1"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(Math.max(1, Number(e.target.value)))}
                        className="w-28 text-right font-medium"
                      />
                    </div>
                  </div>
                )}
                {status === 'idle' && paymentAmount !== invoice.amount && (
                  <Alert variant="default" className={cn(
                    "mt-2 py-2",
                    paymentAmount < invoice.amount && "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30",
                    paymentAmount > invoice.amount && "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
                  )}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      {paymentAmount < invoice.amount 
                        ? `Partial payment: ${formatAmount(invoice.amount - paymentAmount)} ${getGlobalCurrencySync()} will remain outstanding`
                        : `Overpayment: ${formatAmount(paymentAmount - invoice.amount)} ${getGlobalCurrencySync()} will be credited to your account`
                      }
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Description:</span>
                  <span className="text-sm">{invoice.description}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status alert */}
          {status !== 'idle' && (
            <Alert className={cn(
              status === 'success' && "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950",
              status === 'error' && "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950",
              status === 'sent' && "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950",
              status === 'verifying' && "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
            )}>
              <div className="flex items-center gap-3">
                {getStatusIcon()}
                <div className="flex-1">
                  <AlertTitle className="mb-1 flex items-center gap-2">
                    {status === 'success' && 'Payment Successful'}
                    {status === 'error' && 'Payment Failed'}
                    {status === 'sent' && 'STK Push Sent'}
                    {status === 'verifying' && 'Verifying Payment'}
                    {status === 'sending' && 'Initiating Payment'}
                    {paymentProvider === 'kopokopo' && tillNumber && (
                      <span className="text-xs font-normal text-muted-foreground ml-2">
                        • Kopo Kopo Till {tillNumber}
                      </span>
                    )}
                  </AlertTitle>
                  <AlertDescription className="mb-1 flex items-center gap-2">
                    {status === 'sending' && 'Processing...'}
                    {status === 'sent' && 'Check Your Phone'}
                    {status === 'verifying' && (
                      <>
                        Verifying Payment...
                        {isListening && (
                          <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                            <Radio className="h-3 w-3 animate-pulse text-green-500" />
                            Live updates active
                          </span>
                        )}
                      </>
                    )}
                    {status === 'success' && 'Payment Successful!'}
                    {status === 'error' && 'Payment Failed'}
                  </AlertDescription>
                  <AlertDescription>{statusMessage}</AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          {/* Phone Number Input - only show in idle state */}
          {status === 'idle' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="phone">M-Pesa Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="0712345678 or 254712345678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Enter your M-Pesa registered phone number
                </p>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Payment Instructions:</h4>
                <ol className="text-xs text-muted-foreground space-y-1">
                  <li>1. Enter your M-Pesa phone number above</li>
                  <li>2. Click "Send Payment Request"</li>
                  <li>3. Check your phone for M-Pesa STK push notification</li>
                  <li>4. Enter your M-Pesa PIN to complete payment</li>
                </ol>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {status === 'idle' && (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handlePayment}
                  disabled={loading || !phoneNumber}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sending...
                    </>
                  ) : (
                    "Send Payment Request"
                  )}
                </Button>
              </>
            )}

            {(status === 'sent' || status === 'verifying') && (
              <>
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                {status === 'verifying' && paymentProvider === 'kopokopo' && (
                  <Button 
                    onClick={handleManualVerify}
                    disabled={manualVerifyLoading}
                    className="flex-1"
                    variant="default"
                  >
                    {manualVerifyLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Verifying...
                      </>
                    ) : (
                      "Verify Payment"
                    )}
                  </Button>
                )}
              </>
            )}

            {status === 'success' && (
              <Button onClick={handleClose} className="flex-1">
                Close
              </Button>
            )}

            {status === 'error' && (
              <>
                <Button variant="outline" onClick={handleClose} className="flex-1">
                  Close
                </Button>
                <Button onClick={handleRetry} className="flex-1">
                  Try Again
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
