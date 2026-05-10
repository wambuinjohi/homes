import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DashboardStats {
  totalProperties: number;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  activeTenants: number;
  monthlyRevenue: number;
  occupancyRate: number;
  maintenanceRequests: number;
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProperties: 0,
    totalUnits: 0,
    occupiedUnits: 0,
    vacantUnits: 0,
    activeTenants: 0,
    monthlyRevenue: 0,
    occupancyRate: 0,
    maintenanceRequests: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      // Prefer secure server-side aggregation via RPC to avoid RLS mismatches
      const { data, error } = await supabase.rpc('get_landlord_dashboard_data');
      if (error || !data) throw error || new Error('No data');

      const ps = (data as any).property_stats || {};
      const totalUnits = Number(ps.total_units || 0);
      const occupiedUnits = Number(ps.occupied_units || 0);
      const vacantUnits = Math.max(totalUnits - occupiedUnits, 0);
      const monthlyRevenue = Number(ps.monthly_revenue || 0);

      // pending_maintenance is an array limited by RPC (<=10); use its length as an indicator
      const pending = Array.isArray((data as any).pending_maintenance) ? (data as any).pending_maintenance.length : 0;

      const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

      setStats({
        totalProperties: Number(ps.total_properties || 0),
        totalUnits,
        occupiedUnits,
        vacantUnits,
        activeTenants: occupiedUnits, // proxy until RPC provides exact active tenant count
        monthlyRevenue,
        occupancyRate,
        maintenanceRequests: pending,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats (RPC):', error);
      // fall back to zeros to render UI instead of skeletons
      setStats((s) => ({ ...s }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return { stats, loading, refetch: fetchStats };
}