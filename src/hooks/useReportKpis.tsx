import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getReportsForRole } from '@/lib/reporting/config';
import { useRole } from '@/context/RoleContext';

interface ReportKpisData {
  reportsGenerated: number;
  collectionRate: number;
  scheduledReports: number;
  dataCoverage: number;
}

export const useReportKpis = () => {
  const { effectiveRole } = useRole();
  
  return useQuery({
    queryKey: ['report-kpis', effectiveRole],
    queryFn: async (): Promise<ReportKpisData> => {
      try {
        // Get current month for collection rate
        const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const currentMonthEnd = new Date().toISOString().split('T')[0];
        
        // Fetch collection rate from executive summary report (current month)
        const { data: executiveData, error: executiveError } = await supabase.rpc('get_executive_summary_report', {
          p_start_date: currentMonthStart,
          p_end_date: currentMonthEnd,
          p_include_tenant_scope: true
        });

        if (executiveError) {
          console.warn('Error fetching executive data for KPIs:', executiveError);
        }

        // Count actual reports generated this month from report_runs table
        const { count: reportsCount } = await supabase
          .from('report_runs')
          .select('*', { count: 'exact', head: true })
          .gte('generated_at', currentMonthStart)
          .lt('generated_at', new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString());

        // Count total properties for data coverage
        const { count: propertiesCount } = await supabase
          .from('properties')
          .select('*', { count: 'exact', head: true });

        // Get market rent data for coverage calculation - fallback gracefully
        const { data: marketData, error: marketError } = await supabase.rpc('get_market_rent_report');
        
        if (marketError) {
          console.warn('Error fetching market data for KPIs:', marketError);
        }

        // Count available reports based on user role (map manager/agent to landlord)
        let roleForReports = effectiveRole || 'tenant';
        if (roleForReports === 'manager' || roleForReports === 'agent') {
          roleForReports = 'landlord';
        }
        // Use lowercase role name as expected by reportConfigs
        const availableReportsCount = getReportsForRole(roleForReports as any).length;

        const collectionRate = (executiveData as any)?.kpis?.collection_rate || 0;
        const propertiesAnalyzed = (marketData as any)?.kpis?.properties_analyzed || 0;
        const totalPropertiesFromMarket = (marketData as any)?.kpis?.total_properties || propertiesCount || 1;
        const dataCoverage = Math.round((propertiesAnalyzed / totalPropertiesFromMarket) * 100);

        return {
          reportsGenerated: reportsCount || 0,
          collectionRate,
          scheduledReports: availableReportsCount,
          dataCoverage: Math.min(Math.max(dataCoverage, 0), 100) // Cap between 0-100%
        };
      } catch (error) {
        console.error('Error fetching report KPIs:', error);
        return {
          reportsGenerated: 0,
          collectionRate: 0,
          scheduledReports: 0,
          dataCoverage: 0
        };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
};