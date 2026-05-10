import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface MpesaTransaction {
  result_code: number | null;
  result_desc: string | null;
  status: string | null;
  mpesa_receipt_number: string | null;
}

interface UseRealtimeMpesaStatusResult {
  transaction: MpesaTransaction | null;
  isListening: boolean;
  error: string | null;
}

interface UseRealtimeMpesaStatusOptions {
  invoiceId?: string;
  provider?: string;
}

export function useRealtimeMpesaStatus(
  checkoutRequestId: string | null,
  options?: UseRealtimeMpesaStatusOptions
): UseRealtimeMpesaStatusResult {
  const [transaction, setTransaction] = useState<MpesaTransaction | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checkoutRequestId) {
      setTransaction(null);
      setIsListening(false);
      return;
    }

    let channel: RealtimeChannel;
    let invoiceChannel: RealtimeChannel | null = null;

    const setupRealtimeSubscription = async () => {
      try {
        console.log('🔄 Setting up realtime subscription for:', checkoutRequestId);
        setIsListening(true);
        setError(null);

        // First, fetch the current state if it exists
        const { data: existingTransaction } = await supabase
          .from('mpesa_transactions')
          .select('result_code, result_desc, status, mpesa_receipt_number')
          .eq('checkout_request_id', checkoutRequestId)
          .maybeSingle();

        if (existingTransaction) {
          console.log('✅ Found existing transaction:', existingTransaction);
          setTransaction(existingTransaction);
        }

        // Subscribe to realtime updates by checkout_request_id
        channel = supabase
          .channel(`mpesa-${checkoutRequestId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'mpesa_transactions',
              filter: `checkout_request_id=eq.${checkoutRequestId}`
            },
            (payload) => {
              console.log('🔔 Realtime payment update (checkout_request_id):', payload);
              
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const newTransaction = payload.new as any;
                
                // Update if result_code or status changed
                setTransaction(prev => {
                  const newResultCode = newTransaction.result_code;
                  const newStatus = newTransaction.status;
                  const newReceipt = newTransaction.mpesa_receipt_number;
                  
                  if (prev?.result_code === newResultCode && 
                      prev?.status === newStatus && 
                      prev?.mpesa_receipt_number === newReceipt &&
                      newResultCode !== null) {
                    console.log('⏭️ Transaction unchanged, skipping state update');
                    return prev;
                  }
                  
                  console.log('✅ Transaction state changed:', {
                    previous: { result_code: prev?.result_code, status: prev?.status },
                    new: { result_code: newResultCode, status: newStatus }
                  });
                  
                  return {
                    result_code: newResultCode,
                    result_desc: newTransaction.result_desc,
                    status: newStatus,
                    mpesa_receipt_number: newReceipt
                  };
                });
              }
            }
          )
          .subscribe((status) => {
            console.log('📡 Realtime subscription status (checkout_request_id):', status);
            if (status === 'SUBSCRIBED') {
              console.log('✅ Successfully subscribed to M-Pesa updates');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.error('❌ Realtime subscription error:', status);
              setError('Failed to connect to realtime updates');
              setIsListening(false);
            }
          });

        // Also subscribe by invoice_id if provided (for Kopo Kopo reconciliation)
        if (options?.invoiceId) {
          console.log('🔄 Also subscribing by invoice_id:', options.invoiceId);
          invoiceChannel = supabase
            .channel(`mpesa-invoice-${options.invoiceId}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'mpesa_transactions',
                filter: `invoice_id=eq.${options.invoiceId}`
              },
              (payload) => {
                console.log('🔔 Realtime payment update (invoice_id):', payload);
                
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                  const newTransaction = payload.new as any;
                  
                  setTransaction(prev => {
                    const newResultCode = newTransaction.result_code;
                    const newStatus = newTransaction.status;
                    const newReceipt = newTransaction.mpesa_receipt_number;
                    
                    if (prev?.result_code === newResultCode && 
                        prev?.status === newStatus && 
                        prev?.mpesa_receipt_number === newReceipt &&
                        newResultCode !== null) {
                      return prev;
                    }
                    
                    console.log('✅ Transaction state changed (invoice_id):', {
                      previous: { result_code: prev?.result_code, status: prev?.status },
                      new: { result_code: newResultCode, status: newStatus }
                    });
                    
                    return {
                      result_code: newResultCode,
                      result_desc: newTransaction.result_desc,
                      status: newStatus,
                      mpesa_receipt_number: newReceipt
                    };
                  });
                }
              }
            )
            .subscribe((status) => {
              console.log('📡 Realtime subscription status (invoice_id):', status);
            });
        }
      } catch (err) {
        console.error('❌ Error setting up realtime subscription:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsListening(false);
      }
    };

    setupRealtimeSubscription();

    // Cleanup
    return () => {
      if (channel) {
        console.log('🧹 Cleaning up realtime subscription (checkout_request_id)');
        supabase.removeChannel(channel);
      }
      if (invoiceChannel) {
        console.log('🧹 Cleaning up realtime subscription (invoice_id)');
        supabase.removeChannel(invoiceChannel);
      }
      setIsListening(false);
    };
  }, [checkoutRequestId, options?.invoiceId]);

  return {
    transaction,
    isListening,
    error
  };
}
