// Simplified to avoid foreign key relationship issues

export async function getEnhancedInvoiceData(invoiceId: string) {
  return {
    id: invoiceId,
    invoice_number: 'N/A',
    amount: 0,
    tenant_name: 'N/A',
    tenant_email: 'N/A',
    property_name: 'N/A',
    unit_number: 'N/A',
    due_date: new Date().toISOString(),
    invoice_date: new Date().toISOString(),
    description: 'N/A',
    status: 'pending',
    billingData: {
      company_name: 'Zira Homes',
      company_address: 'Nairobi, Kenya',
      company_phone: '+254 757 878 023',
      company_email: 'billing@ziratech.com'
    }
  };
}

export async function getPaymentReceiptData(paymentId: string) {
  return {
    id: paymentId,
    payment_reference: 'N/A',
    amount: 0,
    payment_date: new Date().toISOString(),
    payment_method: 'N/A',
    tenant_name: 'N/A',
    property_name: 'N/A',
    unit_number: 'N/A'
  };
}

export interface DocumentBillingData {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
}

export interface EnhancedInvoiceData {
  id: string;
  invoice_number: string;
  amount: number;
  tenant_name: string;
  tenant_email: string;
  property_name: string;
  unit_number: string;
  due_date: string;
  invoice_date: string;
  description: string;
  status: string;
  billingData: DocumentBillingData;
}