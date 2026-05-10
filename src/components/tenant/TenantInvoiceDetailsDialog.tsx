import { useState } from "react";
import { formatAmount } from "@/utils/currency";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, Download, FileText, Calendar, User, DollarSign, Smartphone, Building, Home, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatInvoiceNumber, getInvoiceDescription } from "@/utils/invoiceFormat";
import { fmtCurrency, fmtDate } from "@/lib/format";
import { isInvoicePayable, getInvoiceStatusLabel } from "@/utils/invoiceStatusUtils";

interface Invoice {
  id: string;
  invoice_number: string;
  lease_id: string;
  tenant_id: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  status: string;
  description: string | null;
  created_at: string;
  outstanding_amount?: number;
  leases?: {
    units?: {
      unit_number: string;
      properties?: {
        name: string;
      };
    };
  };
  tenants?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  // For inferred invoices
  isInferred?: boolean;
  sourcePayment?: {
    property_name?: string;
    unit_number?: string;
    payment_method?: string;
  };
}

interface TenantInvoiceDetailsDialogProps {
  invoice: Invoice;
  trigger?: React.ReactNode;
  onPayNow?: (invoice: Invoice) => void;
}

export function TenantInvoiceDetailsDialog({ invoice, trigger, onPayNow }: TenantInvoiceDetailsDialogProps) {
  const [open, setOpen] = useState(false);


  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-success text-success-foreground";
      case "partially_paid":
        return "bg-blue-500 text-white";
      case "pending":
        return "bg-warning text-warning-foreground";
      case "overdue":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  const handleDownloadInvoice = async () => {
    try {
      console.log('Starting invoice download...');
      const { PDFTemplateService } = await import('@/utils/pdfTemplateService');
      const { UnifiedPDFRenderer } = await import('@/utils/unifiedPDFRenderer');
      const { getInvoiceBillingData } = await import('@/utils/invoiceBillingHelper');
      
      // Fetch actual landlord billing data
      const billingData = await getInvoiceBillingData(invoice);
      
      // Get template and branding from the unified service
      console.log('Fetching Admin invoice template and branding...');
      const { template, branding: brandingData } = await PDFTemplateService.getTemplateAndBranding(
        'invoice',
        'Admin'
      );
      
      const renderer = new UnifiedPDFRenderer();
      
      // Calculate payment breakdown for partially paid invoices
      const amountPaid = invoice.outstanding_amount !== undefined 
        ? invoice.amount - invoice.outstanding_amount 
        : 0;
      const outstandingAmount = invoice.outstanding_amount ?? invoice.amount;

      const documentData = {
        type: 'invoice' as const,
        title: `Invoice ${formatInvoiceNumber(invoice.invoice_number)}`,
        content: {
          invoiceNumber: formatInvoiceNumber(invoice.invoice_number),
          dueDate: new Date(invoice.due_date),
          items: [
            {
              description: getInvoiceDescription(invoice),
              amount: invoice.amount,
              quantity: 1
            }
          ],
          total: invoice.amount,
          // Payment breakdown for partially paid invoices
          amountPaid: amountPaid,
          outstandingAmount: outstandingAmount,
          recipient: {
            name: billingData.billTo.name,
            address: billingData.billTo.address
          },
          notes: 'Thank you for your prompt payment.'
        }
      };

      await renderer.generateDocument(documentData, brandingData, billingData, null, template);
      toast.success(`Invoice ${formatInvoiceNumber(invoice.invoice_number)} downloaded successfully`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate invoice PDF. Please try again.');
    }
  };

  const invoicePayable = isInvoicePayable(invoice.status);

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Eye className="h-4 w-4 mr-1" />
      View
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-6">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            Invoice Details
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Invoice Header */}
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 p-6 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {formatInvoiceNumber(invoice.invoice_number)}
              </h3>
              <Badge className={getStatusColor(invoice.status)} variant="default">
                {getInvoiceStatusLabel(invoice.status)}
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <p className="text-sm font-medium">{getInvoiceDescription(invoice)}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  {invoice.status === 'partially_paid' ? 'Outstanding Balance' : 'Amount Due'}
                </label>
                <p className="text-2xl font-bold text-green-600">
                  {fmtCurrency(invoice.outstanding_amount ?? invoice.amount)}
                </p>
                {invoice.status === 'partially_paid' && invoice.outstanding_amount !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    Original: {fmtCurrency(invoice.amount)} | Paid: {fmtCurrency(invoice.amount - invoice.outstanding_amount)}
                  </p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-primary/20">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Invoice Date</label>
                <p className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {fmtDate(invoice.invoice_date)}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Due Date</label>
                <p className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {fmtDate(invoice.due_date)}
                </p>
              </div>
            </div>
          </div>

          {/* Partial Payment Alert */}
          {invoice.status === 'partially_paid' && invoice.outstanding_amount !== undefined && (
            <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700 dark:text-blue-300">
                This invoice has been partially paid. {fmtCurrency(invoice.amount - invoice.outstanding_amount)} has been received, 
                with {fmtCurrency(invoice.outstanding_amount)} still outstanding.
              </AlertDescription>
            </Alert>
          )}

          {/* Property Information */}
          <div className="bg-muted/30 border border-muted p-6 rounded-xl space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              Property Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Property Name</label>
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  {invoice.leases?.units?.properties?.name || 'Property Name Not Available'}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Unit Number</label>
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  Unit {invoice.leases?.units?.unit_number || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-gradient-to-br from-muted/20 to-muted/40 border border-muted p-6 rounded-xl space-y-4">
            <h3 className="font-semibold text-foreground">Available Actions</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={handleDownloadInvoice}
                variant="outline" 
                size="lg"
                className="border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground flex-1 transition-all duration-200"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Invoice PDF
              </Button>
              {invoicePayable && onPayNow && (
                <Button 
                  onClick={() => {
                    onPayNow(invoice);
                    setOpen(false);
                  }}
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 text-white flex-1 transition-all duration-200"
                >
                  <Smartphone className="h-4 w-4 mr-2" />
                  Pay with M-Pesa
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}