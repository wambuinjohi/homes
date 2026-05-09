import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useReportGeneration = () => {
  const logReportGeneration = async (
    reportType: string,
    filters: Record<string, any> = {},
    executionTimeMs?: number,
    fileSizeBytes?: number
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.warn('No authenticated user for report generation log');
        return;
      }

      console.log('📊 Logging report generation:', { reportType, executionTimeMs, fileSizeBytes });
      
      const { error } = await supabase
        .from('report_runs')
        .insert({
          user_id: user.id,
          report_type: reportType,
          filters: filters,
          status: 'completed',
          execution_time_ms: executionTimeMs,
          file_size_bytes: fileSizeBytes,
          metadata: {
            timestamp: new Date().toISOString(),
            user_agent: navigator.userAgent
          }
        });

      if (error) {
        console.error('Failed to log report generation:', error);
      } else {
        console.log('✅ Successfully logged report generation');
      }
    } catch (error) {
      console.error('Error logging report generation:', error);
    }
  };

  return {
    logReportGeneration
  };
};