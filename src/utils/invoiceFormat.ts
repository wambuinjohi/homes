import { format } from "date-fns";

/**
 * Formats an invoice number for display
 * Recognizes database format INV-YYYY-NNNNNN and returns as-is
 * Only transforms truly malformed or legacy formats
 */
export function formatInvoiceNumber(invoiceNumber: string | null | undefined): string {
  if (!invoiceNumber) return "—";
  
  // Recognize actual database format: INV-YYYY-NNNNNN (e.g., INV-2025-937523)
  if (invoiceNumber.match(/^INV-\d{4}-\d{4,7}$/)) {
    return invoiceNumber;
  }
  
  // Also accept format: INV-YYYYMM-XXXXXX (e.g., INV-202512-ABC123)
  if (invoiceNumber.match(/^INV-\d{6}-[A-Z0-9]{4,8}$/i)) {
    return invoiceNumber.toUpperCase();
  }
  
  // If it starts with INV- and looks reasonable, return as-is
  if (invoiceNumber.match(/^INV-[A-Z0-9-]+$/i) && invoiceNumber.length >= 10) {
    return invoiceNumber.toUpperCase();
  }

  // Only transform truly unformatted values (UUIDs, raw numbers, etc.)
  const now = new Date();
  const yearMonth = format(now, "yyyyMM");
  
  let identifier = invoiceNumber;
  
  // If it's a UUID, use first 6 chars
  if (invoiceNumber.match(/^[a-f0-9-]{8,36}$/i)) {
    identifier = invoiceNumber.replace(/-/g, "").substring(0, 6).toUpperCase();
  } else {
    // For other strings, extract alphanumeric portion
    const alphanumeric = invoiceNumber.replace(/[^A-Za-z0-9]/g, "");
    identifier = alphanumeric.substring(0, 6).toUpperCase();
  }
  
  // Ensure identifier is exactly 6 characters
  if (identifier.length < 6) {
    identifier = identifier.padStart(6, "0");
  } else if (identifier.length > 6) {
    identifier = identifier.substring(0, 6);
  }
  
  return `INV-${yearMonth}-${identifier}`;
}

/**
 * Formats a payment reference for display
 * Uses transaction_id for uniqueness when available
 */
export function formatPaymentReference(
  reference: string | null | undefined, 
  transactionId?: string | null
): string {
  // Prefer transaction_id if available (e.g., TLBLU0MEG0) - always unique
  if (transactionId && transactionId.length >= 6) {
    // Already formatted
    if (transactionId.match(/^PAY-/i)) {
      return transactionId.toUpperCase();
    }
    return `PAY-${transactionId.toUpperCase()}`;
  }
  
  if (!reference) return "—";
  
  // If already formatted, return as-is
  if (reference.match(/^PAY-/i)) {
    return reference.toUpperCase();
  }
  
  // For M-Pesa checkout request IDs (ws_CO_...), extract the unique middle portion
  // Format: ws_CO_DDMMYYYYHHMMSS_SHORTCODE_PHONE_RANDOM
  if (reference.startsWith("ws_CO_")) {
    const parts = reference.split("_");
    // Use the timestamp portion (DDMMYYYYHHMMSS) which is unique per request
    if (parts.length >= 3 && parts[2].length >= 10) {
      return `PAY-${parts[2].substring(0, 10)}`;
    }
  }
  
  // For other references, use full value if short, otherwise extract unique portion
  if (reference.length <= 12) {
    return `PAY-${reference.toUpperCase()}`;
  }
  
  // For longer references, use first 10 chars (more unique than last 8)
  return `PAY-${reference.substring(0, 10).toUpperCase()}`;
}

/**
 * Formats a receipt number for display
 * Uses transaction_id for uniqueness
 */
export function formatReceiptNumber(
  transactionId: string | null | undefined,
  paymentDate?: string | Date | null
): string {
  if (!transactionId) return "—";
  
  // If already properly formatted, return as-is
  if (transactionId.match(/^RCT-\d{6}-[A-Z0-9]{4,10}$/i)) {
    return transactionId.toUpperCase();
  }
  
  // If it looks like an M-Pesa receipt (e.g., TLBLU0MEG0), format it nicely
  if (transactionId.match(/^[A-Z0-9]{10,12}$/)) {
    const date = paymentDate ? new Date(paymentDate) : new Date();
    const yearMonth = format(date, "yyyyMM");
    return `RCT-${yearMonth}-${transactionId}`;
  }

  // Use payment date if available, otherwise current date
  const date = paymentDate ? new Date(paymentDate) : new Date();
  const yearMonth = format(date, "yyyyMM");
  
  // Extract unique identifier
  let identifier = transactionId.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  
  // For long IDs, use first 8 chars (more unique than last chars which may be phone)
  if (identifier.length > 8) {
    identifier = identifier.substring(0, 8);
  } else if (identifier.length < 6) {
    identifier = identifier.padStart(6, "0");
  }
  
  return `RCT-${yearMonth}-${identifier}`;
}

/**
 * Gets a display-friendly description based on invoice data
 */
export function getInvoiceDescription(invoice: any): string {
  if (invoice.description) return invoice.description;
  
  // Handle inferred invoices from payments
  if (invoice.isInferred && invoice.sourcePayment) {
    const payment = invoice.sourcePayment;
    return `Payment received via ${payment.payment_method || 'M-Pesa'}`;
  }
  
  // Generate a friendly description based on available data
  const propertyName = invoice.leases?.units?.properties?.name;
  const unitNumber = invoice.leases?.units?.unit_number;
  
  if (propertyName && unitNumber) {
    return `Rent for ${propertyName}, Unit ${unitNumber}`;
  } else if (propertyName) {
    return `Rent for ${propertyName}`;
  } else if (unitNumber) {
    return `Rent for Unit ${unitNumber}`;
  }
  
  return "Monthly Rent Payment";
}

/**
 * Links a payment to its corresponding invoice
 */
export function linkPaymentToInvoice(payment: any, invoices: any[]): {
  linkedInvoice: any | null;
  linkQuality: 'exact' | 'probable' | 'fuzzy' | 'none';
  linkReason: string;
} {
  if (!payment) {
    return { linkedInvoice: null, linkQuality: 'none', linkReason: 'No payment data' };
  }
  
  if (!invoices?.length) {
    return { linkedInvoice: null, linkQuality: 'none', linkReason: 'No invoices available to link' };
  }
  
  // 1. Exact match by invoice_id
  if (payment.invoice_id) {
    const exactMatch = invoices.find(inv => inv.id === payment.invoice_id);
    if (exactMatch) {
      return { 
        linkedInvoice: exactMatch, 
        linkQuality: 'exact', 
        linkReason: 'Matched by invoice ID' 
      };
    } else {
      return { 
        linkedInvoice: null, 
        linkQuality: 'none', 
        linkReason: 'Invoice exists but access is restricted' 
      };
    }
  }
  
  // 2. Match by invoice number
  if (payment.invoice_number) {
    const invoiceNumberMatch = invoices.find(inv => 
      inv.invoice_number === payment.invoice_number
    );
    if (invoiceNumberMatch) {
      return { 
        linkedInvoice: invoiceNumberMatch, 
        linkQuality: 'exact', 
        linkReason: 'Matched by invoice number' 
      };
    }
  }
  
  // 3. Probable match by amount and date proximity (within 30 days)
  const paymentDate = new Date(payment.payment_date);
  const probableMatches = invoices.filter(inv => {
    if (inv.amount !== payment.amount) return false;
    
    const invoiceDate = new Date(inv.invoice_date);
    const daysDiff = Math.abs((paymentDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 30;
  });
  
  if (probableMatches.length === 1) {
    return { 
      linkedInvoice: probableMatches[0], 
      linkQuality: 'probable', 
      linkReason: 'Matched by amount and date proximity' 
    };
  }
  
  // 4. Fuzzy match by amount only
  const amountMatches = invoices.filter(inv => inv.amount === payment.amount);
  if (amountMatches.length === 1) {
    return { 
      linkedInvoice: amountMatches[0], 
      linkQuality: 'fuzzy', 
      linkReason: 'Matched by amount only' 
    };
  }
  
  return { 
    linkedInvoice: null, 
    linkQuality: 'none', 
    linkReason: 'No matching invoice found in accessible data' 
  };
}