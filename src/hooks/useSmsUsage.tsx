import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface SmsUsageData {
  total_cost: number;
  message_count: number;
  current_month_cost: number;
  current_month_count: number;
}

export const useSmsUsage = (startDate?: string, endDate?: string) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['sms-usage', user?.id, startDate, endDate],
    queryFn: async (): Promise<SmsUsageData> => {
      if (!user?.id) {
        return {
          total_cost: 0,
          message_count: 0,
          current_month_cost: 0,
          current_month_count: 0
        };
      }

      // Get current month dates if no dates provided
      const now = new Date();
      const currentMonthStart = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const currentMonthEnd = endDate || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      try {
        // Fetch SMS usage for the current month
        const { data: currentMonthData, error: currentError } = await supabase
          .from('sms_usage')
          .select('cost')
          .eq('landlord_id', user.id)
          .gte('sent_at', currentMonthStart)
          .lte('sent_at', currentMonthEnd + 'T23:59:59');

        if (currentError) throw currentError;

        // Fetch total SMS usage
        const { data: totalData, error: totalError } = await supabase
          .from('sms_usage')
          .select('cost')
          .eq('landlord_id', user.id);

        if (totalError) throw totalError;

        const currentMonthCost = currentMonthData?.reduce((sum, record) => sum + Number(record.cost), 0) || 0;
        const currentMonthCount = currentMonthData?.length || 0;
        const totalCost = totalData?.reduce((sum, record) => sum + Number(record.cost), 0) || 0;
        const totalCount = totalData?.length || 0;

        return {
          total_cost: totalCost,
          message_count: totalCount,
          current_month_cost: currentMonthCost,
          current_month_count: currentMonthCount
        };
      } catch (error) {
        console.error('Error fetching SMS usage:', error);
        return {
          total_cost: 0,
          message_count: 0,
          current_month_cost: 0,
          current_month_count: 0
        };
      }
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};