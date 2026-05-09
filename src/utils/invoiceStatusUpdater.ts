import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Utility to update invoice statuses via edge function
 */
export async function updateInvoiceStatuses(
  invoiceIds: string[],
  status: 'pending' | 'unpaid' | 'paid' | 'overdue' | 'cancelled'
): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('update-invoice-status', {
      body: {
        invoiceIds,
        status
      }
    });

    if (error) throw error;

    if (data?.success) {
      toast.success(`Successfully updated ${data.updated} invoice(s) to ${status}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error updating invoice statuses:', error);
    toast.error('Failed to update invoice statuses');
    return false;
  }
}

/**
 * Batch update multiple invoices from 'pending' to 'unpaid'
 */
export async function markPendingAsUnpaid(invoiceIds: string[]): Promise<boolean> {
  return updateInvoiceStatuses(invoiceIds, 'unpaid');
}
