import { supabase } from "@/integrations/supabase/client";

export type PaymentSource = 'all' | 'jenga_pay' | 'kcb_buni' | 'mpesa';

export interface UnifiedUnmatchedPayment {
  id: string;
  source: 'jenga_pay' | 'kcb_buni' | 'mpesa' | 'bank';
  sourceTable: 'jenga_ipn_callbacks' | 'bank_callbacks' | 'mpesa_transactions';
  amount: number;
  customer_name: string | null;
  customer_mobile: string | null;
  reference: string;
  transaction_reference: string;
  transaction_date: string | null;
  created_at: string;
  status: string;
  bank_code?: string;
  payment_mode?: string;
}

export async function fetchUnmatchedPayments(
  userId: string,
  sourceFilter: PaymentSource = 'all'
): Promise<UnifiedUnmatchedPayment[]> {
  const payments: UnifiedUnmatchedPayment[] = [];

  // Query Jenga PAY (jenga_ipn_callbacks)
  if (sourceFilter === 'all' || sourceFilter === 'jenga_pay') {
    const { data: jengaData, error: jengaError } = await supabase
      .from('jenga_ipn_callbacks')
      .select('*')
      .eq('landlord_id', userId)
      .eq('status', 'SUCCESS')
      .is('invoice_id', null)
      .eq('processed', false)
      .order('created_at', { ascending: false });

    if (!jengaError && jengaData) {
      payments.push(...jengaData.map(p => ({
        id: p.id,
        source: 'jenga_pay' as const,
        sourceTable: 'jenga_ipn_callbacks' as const,
        amount: Number(p.amount),
        customer_name: p.customer_name,
        customer_mobile: p.customer_mobile,
        reference: p.bill_number || p.customer_reference || '',
        transaction_reference: p.transaction_reference,
        transaction_date: p.transaction_date,
        created_at: p.created_at || '',
        status: p.status,
        payment_mode: p.payment_mode
      })));
    }
  }

  // Query Bank Callbacks (KCB and other banks)
  if (sourceFilter === 'all' || sourceFilter === 'kcb_buni') {
    const { data: bankData, error: bankError } = await supabase
      .from('bank_callbacks')
      .select('*')
      .eq('landlord_id', userId)
      .eq('status', 'SUCCESS')
      .is('invoice_id', null)
      .eq('processed', false)
      .order('created_at', { ascending: false });

    if (!bankError && bankData) {
      payments.push(...bankData.map(p => ({
        id: p.id,
        source: (p.bank_code === 'kcb' ? 'kcb_buni' : 'bank') as 'kcb_buni' | 'bank',
        sourceTable: 'bank_callbacks' as const,
        amount: Number(p.amount),
        customer_name: p.customer_name,
        customer_mobile: p.customer_mobile,
        reference: p.customer_reference || p.bank_reference || '',
        transaction_reference: p.transaction_reference,
        transaction_date: p.transaction_date,
        created_at: p.created_at || '',
        status: p.status,
        bank_code: p.bank_code,
        payment_mode: p.payment_mode
      })));
    }
  }

  // Query M-Pesa Transactions (rent payments without invoice)
  if (sourceFilter === 'all' || sourceFilter === 'mpesa') {
    const { data: mpesaData, error: mpesaError } = await supabase
      .from('mpesa_transactions')
      .select('*')
      .eq('status', 'completed')
      .eq('payment_type', 'rent')
      .is('invoice_id', null)
      .order('created_at', { ascending: false });

    if (!mpesaError && mpesaData) {
      // Filter by landlord if initiated_by matches
      const landlordMpesa = mpesaData.filter(p => 
        p.initiated_by === userId || p.authorized_by === userId
      );
      
      payments.push(...landlordMpesa.map(p => ({
        id: p.id,
        source: 'mpesa' as const,
        sourceTable: 'mpesa_transactions' as const,
        amount: Number(p.amount),
        customer_name: null,
        customer_mobile: p.phone_number,
        reference: p.mpesa_receipt_number || '',
        transaction_reference: p.checkout_request_id,
        transaction_date: p.created_at,
        created_at: p.created_at,
        status: p.status,
        payment_mode: 'M-Pesa STK Push'
      })));
    }
  }

  // Sort by created_at descending
  return payments.sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function getSourceDisplayName(source: string, bankCode?: string): string {
  switch (source) {
    case 'jenga_pay':
      return 'Jenga PAY (Equity)';
    case 'kcb_buni':
      return 'KCB Buni';
    case 'mpesa':
      return 'M-Pesa';
    case 'bank':
      return bankCode ? bankCode.toUpperCase() : 'Bank Transfer';
    default:
      return 'Unknown';
  }
}

export function getPaymentMethodLabel(source: string, bankCode?: string): string {
  switch (source) {
    case 'jenga_pay':
      return 'Jenga PAY';
    case 'kcb_buni':
      return 'KCB Buni';
    case 'mpesa':
      return 'M-Pesa';
    case 'bank':
      return bankCode ? `${bankCode.toUpperCase()} Bank` : 'Bank Transfer';
    default:
      return 'Bank Transfer';
  }
}
