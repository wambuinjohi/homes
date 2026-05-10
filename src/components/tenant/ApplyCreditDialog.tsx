import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Wallet, FileText, ArrowRight, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { fmtCurrency } from "@/lib/format";
import { formatInvoiceNumber } from "@/utils/invoiceFormat";

interface Credit {
  id: string;
  balance: number;
  description?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  outstanding_amount?: number;
  status: string;
  due_date: string;
  leases?: {
    units?: {
      unit_number?: string;
      properties?: {
        name?: string;
      };
    };
  };
}

interface ApplyCreditDialogProps {
  availableCredit: number;
  credits: Credit[];
  pendingInvoices: Invoice[];
  preSelectedInvoice?: Invoice;
  onSuccess: () => void;
  trigger?: React.ReactNode;
}

export function ApplyCreditDialog({
  availableCredit,
  credits,
  pendingInvoices,
  preSelectedInvoice,
  onSuccess,
  trigger,
}: ApplyCreditDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(
    preSelectedInvoice?.id || ""
  );
  const [amount, setAmount] = useState<string>("");
  const [isApplying, setIsApplying] = useState(false);

  const selectedInvoice = useMemo(() => {
    return pendingInvoices.find((inv) => inv.id === selectedInvoiceId);
  }, [pendingInvoices, selectedInvoiceId]);

  const outstandingAmount = useMemo(() => {
    if (!selectedInvoice) return 0;
    return selectedInvoice.outstanding_amount ?? selectedInvoice.amount;
  }, [selectedInvoice]);

  const maxApplicable = useMemo(() => {
    return Math.min(availableCredit, outstandingAmount);
  }, [availableCredit, outstandingAmount]);

  // Auto-fill amount when invoice is selected
  const handleInvoiceChange = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    const invoice = pendingInvoices.find((inv) => inv.id === invoiceId);
    if (invoice) {
      const outstanding = invoice.outstanding_amount ?? invoice.amount;
      const autoAmount = Math.min(availableCredit, outstanding);
      setAmount(autoAmount.toString());
    }
  };

  // Initialize on open
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      if (preSelectedInvoice) {
        setSelectedInvoiceId(preSelectedInvoice.id);
        const outstanding = preSelectedInvoice.outstanding_amount ?? preSelectedInvoice.amount;
        setAmount(Math.min(availableCredit, outstanding).toString());
      } else if (pendingInvoices.length === 1) {
        handleInvoiceChange(pendingInvoices[0].id);
      } else {
        setSelectedInvoiceId("");
        setAmount("");
      }
    }
  };

  const handleApplyCredit = async () => {
    if (!selectedInvoiceId || !amount) {
      toast({
        title: "Missing Information",
        description: "Please select an invoice and enter an amount.",
        variant: "destructive",
      });
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive amount.",
        variant: "destructive",
      });
      return;
    }

    if (amountNum > availableCredit) {
      toast({
        title: "Insufficient Credit",
        description: `You only have ${fmtCurrency(availableCredit)} available.`,
        variant: "destructive",
      });
      return;
    }

    if (amountNum > outstandingAmount) {
      toast({
        title: "Amount Exceeds Balance",
        description: `The outstanding balance is only ${fmtCurrency(outstandingAmount)}.`,
        variant: "destructive",
      });
      return;
    }

    setIsApplying(true);
    try {
      // Find the best credit to use (one with sufficient balance, or apply from multiple)
      let remainingToApply = amountNum;
      const creditsToUse = credits
        .filter((c) => c.balance > 0)
        .sort((a, b) => a.balance - b.balance); // Use smaller credits first

      for (const credit of creditsToUse) {
        if (remainingToApply <= 0) break;
        
        const applyFromThisCredit = Math.min(credit.balance, remainingToApply);
        
        const { error } = await supabase.rpc("apply_credit_to_invoice", {
          p_credit_id: credit.id,
          p_invoice_id: selectedInvoiceId,
          p_amount: applyFromThisCredit,
        });

        if (error) throw error;
        remainingToApply -= applyFromThisCredit;
      }

      toast({
        title: "Credit Applied",
        description: `Successfully applied ${fmtCurrency(amountNum)} to invoice ${formatInvoiceNumber(selectedInvoice?.invoice_number || "")}.`,
      });
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error applying credit:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to apply credit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsApplying(false);
    }
  };

  const amountNum = parseFloat(amount) || 0;
  const isValid = selectedInvoiceId && amountNum > 0 && amountNum <= maxApplicable;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Wallet className="h-4 w-4" />
            Apply Credit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-green-600" />
            Apply Credit to Invoice
          </DialogTitle>
          <DialogDescription>
            Use your available credit balance to pay off outstanding invoices.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Available Credit */}
          <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                Available Credit
              </span>
              <span className="text-lg font-bold text-green-600">
                {fmtCurrency(availableCredit)}
              </span>
            </div>
          </div>

          {/* Invoice Selection */}
          <div className="space-y-2">
            <Label htmlFor="invoice">Select Invoice</Label>
            <Select value={selectedInvoiceId} onValueChange={handleInvoiceChange}>
              <SelectTrigger id="invoice">
                <SelectValue placeholder="Choose an invoice to pay" />
              </SelectTrigger>
              <SelectContent>
                {pendingInvoices.map((invoice) => {
                  const outstanding = invoice.outstanding_amount ?? invoice.amount;
                  return (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span>{formatInvoiceNumber(invoice.invoice_number)}</span>
                        <span className="text-muted-foreground">-</span>
                        <span className="font-semibold">{fmtCurrency(outstanding)}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Invoice Details */}
          {selectedInvoice && (
            <div className="p-3 bg-muted/50 rounded-lg space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Invoice Total</span>
                <span>{fmtCurrency(selectedInvoice.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Outstanding Balance</span>
                <span className="font-semibold text-red-600">
                  {fmtCurrency(outstandingAmount)}
                </span>
              </div>
              {selectedInvoice.leases?.units && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Property</span>
                  <span>
                    {selectedInvoice.leases.units.properties?.name} - Unit{" "}
                    {selectedInvoice.leases.units.unit_number}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount to Apply</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                KES
              </span>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="pl-12"
                max={maxApplicable}
                min={0}
                step="0.01"
              />
            </div>
            {selectedInvoice && (
              <p className="text-xs text-muted-foreground">
                Maximum applicable: {fmtCurrency(maxApplicable)}
              </p>
            )}
          </div>

          {/* Result Preview */}
          {isValid && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm mb-2">
                <ArrowRight className="h-4 w-4 text-primary" />
                <span className="font-medium">After applying credit:</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Credit Balance:</span>
                  <span className="ml-2 font-medium">
                    {fmtCurrency(availableCredit - amountNum)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Invoice Balance:</span>
                  <span className="ml-2 font-medium">
                    {fmtCurrency(outstandingAmount - amountNum)}
                  </span>
                </div>
              </div>
              {outstandingAmount - amountNum === 0 && (
                <Badge className="mt-2 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                  Invoice will be fully paid
                </Badge>
              )}
            </div>
          )}

          {pendingInvoices.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-700 dark:text-yellow-300">
              <AlertCircle className="h-4 w-4" />
              No outstanding invoices to apply credit to.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleApplyCredit}
            disabled={!isValid || isApplying || pendingInvoices.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {isApplying ? "Applying..." : `Apply ${fmtCurrency(amountNum)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ApplyCreditDialog;
