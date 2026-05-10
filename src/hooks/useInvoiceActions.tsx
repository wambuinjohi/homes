import { toast } from "sonner";
import { UnifiedPDFRenderer } from "@/utils/unifiedPDFRenderer";
import { PDFTemplateService } from "@/utils/pdfTemplateService";
import { getInvoiceBillingData } from "@/utils/invoiceBillingHelper";

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  invoice_date: string;
  status: string;
  description: string | null;
  lease_id?: string;
  tenants?: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
  };
  leases?: {
    units?: {
      unit_number: string;
      properties?: {
        name: string;
        owner_id?: string;
      };
    };
  };
}

export const useInvoiceActions = () => {
  const downloadInvoice = async (invoice: Invoice) => {
    try {
      // Fetch actual landlord billing data
      const billingData = await getInvoiceBillingData(invoice);

      // Get template and branding using the template service
      const { template, branding } = await PDFTemplateService.getTemplateAndBranding(
        'invoice',
        'Tenant'
      );

      const renderer = new UnifiedPDFRenderer();
      
      const documentData = {
        type: 'invoice' as const,
        title: `Invoice ${invoice.invoice_number}`,
        content: {
          invoiceNumber: invoice.invoice_number,
          dueDate: new Date(invoice.due_date),
          items: [
            {
              description: invoice.description || 'Monthly Rent',
              amount: invoice.amount,
              quantity: 1
            }
          ],
          total: invoice.amount,
          recipient: {
            name: billingData.billTo.name,
            address: billingData.billTo.address
          },
          notes: 'Thank you for your prompt payment.'
        }
      };
      
      await renderer.generateDocument(documentData, branding, billingData, null, template);
      toast.success(`Invoice ${invoice.invoice_number} downloaded successfully!`);
    } catch (error) {
      console.error('Error downloading invoice:', error);
      toast.error('Failed to download invoice');
    }
  };

  const sendInvoice = async (invoice: Invoice) => {
    try {
      // Simulate sending invoice
      const email = invoice.tenants?.email;
      if (!email) {
        toast.error('Tenant email not found');
        return;
      }
      
      // In a real app, this would call an API to send the email
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast.success(`Invoice ${invoice.invoice_number} sent to ${email}`);
    } catch (error) {
      console.error('Error sending invoice:', error);
      toast.error('Failed to send invoice');
    }
  };

  return {
    downloadInvoice,
    sendInvoice
  };
};