import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Receipt, User, Home, Calendar, DollarSign, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PaymentProviderBadge } from "./PaymentProviderBadge";
import { getPaymentMethodLabel, UnifiedUnmatchedPayment } from "@/utils/unmatchedPaymentsQuery";

interface PendingInvoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  tenant_name: string;
  unit_number: string;
  property_name: string;
  tenant_id: string;
  lease_id: string;
}

interface PaymentAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: UnifiedUnmatchedPayment | null;
  onSuccess: () => void;
}

export function PaymentAllocationDialog({
  open,
  onOpenChange,
  payment,
  onSuccess
}: PaymentAllocationDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [invoices, setInvoices] = useState<PendingInvoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>("");

  useEffect(() => {
    if (open && user) {
      loadPendingInvoices();
    }
  }, [open, user]);

  const loadPendingInvoices = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          amount,
          due_date,
          tenant_id,
          lease_id,
          tenants!inner(
            first_name,
            last_name
          ),
          leases!inner(
            units!inner(
              unit_number,
              properties!inner(
                name,
                owner_id
              )
            )
          )
        `)
        .eq('status', 'pending')
        .eq('leases.units.properties.owner_id', user.id)
        .order('due_date', { ascending: true });

      if (error) throw error;

      const formattedInvoices: PendingInvoice[] = (data || []).map((inv: any) => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        amount: inv.amount,
        due_date: inv.due_date,
        tenant_id: inv.tenant_id,
        lease_id: inv.lease_id,
        tenant_name: `${inv.tenants?.first_name || ''} ${inv.tenants?.last_name || ''}`.trim(),
        unit_number: inv.leases?.units?.unit_number || 'N/A',
        property_name: inv.leases?.units?.properties?.name || 'N/A'
      }));

      setInvoices(formattedInvoices);
      
      // Auto-select if amount matches exactly
      if (payment) {
        const exactMatch = formattedInvoices.find(inv => 
          parseFloat(inv.amount.toString()) === parseFloat(payment.amount.toString())
        );
        if (exactMatch) {
          setSelectedInvoiceId(exactMatch.id);
        }
      }
    } catch (error) {
      console.error('Error loading pending invoices:', error);
      toast({
        title: "Error",
        description: "Failed to load pending invoices",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePaymentSource = async (invoiceId: string) => {
    if (!payment) return;
    
    const now = new Date().toISOString();
    
    switch (payment.sourceTable) {
      case 'jenga_ipn_callbacks':
        const { error: jengaError } = await supabase
          .from('jenga_ipn_callbacks')
          .update({
            invoice_id: invoiceId,
            processed: true,
            processed_at: now
          })
          .eq('id', payment.id);
        if (jengaError) throw jengaError;
        break;
        
      case 'bank_callbacks':
        const { error: bankError } = await supabase
          .from('bank_callbacks')
          .update({
            invoice_id: invoiceId,
            processed: true,
            processed_at: now
          })
          .eq('id', payment.id);
        if (bankError) throw bankError;
        break;
        
      case 'mpesa_transactions':
        const { error: mpesaError } = await supabase
          .from('mpesa_transactions')
          .update({
            invoice_id: invoiceId
          })
          .eq('id', payment.id);
        if (mpesaError) throw mpesaError;
        break;
    }
  };

  const handleAllocate = async () => {
    if (!payment || !selectedInvoiceId) return;

    const selectedInvoice = invoices.find(inv => inv.id === selectedInvoiceId);
    if (!selectedInvoice) return;

    setAllocating(true);
    try {
      // 1. Update invoice status to paid
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedInvoiceId);

      if (invoiceError) throw invoiceError;

      // 2. Create payment record with dynamic payment method
      const paymentMethod = getPaymentMethodLabel(payment.source, payment.bank_code);
      
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          tenant_id: selectedInvoice.tenant_id,
          lease_id: selectedInvoice.lease_id,
          invoice_id: selectedInvoiceId,
          amount: payment.amount,
          payment_date: new Date().toISOString().split('T')[0],
          payment_method: paymentMethod,
          payment_reference: payment.transaction_reference,
          transaction_id: payment.transaction_reference,
          status: 'completed',
          payment_type: 'rent',
          notes: `Manual allocation from ${paymentMethod}. Ref: ${payment.reference || 'N/A'}. Customer: ${payment.customer_name || 'Unknown'}`
        });

      if (paymentError) throw paymentError;

      // 3. Mark source callback/transaction as processed
      await updatePaymentSource(selectedInvoiceId);

      onSuccess();
    } catch (error: any) {
      console.error('Error allocating payment:', error);
      toast({
        title: "Allocation Failed",
        description: error.message || "Failed to allocate payment to invoice",
        variant: "destructive"
      });
    } finally {
      setAllocating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Allocate Payment to Invoice</DialogTitle>
          <DialogDescription>
            Select the invoice this payment should be applied to
          </DialogDescription>
        </DialogHeader>

        {/* Payment Summary */}
        <div className="p-4 bg-muted rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Payment Amount</span>
              <PaymentProviderBadge source={payment.source} bankCode={payment.bank_code} />
            </div>
            <Badge variant="default" className="text-lg px-3 py-1">
              {formatCurrency(payment.amount)}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Customer:</span>{" "}
              {payment.customer_name || 'Unknown'}
            </div>
            <div>
              <span className="text-muted-foreground">Phone:</span>{" "}
              {payment.customer_mobile || 'N/A'}
            </div>
            <div>
              <span className="text-muted-foreground">Reference:</span>{" "}
              <span className="font-mono">{payment.reference || 'None'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Transaction:</span>{" "}
              <span className="font-mono text-xs">{payment.transaction_reference}</span>
            </div>
          </div>
        </div>

        {/* Invoice Selection */}
        <div className="space-y-3">
          <Label>Select Invoice to Allocate</Label>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : invoices.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No pending invoices found. All invoices may already be paid.
              </AlertDescription>
            </Alert>
          ) : (
            <ScrollArea className="h-[300px] border rounded-lg p-3">
              <RadioGroup
                value={selectedInvoiceId}
                onValueChange={setSelectedInvoiceId}
                className="space-y-3"
              >
                {invoices.map((invoice) => {
                  const amountMatch = parseFloat(invoice.amount.toString()) === parseFloat(payment.amount.toString());
                  const isOverdue = new Date(invoice.due_date) < new Date();
                  
                  return (
                    <div
                      key={invoice.id}
                      className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50 ${
                        selectedInvoiceId === invoice.id ? 'border-primary bg-primary/5' : ''
                      }`}
                      onClick={() => setSelectedInvoiceId(invoice.id)}
                    >
                      <RadioGroupItem value={invoice.id} id={invoice.id} className="mt-1" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={invoice.id} className="font-medium cursor-pointer">
                            {invoice.invoice_number}
                          </Label>
                          {amountMatch && (
                            <Badge variant="default" className="text-xs bg-green-600">
                              Amount Match
                            </Badge>
                          )}
                          {isOverdue && (
                            <Badge variant="destructive" className="text-xs">
                              Overdue
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {formatCurrency(invoice.amount)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Due: {format(new Date(invoice.due_date), 'dd MMM yyyy')}
                          </div>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {invoice.tenant_name}
                          </div>
                          <div className="flex items-center gap-1">
                            <Home className="h-3 w-3" />
                            {invoice.unit_number} - {invoice.property_name}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </RadioGroup>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={allocating}>
            Cancel
          </Button>
          <Button 
            onClick={handleAllocate} 
            disabled={!selectedInvoiceId || allocating}
          >
            {allocating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Allocating...
              </>
            ) : (
              <>
                <Receipt className="h-4 w-4 mr-2" />
                Allocate Payment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
