import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface SmsCreditsData {
  balance: number;
  isLow: boolean;
  loading: boolean;
}

/**
 * Hook to fetch and monitor SMS credits balance for landlords
 * Provides real-time credit balance and low balance warnings
 */
export const useSmsCredits = () => {
  const { user } = useAuth();
  const [creditsData, setCreditsData] = useState<SmsCreditsData>({
    balance: 0,
    isLow: false,
    loading: true
  });

  const LOW_CREDITS_THRESHOLD = 10;

  useEffect(() => {
    if (user) {
      fetchCredits();
      
      // Subscribe to real-time updates
      const subscription = supabase
        .channel('sms_credits_changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'landlord_subscriptions',
            filter: `landlord_id=eq.${user.id}`
          },
          (payload) => {
            const balance = payload.new.sms_credits_balance || 0;
            setCreditsData({
              balance,
              isLow: balance < LOW_CREDITS_THRESHOLD,
              loading: false
            });
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [user]);

  const fetchCredits = async () => {
    try {
      const { data, error } = await supabase
        .from('landlord_subscriptions')
        .select('sms_credits_balance')
        .eq('landlord_id', user?.id)
        .single();

      if (error) throw error;

      const balance = data?.sms_credits_balance || 0;
      setCreditsData({
        balance,
        isLow: balance < LOW_CREDITS_THRESHOLD,
        loading: false
      });
    } catch (error) {
      console.error('Error fetching SMS credits:', error);
      setCreditsData(prev => ({ ...prev, loading: false }));
    }
  };

  return {
    ...creditsData,
    refresh: fetchCredits
  };
};
