import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantLeases } from "@/hooks/useTenantLeases";

interface TenantDashboardData {
  tenant: any;
  lease: any;
  property: any;
  unit: any;
  currentInvoice: any;
  recentPayments: any[];
  maintenanceRequests: any[];
  announcements: any[];
}

export function useTenantDashboardData(activeLeaseId?: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["tenant-dashboard", user?.id, activeLeaseId],
    queryFn: async (): Promise<TenantDashboardData | null> => {
      if (!user || !activeLeaseId) {
        console.log("useTenantDashboardData: Missing user or activeLeaseId", { user: !!user, activeLeaseId });
        return null;
      }

      // First get the lease details
      const { data: leases, error: leasesError } = await supabase
        .rpc('get_tenant_leases', { p_user_id: user.id });

      if (leasesError) {
        console.error("Error fetching tenant leases:", leasesError);
        return null;
      }

      const leasesData = (leases as any);
      const activeLease = leasesData?.leases?.find((l: any) => l.id === activeLeaseId);
      
      if (!activeLease) {
        console.log("useTenantDashboardData: No active lease found for ID", activeLeaseId);
        return null;
      }

      // Get basic tenant info
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", activeLease.tenant_id)
        .maybeSingle();

      if (tenantError || !tenant) {
        console.log("Tenant query error:", tenantError);
        return null;
      }

      // Parallel queries for dashboard data specific to the selected lease
      const [
        currentInvoiceResult,
        fallbackInvoiceResult,
        recentPaymentsResult,
        maintenanceRequestsResult,
        announcementsResult
      ] = await Promise.all([
        // Current pending/overdue invoice for this tenant
        supabase
          .from("invoices")
          .select("id, amount, due_date, status")
          .eq("tenant_id", tenant.id)
          .in("status", ["pending", "overdue"])
          .order("due_date", { ascending: true })
          .limit(1)
          .maybeSingle(),
        
        // Fallback: Get most recent invoice if no pending/overdue ones
        supabase
          .from("invoices")
          .select("id, amount, due_date, status")
          .eq("tenant_id", tenant.id)
          .order("invoice_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
        
        // Recent payments for this tenant
        supabase
          .from("payments")
          .select("id, amount, payment_date, payment_method, status")
          .eq("tenant_id", tenant.id)
          .eq("status", "completed")
          .order("payment_date", { ascending: false })
          .limit(3),
        
        // Maintenance requests for this property
        supabase
          .from("maintenance_requests")
          .select("id, status, submitted_date, issue_type, priority")
          .eq("property_id", activeLease.property_id)
          .eq("tenant_id", tenant.id)
          .order("submitted_date", { ascending: false })
          .limit(3),
        
        // Announcements for this property
        supabase
          .from("tenant_announcements")
          .select("id, title, content, created_at")
          .eq("property_id", activeLease.property_id)
          .order("created_at", { ascending: false })
          .limit(3)
      ]);

      // Use current invoice if available, otherwise fallback to most recent
      const currentInvoice = currentInvoiceResult.data || fallbackInvoiceResult.data;

      console.log("useTenantDashboardData: Fetched data", {
        tenantId: tenant.id,
        leaseId: activeLease.id,
        currentInvoice: currentInvoice ? { id: currentInvoice.id, status: currentInvoice.status, amount: currentInvoice.amount } : null,
        recentPaymentsCount: recentPaymentsResult.data?.length || 0,
        maintenanceRequestsCount: maintenanceRequestsResult.data?.length || 0,
        announcementsCount: announcementsResult.data?.length || 0
      });

      return {
        tenant,
        lease: activeLease,
        property: activeLease ? {
          id: activeLease.property_id,
          name: activeLease.property_name,
          address: activeLease.address,
          city: activeLease.city,
          state: activeLease.state
        } : null,
        unit: activeLease ? {
          id: activeLease.unit_id,
          unit_number: activeLease.unit_number,
          floor: activeLease.floor,
          bedrooms: activeLease.bedrooms,
          bathrooms: activeLease.bathrooms,
          square_feet: activeLease.square_feet
        } : null,
        currentInvoice,
        recentPayments: recentPaymentsResult.data || [],
        maintenanceRequests: maintenanceRequestsResult.data || [],
        announcements: announcementsResult.data || [],
      };
    },
    enabled: !!user && !!activeLeaseId,
    staleTime: 1000 * 60 * 1, // 1 minute for fresher data
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
}