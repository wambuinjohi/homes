import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  submitted_date: string;
  scheduled_date?: string;
  completed_date?: string;
  cost?: number;
  notes?: string;
  images?: string[];
  property_name: string;
  unit_number?: string;
}

interface MaintenanceStats {
  total_requests: number;
  completed: number;
  pending: number;
  high_priority: number;
}

interface TenantMaintenanceData {
  requests: MaintenanceRequest[];
  stats: MaintenanceStats | null;
}

export function useTenantMaintenance(limit = 50) {
  const [data, setData] = useState<TenantMaintenanceData>({ requests: [], stats: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMaintenanceData();
  }, [limit]);

  const fetchMaintenanceData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: result, error: rpcError } = await supabase
        .rpc('get_tenant_maintenance_data', { p_limit: limit })
        .maybeSingle();

      if (rpcError) {
        throw rpcError;
      }

      setData((result as unknown as TenantMaintenanceData) || { requests: [], stats: null });
    } catch (err) {
      console.error('Error fetching maintenance data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load maintenance data');
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    loading,
    error,
    refetch: fetchMaintenanceData
  };
}