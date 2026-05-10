import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Smartphone, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MpesaTestPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  landlordId: string;
}

type PaymentStatus = 'idle' | 'sending' | 'waiting' | 'verifying' | 'success' | 'failed';

export function MpesaTestPaymentDialog({ open, onOpenChange, landlordId }: MpesaTestPaymentDialogProps) {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("10");
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [receiptNumber, setReceiptNumber] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      // Small delay to allow close animation
      setTimeout(() => {
        setStatus('idle');
        setPhone("");
        setAmount("10");
        setTransactionId(null);
        setReceiptNumber(null);
        setErrorMessage(null);
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
      }, 300);
    }
  }, [open, pollingInterval]);

  const validatePhone = (phoneNumber: string): string | null => {
    // Remove spaces and any non-numeric characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Check if it starts with 254
    if (cleaned.startsWith('254')) {
      if (cleaned.length === 12) {
        return cleaned;
      }
      return null;
    }
    
    // Check if it starts with 0 (local format)
    if (cleaned.startsWith('0')) {
      if (cleaned.length === 10) {
        return '254' + cleaned.substring(1);
      }
      return null;
    }
    
    // Check if it's just 9 digits (without prefix)
    if (cleaned.length === 9) {
      return '254' + cleaned;
    }
    
    return null;
  };

  // Mark Safaricom configs as verified after successful test payment
  const markConfigAsVerified = async () => {
    try {
      const { data: activeConfig } = await supabase
        .from('landlord_mpesa_configs')
        .select('id, shortcode_type')
        .eq('landlord_id', landlordId)
        .eq('is_active', true)
        .maybeSingle();
      
      // Only auto-verify Safaricom configs (Kopo Kopo uses OAuth verification)
      if (activeConfig && activeConfig.shortcode_type !== 'till_kopokopo') {
        const { error } = await supabase
          .from('landlord_mpesa_configs')
          .update({
            credentials_verified: true,
            last_verified_at: new Date().toISOString()
          })
          .eq('id', activeConfig.id);
        
        if (error) {
          console.error('Error marking config as verified:', error);
        } else {
          console.log('✅ Config auto-verified after successful test payment');
        }
      }
    } catch (error) {
      console.error('Error in markConfigAsVerified:', error);
    }
  };

  const startStatusPolling = (txnId: string) => {
    let pollCount = 0;
    const maxPolls = 60; // 5 minutes (60 * 5 seconds)

    const interval = setInterval(async () => {
      pollCount++;

      if (pollCount > maxPolls) {
        clearInterval(interval);
        setPollingInterval(null);
        setStatus('failed');
        setErrorMessage("Payment verification timed out. Please check your M-Pesa messages.");
        return;
      }

      const { data, error} = await supabase
        .from('mpesa_transactions')
        .select('status, result_code, result_desc, mpesa_receipt_number')
        .eq('checkout_request_id', txnId)
        .maybeSingle();

      if (error) {
        console.error('Error polling transaction:', error);
        return;
      }

      if (!data) return;

      // Check for final states
      if (data.result_code !== null && data.result_code !== undefined) {
        clearInterval(interval);
        setPollingInterval(null);

        if (data.result_code === 0 || data.status === 'completed') {
          setStatus('success');
          setReceiptNumber(data.mpesa_receipt_number || null);
          
          // Auto-verify Safaricom configs on successful test payment
          await markConfigAsVerified();
          
          toast({
            title: "✅ Test Payment Successful!",
            description: `Your M-Pesa configuration is working correctly. Receipt: ${data.mpesa_receipt_number}`,
          });
        } else {
          setStatus('failed');
          setErrorMessage(data.result_desc || "Payment failed. Please try again.");
        }
      } else if (data.status === 'failed' || data.status === 'cancelled') {
        clearInterval(interval);
        setPollingInterval(null);
        setStatus('failed');
        setErrorMessage(data.result_desc || "Payment failed or was cancelled.");
      }
    }, 5000); // Poll every 5 seconds

    setPollingInterval(interval);
  };

  const handleSendTestPayment = async () => {
    // Validate phone
    const validatedPhone = validatePhone(phone);
    if (!validatedPhone) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid Kenyan phone number (e.g., 0712345678 or 254712345678)",
        variant: "destructive",
      });
      return;
    }

    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 1) {
      toast({
        title: "Invalid Amount",
        description: "Amount must be at least KES 1",
        variant: "destructive",
      });
      return;
    }

    setStatus('sending');
    setErrorMessage(null);

    try {
      // Initiate STK push
      const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
        body: {
          phone: validatedPhone,
          amount: amountNum,
          accountReference: 'CONFIG-TEST',
          transactionDesc: 'M-Pesa Configuration Test',
          landlordId: landlordId,
          paymentType: 'test',
          dryRun: false, // Real payment
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to send payment request');
      }

      if (!data?.success) {
        const errorDetails = data?.error || 'Failed to initiate payment';
        setErrorMessage(errorDetails);
        throw new Error(errorDetails);
      }

      // Payment request sent successfully
      setTransactionId(data.CheckoutRequestID || null);
      setStatus('waiting');

      // Start polling for status
      if (data.CheckoutRequestID) {
        startStatusPolling(data.CheckoutRequestID);
        
        // After 3 seconds, move to verifying status
        setTimeout(() => {
          setStatus('verifying');
        }, 3000);
      }

    } catch (error: any) {
      console.error('Test payment error:', error);
      setStatus('failed');
      
      let errorMsg = "Failed to send test payment. ";
      if (error.message) {
        const msg = error.message.toLowerCase();
        if (msg.includes('oauth') || msg.includes('token') || msg.includes('401')) {
          errorMsg += "Authentication failed. Please check your credentials.";
        } else if (msg.includes('passkey')) {
          errorMsg += "Invalid passkey.";
        } else if (msg.includes('shortcode')) {
          errorMsg += "Invalid shortcode or till number.";
        } else if (msg.includes('network') || msg.includes('timeout')) {
          errorMsg += "Network error. Please try again.";
        } else {
          errorMsg += error.message;
        }
      }
      
      setErrorMessage(errorMsg);
      toast({
        title: "Test Payment Failed",
        description: errorMsg,
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {status === 'idle' && "Test M-Pesa Configuration"}
            {status === 'sending' && "Sending Payment Request..."}
            {status === 'waiting' && "📱 Check Your Phone"}
            {status === 'verifying' && "Verifying Payment..."}
            {status === 'success' && "✅ Test Successful!"}
            {status === 'failed' && "❌ Test Failed"}
          </DialogTitle>
          <DialogDescription>
            {status === 'idle' && "Send a real test payment to verify your M-Pesa credentials work end-to-end"}
            {status === 'sending' && "Initiating M-Pesa STK push..."}
            {(status === 'waiting' || status === 'verifying') && `M-Pesa prompt sent to ${phone}`}
            {status === 'success' && "Your M-Pesa configuration is working correctly!"}
            {status === 'failed' && "The test payment could not be completed"}
          </DialogDescription>
        </DialogHeader>

        {status === 'idle' && (
          <div className="space-y-4 py-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This will send a real M-Pesa payment request. You will be charged the test amount.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="flex gap-2">
                <div className="flex items-center justify-center px-3 bg-muted rounded-md border border-input text-sm text-muted-foreground">
                  254
                </div>
                <Input
                  id="phone"
                  placeholder="712345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={12}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter without country code (e.g., 712345678)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Test Amount (KES)</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                max="100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Minimum: KES 1 (Recommended: KES 10)
              </p>
            </div>
          </div>
        )}

        {(status === 'waiting' || status === 'verifying') && (
          <div className="space-y-4 py-6">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <Smartphone className="h-16 w-16 text-primary" />
                <Loader2 className="h-6 w-6 text-primary animate-spin absolute -top-1 -right-1" />
              </div>
              <div className="space-y-2">
                <p className="font-medium">
                  {status === 'waiting' ? "Check your phone for M-Pesa prompt" : "Verifying payment..."}
                </p>
                <p className="text-sm text-muted-foreground">
                  {status === 'waiting' 
                    ? "Enter your M-Pesa PIN to complete the test payment"
                    : "Please wait while we confirm the payment status"}
                </p>
              </div>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <div className="space-y-2">
                <p className="font-medium text-green-600">Configuration verified successfully!</p>
                <p className="text-sm text-muted-foreground">
                  Your M-Pesa credentials are working correctly
                </p>
              </div>
            </div>

            <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
              {receiptNumber && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Receipt:</span>
                  <span className="font-medium">{receiptNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-medium">KES {amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time:</span>
                <span className="font-medium">{new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        )}

        {status === 'failed' && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <XCircle className="h-16 w-16 text-destructive" />
              <div className="space-y-2">
                <p className="font-medium text-destructive">Test payment failed</p>
                {errorMessage && (
                  <p className="text-sm text-muted-foreground">{errorMessage}</p>
                )}
              </div>
            </div>

            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please verify your credentials and try again, or contact support if the issue persists.
              </AlertDescription>
            </Alert>
            
            {errorMessage?.includes('pending request') && (
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Common causes:</strong>
                  <ul className="list-disc ml-4 mt-2 space-y-1">
                    <li>You have an incomplete M-Pesa transaction on your phone</li>
                    <li>Wait 2-3 minutes for the previous request to expire</li>
                    <li>Check your phone for any pending M-Pesa prompts and complete or cancel them</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          {status === 'idle' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleSendTestPayment}>
                Send Test Payment
              </Button>
            </>
          )}

          {(status === 'waiting' || status === 'verifying') && (
            <Button variant="outline" onClick={handleClose} className="w-full">
              Cancel
            </Button>
          )}

          {(status === 'success' || status === 'failed') && (
            <div className="flex gap-2 w-full">
              {status === 'failed' && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setStatus('idle');
                    setErrorMessage(null);
                  }}
                  className="flex-1"
                >
                  Try Again
                </Button>
              )}
              <Button onClick={handleClose} className="flex-1">
                Close
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
