import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/config/queryClient";
import { useMemo } from "react";

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

export interface ChartDataPoint {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

const fetchDashboardStats = async (): Promise<DashboardStats> => {
  // Use Promise.all for parallel requests
  const [propertiesResult, unitsResult, tenantsResult, maintenanceResult] = await Promise.all([
    supabase.from("properties").select("id"),
    supabase.from("units").select("id, status, rent_amount"),
    supabase.from("tenants").select("id"),
    supabase.from("maintenance_requests").select("id").eq("status", "pending")
  ]);

  if (propertiesResult.error) throw propertiesResult.error;
  if (unitsResult.error) throw unitsResult.error;
  if (tenantsResult.error) throw tenantsResult.error;
  if (maintenanceResult.error) throw maintenanceResult.error;

  const totalProperties = propertiesResult.data?.length || 0;
  const totalUnits = unitsResult.data?.length || 0;
  const occupiedUnits = unitsResult.data?.filter(unit => unit.status === "occupied").length || 0;
  const vacantUnits = unitsResult.data?.filter(unit => unit.status === "vacant").length || 0;
  const activeTenants = tenantsResult.data?.length || 0;
  const monthlyRevenue = unitsResult.data
    ?.filter(unit => unit.status === "occupied")
    .reduce((sum, unit) => sum + (unit.rent_amount || 0), 0) || 0;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
  const maintenanceRequests = maintenanceResult.data?.length || 0;

  return {
    totalProperties,
    totalUnits,
    occupiedUnits,
    vacantUnits,
    activeTenants,
    monthlyRevenue,
    occupancyRate,
    maintenanceRequests,
  };
};

const fetchChartData = async (): Promise<ChartDataPoint[]> => {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  
  // Fetch payments and expenses for last 6 months
  const [paymentsResult, expensesResult] = await Promise.all([
    supabase
      .from("payments")
      .select("amount, payment_date")
      .gte("payment_date", sixMonthsAgo.toISOString())
      .lte("payment_date", now.toISOString()),
    supabase
      .from("expenses")
      .select("amount, expense_date")
      .gte("expense_date", sixMonthsAgo.toISOString())
      .lte("expense_date", now.toISOString())
  ]);

  if (paymentsResult.error) throw paymentsResult.error;
  if (expensesResult.error) throw expensesResult.error;

  // Group by month and calculate totals
  const monthlyData: Record<string, { revenue: number; expenses: number }> = {};
  
  // Initialize months
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = date.toISOString().slice(0, 7); // YYYY-MM format
    monthlyData[monthKey] = { revenue: 0, expenses: 0 };
  }

  // Aggregate payments
  paymentsResult.data?.forEach(payment => {
    const monthKey = payment.payment_date.slice(0, 7);
    if (monthlyData[monthKey]) {
      monthlyData[monthKey].revenue += payment.amount;
    }
  });

  // Aggregate expenses
  expensesResult.data?.forEach(expense => {
    const monthKey = expense.expense_date.slice(0, 7);
    if (monthlyData[monthKey]) {
      monthlyData[monthKey].expenses += expense.amount;
    }
  });

  // Convert to chart format
  return Object.entries(monthlyData).map(([monthKey, data]) => ({
    month: new Date(monthKey + "-01").toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    revenue: data.revenue,
    expenses: data.expenses,
    profit: data.revenue - data.expenses,
  }));
};

export function useDashboardStats() {
  const statsQuery = useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: fetchDashboardStats,
    staleTime: 3 * 60 * 1000, // 3 minutes for dashboard stats
    select: (data) => data, // Can add data transformation here if needed
  });

  const chartQuery = useQuery({
    queryKey: queryKeys.dashboard.chartData("6months"),
    queryFn: fetchChartData,
    staleTime: 5 * 60 * 1000, // 5 minutes for chart data
  });

  // Memoized computed values
  const isLoading = useMemo(() => 
    statsQuery.isLoading || chartQuery.isLoading, 
    [statsQuery.isLoading, chartQuery.isLoading]
  );

  const isError = useMemo(() => 
    statsQuery.isError || chartQuery.isError, 
    [statsQuery.isError, chartQuery.isError]
  );

  const error = useMemo(() => 
    statsQuery.error || chartQuery.error, 
    [statsQuery.error, chartQuery.error]
  );

  return {
    stats: statsQuery.data,
    chartData: chartQuery.data,
    isLoading,
    isError,
    error,
    refetch: () => {
      statsQuery.refetch();
      chartQuery.refetch();
    },
  };
}