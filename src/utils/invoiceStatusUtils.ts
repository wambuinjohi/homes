export type InvoiceStatus = 'pending' | 'unpaid' | 'overdue' | 'paid' | 'partially_paid' | 'cancelled';

/**
 * Check if an invoice can be paid by the tenant
 */
export const isInvoicePayable = (status: string): boolean => {
  return ['pending', 'unpaid', 'overdue', 'partially_paid'].includes(status);
};

/**
 * Get the card gradient class for an invoice status
 */
export const getInvoiceCardClass = (status: string): string => {
  if (status === 'overdue') return 'card-gradient-red';
  if (status === 'partially_paid') return 'card-gradient-blue';
  if (status === 'pending' || status === 'unpaid') return 'card-gradient-orange';
  return 'card-gradient-green';
};

/**
 * Check if status indicates an outstanding balance
 */
export const isInvoiceOutstanding = (status: string): boolean => {
  return ['pending', 'unpaid', 'overdue', 'partially_paid'].includes(status);
};

/**
 * Get display label for invoice status
 */
export const getInvoiceStatusLabel = (status: string): string => {
  switch (status) {
    case 'partially_paid': return 'Partially Paid';
    case 'paid': return 'Paid';
    case 'pending': return 'Pending';
    case 'overdue': return 'Overdue';
    case 'cancelled': return 'Cancelled';
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
};
