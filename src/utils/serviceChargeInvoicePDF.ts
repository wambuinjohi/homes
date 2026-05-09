import jsPDF from 'jspdf';

interface ServiceChargeInvoice {
  id: string;
  invoice_number: string;
  billing_period_start: string;
  billing_period_end: string;
  rent_collected: number;
  service_charge_amount: number;
  sms_charges: number;
  whatsapp_charges?: number;
  other_charges?: number;
  total_amount: number;
  due_date: string;
  status: string;
  currency: string;
  payment_date?: string;
  payment_method?: string;
  payment_reference?: string;
  notes?: string;
}

interface LandlordInfo {
  name: string;
  email: string;
  phone?: string;
}

// Zira Homes brand colors
const BRAND_COLORS = {
  primary: '#2563eb',
  secondary: '#64748b',
  accent: '#f1f5f9',
  text: '#1e293b',
  lightGray: '#f8fafc',
  success: '#16a34a',
  warning: '#ea580c'
};

const formatCurrency = (amount: number, currency: string = 'KES') => {
  // Deprecated in favor of formatAmount from utils/currency; keeping for backward compatibility
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

export const generateServiceChargeInvoicePDF = async (
  invoice: ServiceChargeInvoice, 
  landlordInfo: LandlordInfo
): Promise<void> => {
  // Delegate to the unified, CEO-ready renderer for consistent branding
  const { UnifiedPDFRenderer } = await import('./unifiedPDFRenderer');
  const { BrandingService } = await import('./brandingService');

  const renderer = new UnifiedPDFRenderer();
  const branding = BrandingService.loadBranding();

  // Build invoice items in the unified format
  const items: Array<{ description: string; amount: number; quantity?: number }> = [];

  items.push({ description: 'Property Management Service Charge', amount: invoice.service_charge_amount });
  items.push({ description: 'SMS Communication Charges', amount: invoice.sms_charges || 0 });
  if (typeof invoice.whatsapp_charges === 'number') {
    items.push({ description: 'WhatsApp Business Messaging Charges', amount: invoice.whatsapp_charges });
  }
  if (typeof invoice.other_charges === 'number') {
    items.push({ description: 'Payment Processing & Administrative Fees', amount: invoice.other_charges });
  }

  const document = {
    type: 'invoice' as const,
    title: `Service Charge Invoice ${invoice.invoice_number}`,
    content: {
      invoiceNumber: invoice.invoice_number,
      dueDate: new Date(invoice.due_date),
      items,
      total: invoice.total_amount,
      recipient: {
        name: landlordInfo.name || 'Property Owner',
        address: `Email: ${landlordInfo.email}${landlordInfo.phone ? '\nPhone: ' + landlordInfo.phone : ''}`,
      },
      notes: invoice.notes || undefined,
    },
  };

  const landlordData = {
    name: 'Zira Technologies',
    address: branding.companyAddress,
    phone: branding.companyPhone,
    email: branding.companyEmail,
  };

  await renderer.generateDocument(document as any, branding as any, landlordData as any);
};
