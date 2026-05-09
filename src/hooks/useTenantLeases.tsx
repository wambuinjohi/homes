import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface TenantLease {
  id: string;
  lease_start_date: string;
  lease_end_date: string;
  monthly_rent: number;
  security_deposit?: number;
  status: string;
  lease_terms?: string;
  tenant_id: string;
  unit_id: string;
  unit_number: string;
  floor?: string;
  unit_rent?: number;
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  property_id: string;
  property_name: string;
  address: string;
  city: string;
  state: string;
  amenities?: string[];
  property_description?: string;
  landlord_first_name?: string;
  landlord_last_name?: string;
  landlord_email?: string;
  landlord_phone?: string;
}

interface TenantLeasesData {
  leases: TenantLease[];
  error: string | null;
}

export function useTenantLeases() {
  const [data, setData] = useState<TenantLeasesData>({ leases: [], error: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchTenantLeases();
    }
  }, [user]);

  const fetchTenantLeases = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: result, error: rpcError } = await supabase
        .rpc('get_tenant_leases', { p_user_id: user.id });

      if (rpcError) {
        console.error('RPC Error:', rpcError.code, rpcError.message);
        throw rpcError;
      }

      const leasesData = (result as any) as TenantLeasesData;
      setData(leasesData || { leases: [], error: null });
    } catch (err) {
      console.error('Error fetching tenant leases:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load lease data';
      setError(errorMessage);
      setData({ leases: [], error: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  // Helper methods
  const getActiveLease = () => {
    return data.leases.find(lease => lease.status === 'active' || !lease.status) || data.leases[0] || null;
  };

  const getLeasesByProperty = () => {
    const grouped = data.leases.reduce((acc, lease) => {
      const key = lease.property_name;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(lease);
      return acc;
    }, {} as Record<string, TenantLease[]>);
    
    return grouped;
  };

  const hasMultipleLeases = () => {
    return data.leases.length > 1;
  };

  const hasMultipleProperties = () => {
    const propertyIds = new Set(data.leases.map(lease => lease.property_id));
    return propertyIds.size > 1;
  };

  return {
    data,
    leases: data.leases,
    loading,
    error,
    refetch: fetchTenantLeases,
    getActiveLease,
    getLeasesByProperty,
    hasMultipleLeases,
    hasMultipleProperties
  };
}