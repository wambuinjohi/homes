import { useState } from "react";
import { formatAmount } from "@/utils/currency";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Edit, Download, Send, FileText, Calendar, User, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { UnifiedPDFRenderer } from "@/utils/unifiedPDFRenderer";
import { getInvoiceBillingData } from "@/utils/invoiceBillingHelper";

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
  leases?: {
    units?: {
      unit_number: string;
      properties?: {
        name: string;
        owner_id?: string;
      };
    };
  };
  tenants?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface InvoiceDetailsDialogProps {
  invoice: Invoice;
  mode: 'view' | 'edit';
  trigger?: React.ReactNode;
}

export function InvoiceDetailsDialog({ invoice, mode, trigger }: InvoiceDetailsDialogProps) {
  const [open, setOpen] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return formatAmount(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-success text-success-foreground";
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
      // Fetch actual landlord billing data
      const billingData = await getInvoiceBillingData(invoice);
      
      // Get branding data using global branding system
      const { BrandingFetcher } = await import('@/utils/brandingFetcher');
      const brandingData = await BrandingFetcher.fetchBranding();

      const renderer = new UnifiedPDFRenderer();
      
      const documentData = {
        type: 'invoice' as const,
        title: `Invoice - ${invoice.invoice_number}`,
        content: {
          invoiceNumber: invoice.invoice_number,
          dueDate: invoice.due_date,
          amount: invoice.amount,
          tenant: invoice.tenants ? `${invoice.tenants.first_name} ${invoice.tenants.last_name}` : 'N/A',
          description: invoice.description || 'Monthly rent payment',
          items: [
            { description: invoice.description || 'Monthly rent payment', amount: invoice.amount }
          ]
        }
      };

      await renderer.generateDocument(documentData, brandingData, billingData);
      toast.success(`Invoice ${invoice.invoice_number} downloaded successfully`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate invoice PDF');
    }
  };

  const handleDownloadReceipt = async () => {
    try {
      // Fetch actual landlord billing data
      const billingData = await getInvoiceBillingData(invoice);
      
      const { BrandingFetcher } = await import('@/utils/brandingFetcher');
      const { UnifiedPDFRenderer } = await import('@/utils/unifiedPDFRenderer');
      
      const brandingData = await BrandingFetcher.fetchBranding();
      const renderer = new UnifiedPDFRenderer();
      
      const documentData = {
        type: 'invoice' as const,
        title: `Receipt ${invoice.invoice_number}`,
        content: {
          invoiceNumber: invoice.invoice_number,
          dueDate: invoice.due_date,
          items: [
            {
              description: invoice.description || 'Rent Payment',
              quantity: 1,
              amount: invoice.amount
            }
          ],
          total: invoice.amount,
          recipient: {
            name: billingData.billTo.name,
            address: billingData.billTo.address
          }
        }
      };

      await renderer.generateDocument(documentData, brandingData, billingData);
      toast.success(`Receipt ${invoice.invoice_number} downloaded successfully`);
    } catch (error) {
      console.error('Error generating receipt PDF:', error);
      toast.error('Failed to generate receipt PDF');
    }
  };

  const handleSendInvoice = () => {
    toast.success(`Invoice ${invoice.invoice_number} sent to ${invoice.tenants?.email}`);
    // Here you would implement email sending
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      {mode === 'view' ? (
        <>
          <Eye className="h-4 w-4 mr-1" />
          View
        </>
      ) : (
        <>
          <Edit className="h-4 w-4 mr-1" />
          Edit
        </>
      )}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {mode === 'view' ? 'Invoice Details' : 'Edit Invoice'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Invoice Header */}
          <div className="bg-muted/30 p-4 rounded-lg space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Invoice Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Invoice Number</label>
                <p className="text-lg font-semibold text-primary">{invoice.invoice_number}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <Badge className={getStatusColor(invoice.status)}>
                  {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Invoice Date</label>
                <p className="text-sm flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(invoice.invoice_date)}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Due Date</label>
                <p className="text-sm flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(invoice.due_date)}
                </p>
              </div>
            </div>
          </div>

          {/* Tenant Information */}
          <div className="bg-muted/30 p-4 rounded-lg space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              Tenant Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Tenant Name</label>
                <p className="text-sm font-medium">
                  {invoice.tenants?.first_name} {invoice.tenants?.last_name}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <p className="text-sm">{invoice.tenants?.email}</p>
              </div>
            </div>
          </div>

          {/* Property Information */}
          <div className="bg-muted/30 p-4 rounded-lg space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Property Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Property</label>
                <p className="text-sm font-medium">{invoice.leases?.units?.properties?.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Unit</label>
                <p className="text-sm">{invoice.leases?.units?.unit_number}</p>
              </div>
            </div>
          </div>

          {/* Financial Information */}
          <div className="bg-muted/30 p-4 rounded-lg space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Financial Details
            </h3>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Total Amount</label>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(invoice.amount)}</p>
            </div>
            {invoice.description && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <p className="text-sm">{invoice.description}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          {mode === 'view' && (
            <div className="bg-muted/30 p-4 rounded-lg space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Quick Actions</h3>
              <div className="flex gap-2">
                <Button 
                  onClick={handleDownloadInvoice}
                  variant="outline" 
                  size="sm"
                  className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download PDF
                </Button>
                <Button 
                  onClick={handleDownloadReceipt}
                  variant="outline" 
                  size="sm"
                  className="border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download Receipt
                </Button>
                <Button 
                  onClick={handleSendInvoice}
                  size="sm"
                  className="bg-accent hover:bg-accent/90"
                >
                  <Send className="h-4 w-4 mr-1" />
                  Send to Tenant
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {mode === 'view' ? 'Close' : 'Cancel'}
          </Button>
          {mode === 'edit' && (
            <Button type="submit">
              Save Changes
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}