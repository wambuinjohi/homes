import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PropertyStats {
  total_properties: number;
  total_units: number;
  occupied_units: number;
  monthly_revenue: number;
}

interface RecentPayment {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  status: string;
  payment_reference?: string;
  tenant_name: string;
  property_name: string;
  unit_number: string;
}

interface PendingMaintenance {
  id: string;
  title: string;
  priority: string;
  submitted_date: string;
  category: string;
  status: string;
  property_name: string;
  unit_number?: string;
  tenant_name?: string;
}

interface LandlordDashboardData {
  property_stats: PropertyStats | null;
  recent_payments: RecentPayment[];
  pending_maintenance: PendingMaintenance[];
}

export function useLandlordDashboard() {
  const [data, setData] = useState<LandlordDashboardData>({
    property_stats: null,
    recent_payments: [],
    pending_maintenance: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: result, error: rpcError } = await supabase
        .rpc('get_landlord_dashboard_data')
        .maybeSingle();

      if (rpcError) {
        throw rpcError;
      }

      // Validate and normalize result data
      const propertyStats = (result as any)?.property_stats && typeof (result as any).property_stats === 'object'
        ? {
            total_properties: Number((result as any).property_stats.total_properties) || 0,
            total_units: Number((result as any).property_stats.total_units) || 0,
            occupied_units: Number((result as any).property_stats.occupied_units) || 0,
            monthly_revenue: Number((result as any).property_stats.monthly_revenue) || 0,
          }
        : null;

      // Also fetch tenant summary to ensure dashboard and Tenants page counts align
      let tenantsCount = 0;
      try {
        const { data: tenantsSummary } = await supabase.rpc('get_landlord_tenants_summary', { p_limit: 1, p_offset: 0 }).maybeSingle();
        if (tenantsSummary && (tenantsSummary as any).total_count !== undefined) {
          tenantsCount = Number((tenantsSummary as any).total_count) || 0;
        }
      } catch (e) {
        // If RPC fails, fallback to occupied_units
        console.warn('Failed to fetch tenants summary for dashboard count, falling back to occupied_units', e);
      }

      const validatedData: LandlordDashboardData = {
        property_stats: propertyStats,
        recent_payments: Array.isArray((result as any)?.recent_payments) ? (result as any).recent_payments : [],
        pending_maintenance: Array.isArray((result as any)?.pending_maintenance) ? (result as any).pending_maintenance : []
      };

      // Attach tenantsCount as a non-standard field on property_stats if available
      if (validatedData.property_stats) {
        (validatedData.property_stats as any).active_tenants = tenantsCount || validatedData.property_stats.occupied_units || 0;
      }

      setData(validatedData);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    loading,
    error,
    refetch: fetchDashboardData
  };
}
