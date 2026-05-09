import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertTriangle, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ServiceChargeMpesaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: {
    id: string;
    invoice_number: string;
    total_amount: number;
    currency: string;
  };
  onPaymentSuccess?: () => void;
}

export const ServiceChargeMpesaDialog: React.FC<ServiceChargeMpesaDialogProps> = ({
  open,
  onOpenChange,
  invoice,
  onPaymentSuccess,
}) => {
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [landlordShortcode, setLandlordShortcode] = useState<string | null>(null);
  const [landlordTransactionType, setLandlordTransactionType] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'success' | 'error'>('idle');
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);

  // Get landlord M-Pesa config info when dialog opens
  useEffect(() => {
    if (open && invoice?.id) {
      const checkLandlordConfig = async () => {
        try {
          const { data } = await supabase.functions.invoke('mpesa-stk-push', {
            body: {
              phone: '254700000000',
              amount: 1,
              invoiceId: invoice.id,
              paymentType: 'service-charge',
              dryRun: true
            }
          });
          
          if (data?.data?.BusinessShortCode) {
            setLandlordShortcode(data.data.BusinessShortCode);
            setLandlordTransactionType(data.data.TransactionType);
          }
        } catch (error) {
          console.log('Could not determine landlord shortcode');
        }
      };
      
      checkLandlordConfig();
    }
  }, [open, invoice?.id]);

  const formatPhoneNumber = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = '254' + cleaned.slice(1);
    } else if (!cleaned.startsWith('254')) {
      cleaned = '254' + cleaned;
    }
    return cleaned;
  };

  const handleStkPush = async () => {
    if (!phoneNumber.trim()) {
      toast({
        title: "Phone Number Required",
        description: "Please enter your M-Pesa phone number",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setStatus('sending');

    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      
      const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
        body: {
          phone: formattedPhone,
          amount: invoice.total_amount,
          accountReference: invoice.invoice_number,
          transactionDesc: `Service charge payment - ${invoice.invoice_number}`,
          invoiceId: invoice.id,
          paymentType: 'service-charge'
        },
      });

      if (error) throw error;

      if (data.success) {
        setCheckoutRequestId(data.data.CheckoutRequestID);
        setStatus('sent');
        startStatusPolling(data.data.CheckoutRequestID);
        
        // Update service charge invoice with M-Pesa details
        await supabase
          .from('service_charge_invoices')
          .update({
            mpesa_checkout_request_id: data.data.CheckoutRequestID,
            payment_phone_number: formattedPhone,
          })
          .eq('id', invoice.id);

        toast({
          title: "Payment Request Sent",
          description: "Please check your phone and enter your M-Pesa PIN to complete the payment",
        });
      } else {
        throw new Error(data.error || 'STK push failed');
      }
    } catch (error) {
      console.error('M-Pesa STK push error:', error);
      setStatus('error');
      toast({
        title: "Payment Failed",
        description: error instanceof Error ? error.message : "Failed to initiate M-Pesa payment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startStatusPolling = (requestId: string) => {
    let pollCount = 0;
    const maxPolls = 100; // 5 minutes (3s * 100)
    
    const checkStatus = async () => {
      pollCount++;
      
      try {
        const { data: transaction } = await supabase
          .from('mpesa_transactions')
          .select('status, result_code, result_desc, mpesa_receipt_number')
          .eq('checkout_request_id', requestId)
          .maybeSingle();

        // Continue polling if no transaction or result not yet available
        if (!transaction || (transaction.result_code === null && transaction.status === 'pending')) {
          if (pollCount >= maxPolls) {
            setStatus('error');
            toast({
              title: "Payment Timeout",
              description: "Payment verification timed out. Please check your payment status.",
              variant: "destructive",
            });
            return true;
          }
          return false;
        }

        // Check for success
        if (String(transaction.result_code) === '0' || transaction.status === 'completed') {
          setStatus('success');
          
          // Update service charge invoice status
          await supabase
            .from('service_charge_invoices')
            .update({
              status: 'paid',
              payment_date: new Date().toISOString(),
              payment_method: 'mpesa',
              payment_reference: transaction.mpesa_receipt_number || transaction.result_desc,
            })
            .eq('id', invoice.id);

          toast({
            title: "Payment Successful",
            description: `Payment of KES ${invoice.total_amount} completed successfully`,
          });
          
          onPaymentSuccess?.();
          return true;
        } 
        // Check for failure
        else if (transaction.status === 'failed' || transaction.status === 'cancelled' || Number(transaction.result_code) !== 0) {
          setStatus('error');
          toast({
            title: "Payment Failed",
            description: transaction.result_desc || "Payment was not completed",
            variant: "destructive",
          });
          return true;
        }
        
        return false;
      } catch (error) {
        console.error('Error checking payment status:', error);
        return false;
      }
    };

    const pollInterval = setInterval(async () => {
      const completed = await checkStatus();
      if (completed) {
        clearInterval(pollInterval);
      }
    }, 3000);
  };

  const resetDialog = () => {
    setPhoneNumber("");
    setLoading(false);
    setStatus('idle');
    setCheckoutRequestId(null);
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) {
      resetDialog();
    }
  }, [open]);

  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return <Loader2 className="h-6 w-6 animate-spin text-blue-500" />;
      case 'sent':
        return <Phone className="h-6 w-6 text-orange-500 animate-pulse" />;
      case 'success':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'error':
        return <AlertTriangle className="h-6 w-6 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'sending':
        return "Sending payment request...";
      case 'sent':
        return "Check your phone and enter your M-Pesa PIN to complete the payment";
      case 'success':
        return "Payment completed successfully!";
      case 'error':
        return "Payment failed. Please try again.";
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">M</span>
            </div>
            Pay with M-Pesa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Invoice Details */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Invoice:</span>
              <span className="font-medium">{invoice.invoice_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-bold text-lg">
                {invoice.currency} {invoice.total_amount.toLocaleString()}
              </span>
            </div>
            {landlordShortcode && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {landlordTransactionType === 'CustomerBuyGoodsOnline' ? 'Till:' : 'Paybill:'}
                </span>
                <span className="font-medium">{landlordShortcode}</span>
              </div>
            )}
          </div>

          {/* Status Display */}
          {status !== 'idle' && (
            <Alert className={`${
              status === 'success' ? 'border-green-200 bg-green-50' :
              status === 'error' ? 'border-red-200 bg-red-50' :
              'border-blue-200 bg-blue-50'
            }`}>
              <div className="flex items-center gap-3">
                {getStatusIcon()}
                <AlertDescription className="flex-1">
                  {getStatusMessage()}
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Phone Number Input */}
          {status === 'idle' && (
            <div className="space-y-2">
              <Label htmlFor="mpesa-phone">M-Pesa Phone Number</Label>
              <Input
                id="mpesa-phone"
                type="tel"
                placeholder="0712345678 or 254712345678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Enter the phone number registered with M-Pesa
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
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
                  onClick={handleStkPush}
                  disabled={loading || !phoneNumber.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Pay with M-Pesa
                </Button>
              </>
            )}

            {(status === 'sent' || status === 'error') && (
              <>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1"
                >
                  Close
                </Button>
                {status === 'error' && (
                  <Button
                    onClick={() => {
                      setStatus('idle');
                      setCheckoutRequestId(null);
                    }}
                    className="flex-1"
                  >
                    Try Again
                  </Button>
                )}
              </>
            )}

            {status === 'success' && (
              <Button
                onClick={handleClose}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                Close
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};