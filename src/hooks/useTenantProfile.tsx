import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface TenantProfileData {
  tenant: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    employment_status?: string;
    employer_name?: string;
    monthly_income?: number;
    profession?: string;
    national_id?: string;
    previous_address?: string;
  } | null;
  leases: {
    id: string;
    lease_start_date: string;
    lease_end_date: string;
    monthly_rent: number;
    security_deposit?: number;
    status: string;
    lease_terms?: string;
    unit_number: string;
    floor?: string;
    unit_rent?: number;
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
  }[];
  // Backward compatibility - primary lease (most recent active)
  lease: {
    id: string;
    lease_start_date: string;
    lease_end_date: string;
    monthly_rent: number;
    security_deposit?: number;
    status: string;
    lease_terms?: string;
    unit_number: string;
    floor?: string;
    unit_rent?: number;
    property_name: string;
    address: string;
    city: string;
    state: string;
    amenities?: string[];
    property_description?: string;
  } | null;
  landlord: {
    landlord_first_name: string;
    landlord_last_name: string;
    landlord_email: string;
    landlord_phone: string;
  } | null;
}

export function useTenantProfile() {
  const [data, setData] = useState<TenantProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchTenantProfile();
    }
  }, [user]);

  const fetchTenantProfile = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: result, error: rpcError } = await supabase
        .rpc('get_tenant_profile_data', { p_user_id: user.id });

      if (rpcError) {
        console.error('RPC Error:', rpcError.code, rpcError.message);
        throw rpcError;
      }

      // Validate and normalize result data
      const leases = (result as any)?.leases || [];
      const primaryLease = leases.length > 0 ? leases[0] : null;
      
      const validatedData: TenantProfileData = {
        tenant: (result as any)?.tenant && typeof (result as any).tenant === 'object' ? (result as any).tenant : null,
        leases: Array.isArray(leases) ? leases : [],
        lease: primaryLease, // Backward compatibility
        landlord: (result as any)?.landlord && typeof (result as any).landlord === 'object' ? (result as any).landlord : null
      };
      
      setData(validatedData);
    } catch (err) {
      console.error('Error fetching tenant profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  return {
    data,
    loading,
    error,
    refetch: fetchTenantProfile
  };
}