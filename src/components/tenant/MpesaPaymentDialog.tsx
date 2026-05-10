import React, { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { parseMpesaError } from '@/utils/mpesaErrorHandler';
import { Loader2, Smartphone, CreditCard, Info, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MpesaPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice?: {
    id: string;
    invoice_number: string;
    amount: number;
    outstanding_amount?: number;
    amount_paid?: number;
    tenant_id: string;
  } | null;
  onPaymentInitiated?: () => void;
}

type PaymentStatus = 'idle' | 'sending' | 'sent' | 'verifying' | 'success' | 'error' | 'cancelled';

export const MpesaPaymentDialog: React.FC<MpesaPaymentDialogProps> = ({
  open,
  onOpenChange,
  invoice,
  onPaymentInitiated
}) => {
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState("");
  // Default to outstanding_amount if partially paid, otherwise full amount
  const [paymentAmount, setPaymentAmount] = useState<number>(
    invoice?.outstanding_amount ?? invoice?.amount ?? 0
  );
  const [loading, setLoading] = useState(false);
  const [landlordShortcode, setLandlordShortcode] = useState<string | null>(null);
  const [landlordTransactionType, setLandlordTransactionType] = useState<string | null>(null);
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  
  // Reset payment amount when invoice changes - use outstanding_amount if available
  useEffect(() => {
    setPaymentAmount(invoice?.outstanding_amount ?? invoice?.amount ?? 0);
  }, [invoice?.amount, invoice?.outstanding_amount]);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get landlord M-Pesa config info when dialog opens
  useEffect(() => {
    if (open && invoice?.id) {
      console.log('💳 [M-Pesa Dialog] Opened for invoice:', {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        amount: invoice.amount,
        tenant_id: invoice.tenant_id
      });
      
      const checkLandlordConfig = async () => {
        try {
          console.log('🔍 [M-Pesa Dialog] Probing landlord config with dryRun...');
          const { data } = await supabase.functions.invoke('mpesa-stk-push', {
            body: {
              phone: '254700000000',
              amount: 1,
              invoiceId: invoice.id,
              paymentType: 'rent',
              dryRun: true
            }
          });
          
          console.log('📋 [M-Pesa Dialog] DryRun response:', data);
          
          const provider = data?.data?.Provider ?? data?.Provider;
          const till = data?.data?.TillNumber ?? data?.TillNumber ?? data?.data?.BusinessShortCode;
          const txType = data?.data?.TransactionType;
          
          if (provider === 'kopokopo' && till) {
            console.log('✅ [M-Pesa Dialog] Kopo Kopo config detected:', { till, txType });
            setLandlordShortcode(till);
            setLandlordTransactionType('CustomerBuyGoodsOnline');
          } else if (data?.data?.BusinessShortCode) {
            console.log('✅ [M-Pesa Dialog] Paybill/Till config detected:', { shortcode: data.data.BusinessShortCode, txType });
            setLandlordShortcode(data.data.BusinessShortCode);
            setLandlordTransactionType(txType);
          } else {
            console.warn('⚠️ [M-Pesa Dialog] Could not determine landlord shortcode from response');
          }
        } catch (error) {
          console.error('❌ [M-Pesa Dialog] Error during config probe:', error);
        }
      };
      
      checkLandlordConfig();
    }
  }, [open, invoice?.id]);

  const startStatusPolling = useCallback((requestId: string) => {
    let pollCount = 0;
    const maxPolls = 100; // 5 minutes (3s * 100)
    
    setStatus('verifying');
    setStatusMessage('Waiting for payment confirmation...');
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    pollingIntervalRef.current = setInterval(async () => {
      pollCount++;
      
      try {
        const { data: transaction, error } = await supabase
          .from('mpesa_transactions')
          .select('result_code, result_desc, status, mpesa_receipt_number')
          .eq('checkout_request_id', requestId)
          .maybeSingle();
        
        // If no result by checkout_request_id after a few attempts, try by invoice_id (for Kopo Kopo)
        if ((!transaction || (transaction.result_code === null && transaction.status === 'pending')) && pollCount > 3) {
          const { data: invoiceTransaction } = await supabase
            .from('mpesa_transactions')
            .select('result_code, result_desc, status, mpesa_receipt_number')
            .eq('invoice_id', invoice?.id || '')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (invoiceTransaction && (String(invoiceTransaction.result_code) === '0' || invoiceTransaction.status === 'completed')) {
            clearInterval(pollingIntervalRef.current!);
            setStatus('success');
            setStatusMessage('Payment completed successfully!');
            
            if (invoice?.id) {
              await supabase
                .from('invoices')
                .update({ 
                  status: 'paid',
                  mpesa_receipt_number: invoiceTransaction.mpesa_receipt_number || invoiceTransaction.result_desc 
                })
                .eq('id', invoice.id);
            }
            
            toast({
              title: "Payment Successful",
              description: "Your rent payment has been processed.",
            });
            
            setTimeout(() => {
              onPaymentInitiated?.();
              onOpenChange(false);
              resetDialog();
            }, 2000);
            return;
          } else if (invoiceTransaction && (invoiceTransaction.status === 'failed' || invoiceTransaction.status === 'cancelled' || (invoiceTransaction.result_code != null && Number(invoiceTransaction.result_code) !== 0))) {
            clearInterval(pollingIntervalRef.current!);
            setStatus('error');
            setStatusMessage(invoiceTransaction.result_desc || 'Payment failed');
            toast({
              title: "Payment Failed",
              description: invoiceTransaction.result_desc || 'Payment was not completed',
              variant: "destructive",
            });
            return;
          }
        }
        
        // Continue polling if no transaction or result not yet available
        if (!transaction || (transaction.result_code === null && transaction.status === 'pending')) {
          if (pollCount >= maxPolls) {
            clearInterval(pollingIntervalRef.current!);
            setStatus('error');
            setStatusMessage('Payment verification timed out. Please check your payment status.');
            toast({
              title: "Verification Timeout",
              description: "We couldn't verify your payment. Please contact support if money was deducted.",
              variant: "destructive",
            });
          }
          return;
        }
        
        // Check for success
        if (String(transaction.result_code) === '0' || transaction.status === 'completed') {
          clearInterval(pollingIntervalRef.current!);
          setStatus('success');
          setStatusMessage('Payment completed successfully!');
          
          // Update invoice status
          if (invoice?.id) {
            await supabase
              .from('invoices')
              .update({ 
                status: 'paid',
                mpesa_receipt_number: transaction.mpesa_receipt_number || transaction.result_desc 
              })
              .eq('id', invoice.id);
          }
          
          toast({
            title: "Payment Successful",
            description: "Your rent payment has been processed.",
          });
          
          setTimeout(() => {
            onPaymentInitiated?.();
            onOpenChange(false);
            resetDialog();
          }, 2000);
        } 
        // Check for failure
        else if (transaction.status === 'failed' || transaction.status === 'cancelled' || Number(transaction.result_code) !== 0) {
          clearInterval(pollingIntervalRef.current!);
          setStatus('error');
          setStatusMessage(transaction.result_desc || 'Payment failed');
          toast({
            title: "Payment Failed",
            description: transaction.result_desc || 'Payment was not completed',
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error polling payment status:', error);
      }
    }, 3000);
  }, [invoice, onPaymentInitiated, onOpenChange, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('📤 [M-Pesa Dialog] Payment submission started');
    
    if (!invoice) {
      console.warn('⚠️ [M-Pesa Dialog] Invoice information missing');
      toast({
        title: "Error",
        description: "Invoice information is missing",
        variant: "destructive",
      });
      return;
    }
    
    if (!phoneNumber.trim()) {
      console.warn('⚠️ [M-Pesa Dialog] Phone number missing');
      toast({
        title: "Error",
        description: "Please enter your phone number",
        variant: "destructive",
      });
      return;
    }

    // Validate phone number format
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 9) {
      console.warn('⚠️ [M-Pesa Dialog] Invalid phone number:', cleanPhone);
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid Kenyan phone number",
        variant: "destructive",
      });
      return;
    }

    // Validate payment amount
    if (paymentAmount < 1) {
      toast({
        title: "Invalid Amount",
        description: "Minimum payment amount is KES 1",
        variant: "destructive",
      });
      return;
    }

    console.log('✅ [M-Pesa Dialog] Validation passed, initiating STK push');
    setStatus('sending');
    setStatusMessage('Initiating payment request...');
    setLoading(true);

    try {
      // Pre-flight auth check
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('❌ [M-Pesa Dialog] Session expired or invalid');
        toast({
          title: "Session Expired",
          description: "Your session has expired. Please log in again.",
          variant: "destructive",
        });
        setStatus('error');
        setStatusMessage('Session expired');
        setLoading(false);
        return;
      }
      
      // Refresh token if close to expiry (within 5 minutes)
      const expiresAt = session.expires_at;
      const now = Math.floor(Date.now() / 1000);
      if (expiresAt && (expiresAt - now) < 300) {
        console.log('🔄 [M-Pesa Dialog] Refreshing session before payment...');
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.error('❌ [M-Pesa Dialog] Session refresh failed:', refreshError);
          toast({
            title: "Session Refresh Failed",
            description: "Failed to refresh session. Please log in again.",
            variant: "destructive",
          });
          setStatus('error');
          setStatusMessage('Session refresh failed');
          setLoading(false);
          return;
        }
        console.log('✅ [M-Pesa Dialog] Session refreshed successfully');
      }
      
      const payload = {
        phone: phoneNumber,
        amount: paymentAmount,
        accountReference: invoice.invoice_number,
        transactionDesc: `Rent payment for ${invoice.invoice_number}`,
        invoiceId: invoice.id,
        paymentType: 'rent'
      };
      
      console.log('📤 [M-Pesa Dialog] Sending STK push payload:', {
        ...payload,
        phone: payload.phone.substring(0, 6) + '****' // Mask phone number in logs
      });
      
      const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
        body: payload
      });

      if (error) {
        console.error('❌ [M-Pesa Dialog] STK push error:', JSON.stringify(error, null, 2));
        
        const mpesaError = parseMpesaError(error);
        
        setStatus('error');
        
        if (mpesaError.requiresAction) {
          setStatusMessage(`${mpesaError.userMessage}\n\n${mpesaError.requiresAction}`);
        } else {
          setStatusMessage(mpesaError.userMessage);
        }
        
        toast({
          title: "Payment Failed",
          description: mpesaError.userMessage,
          variant: "destructive",
        });
        return;
      }
      
      console.log('📨 [M-Pesa Dialog] STK push response received:', {
        hasCheckoutRequestID: !!data?.CheckoutRequestID,
        success: data?.success
      });
      
      if (data?.CheckoutRequestID) {
        console.log('✅ [M-Pesa Dialog] Payment request sent, CheckoutRequestID:', data.CheckoutRequestID);
        setCheckoutRequestId(data.CheckoutRequestID);
        setStatus('sent');
        setStatusMessage('Check your phone for the M-Pesa prompt and enter your PIN');
        
        toast({
          title: "Payment Request Sent",
          description: "Please check your phone for the M-Pesa prompt",
        });
        
        // Start polling for payment status
        startStatusPolling(data.CheckoutRequestID);
      } else if (data?.success) {
        // Fallback for old response format
        toast({
          title: "Payment Request Sent",
          description: "STK push sent. Please check your phone.",
        });
        
        onPaymentInitiated?.();
        onOpenChange(false);
        resetDialog();
      } else {
        throw new Error(data?.error || 'Payment request failed');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      setStatus('error');
      setStatusMessage(error.message || 'An unexpected error occurred');
      toast({
        title: "Payment Error",
        description: "Failed to process payment request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetDialog = () => {
    setStatus('idle');
    setStatusMessage('');
    setCheckoutRequestId(null);
    setPhoneNumber('');
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  const handleRetry = () => {
    resetDialog();
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

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-green-600" />
            M-Pesa Payment
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Payment info */}
          {invoice && (
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Invoice:</span>
                <span className="text-sm font-medium">{invoice.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Invoice Amount:</span>
                <span className="text-sm">KES {invoice.amount.toLocaleString()}</span>
              </div>
              {invoice.amount_paid !== undefined && invoice.amount_paid > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span className="text-sm">Amount Paid:</span>
                  <span className="text-sm font-medium">KES {invoice.amount_paid.toLocaleString()}</span>
                </div>
              )}
              {invoice.outstanding_amount !== undefined && invoice.outstanding_amount !== invoice.amount && (
                <div className="flex justify-between text-orange-600 font-medium">
                  <span className="text-sm">Outstanding Balance:</span>
                  <span className="text-sm">KES {invoice.outstanding_amount.toLocaleString()}</span>
                </div>
              )}
              {status === 'idle' && (
                <div className="flex justify-between items-center">
                  <Label htmlFor="dialogPaymentAmount" className="text-sm text-muted-foreground">Pay Amount:</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">KES</span>
                    <Input
                      id="dialogPaymentAmount"
                      type="number"
                      min="1"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(Math.max(1, Number(e.target.value)))}
                      className="w-24 text-right font-medium"
                    />
                  </div>
                </div>
              )}
              {status === 'idle' && paymentAmount !== invoice.amount && (
                <Alert variant="default" className={cn(
                  "py-2 mt-2",
                  paymentAmount < invoice.amount && "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30",
                  paymentAmount > invoice.amount && "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
                )}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {paymentAmount < invoice.amount 
                      ? `Partial payment: KES ${(invoice.amount - paymentAmount).toLocaleString()} will remain outstanding`
                      : `Overpayment: KES ${(paymentAmount - invoice.amount).toLocaleString()} will be credited to your account`
                    }
                  </AlertDescription>
                </Alert>
              )}
              {landlordShortcode && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">
                    {landlordTransactionType === 'CustomerBuyGoodsOnline' ? 'Till:' : 'Paybill:'}
                  </span>
                  <span className="text-sm font-medium">{landlordShortcode}</span>
                </div>
              )}
            </div>
          )}

          {/* Status alert */}
          {status !== 'idle' && (
            <Alert className={cn(
              "mt-4",
              status === 'success' && "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950",
              status === 'error' && "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950",
              status === 'sent' && "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950",
              status === 'verifying' && "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
            )}>
              <div className="flex items-center gap-3">
                {getStatusIcon()}
                <div className="flex-1">
                  <AlertTitle className="mb-1">
                    {status === 'sending' && 'Processing...'}
                    {status === 'sent' && `Check Your Phone${landlordShortcode && landlordTransactionType === 'CustomerBuyGoodsOnline' ? ` • Kopo Kopo Till ${landlordShortcode}` : ''}`}
                    {status === 'verifying' && `Verifying Payment...${landlordShortcode && landlordTransactionType === 'CustomerBuyGoodsOnline' ? ` • Kopo Kopo Till ${landlordShortcode}` : ''}`}
                    {status === 'success' && 'Payment Successful!'}
                    {status === 'error' && 'Payment Failed'}
                  </AlertTitle>
                  <AlertDescription>{statusMessage}</AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          {/* Info alert for idle state */}
          {status === 'idle' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p>You'll receive an STK push notification on your phone to complete the payment.</p>
                </div>
              </div>
            </div>
          )}

          {/* Phone number input - only show in idle state */}
          {status === 'idle' && (
            <div className="space-y-2">
              <Label htmlFor="phone">M-Pesa Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="e.g., 0701234567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Enter the phone number registered with M-Pesa
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-4">
            {status === 'idle' && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !phoneNumber}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Pay Now
                    </>
                  )}
                </Button>
              </>
            )}

            {(status === 'sent' || status === 'verifying') && (
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
            )}

            {status === 'success' && (
              <Button onClick={handleClose} className="flex-1">
                Close
              </Button>
            )}

            {status === 'error' && (
              <>
                <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                  Close
                </Button>
                <Button onClick={handleRetry} className="flex-1">
                  Try Again
                </Button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
