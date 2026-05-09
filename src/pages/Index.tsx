import React, { Suspense, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecentPayments } from "@/components/dashboard/RecentPayments";
import { RecentActivityAlerts } from "@/components/dashboard/RecentActivityAlerts";
import { OptimizedStatsCards } from "@/components/optimized/OptimizedStatsCards";
import { OptimizedChartsSection } from "@/components/optimized/OptimizedChartsSection";
import { GatedOptimizedStatsCards } from "@/components/optimized/GatedOptimizedStatsCards";
import { GatedOptimizedChartsSection } from "@/components/optimized/GatedOptimizedChartsSection";
import { GatedFloatingActionMenu } from "@/components/dashboard/GatedFloatingActionMenu";
import { GettingStartedWidget } from "@/components/onboarding/GettingStartedWidget";
import { useLandlordDashboard } from "@/hooks/useLandlordDashboard";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { useRouteTitle } from "@/hooks/useRouteTitle";
import { HealthCheckBanner } from "@/components/HealthCheckBanner";
import { useLeaseExpiryCount } from "@/hooks/useLeaseExpiryCount";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SubUserBanner } from "@/components/SubUserBanner";
import { useRole } from "@/context/RoleContext";

export default function Index() {
  useRouteTitle();
  const navigate = useNavigate();
  const { data, loading, error } = useLandlordDashboard();
  const { expiringCount } = useLeaseExpiryCount();
  // Removed redundant redirect - RoleBasedRoute handles this

  // Extract dashboard stats safely
  const stats = data?.property_stats ? {
    totalProperties: data.property_stats.total_properties,
    totalUnits: data.property_stats.total_units,
    occupiedUnits: data.property_stats.occupied_units,
    vacantUnits: data.property_stats.total_units - data.property_stats.occupied_units,
    monthlyRevenue: data.property_stats.monthly_revenue,
    occupancyRate: data.property_stats.total_units > 0
      ? Math.round((data.property_stats.occupied_units / data.property_stats.total_units) * 100)
      : 0,
    totalExpenses: 0, // Will be fetched separately
    netIncome: data.property_stats.monthly_revenue,
    activeTenants: (data.property_stats as any).active_tenants ?? data.property_stats.occupied_units, // Prefer tenants RPC count, fallback to occupied units
    maintenanceRequests: data?.pending_maintenance?.length || 0
  } : null;

  // Transform chart data to expected format
  const chartData = data?.recent_payments?.map((payment, index) => ({
    month: new Date(payment.payment_date).toLocaleDateString('en-US', { month: 'short' }),
    revenue: payment.amount,
    expenses: 0, // Placeholder
    profit: payment.amount
  })) || [];

  if (loading) {
    return (
      <DashboardLayout>
        <div className="bg-tint-gray p-3 sm:p-4 lg:p-6 space-y-6 sm:space-y-8">
          <LoadingSkeleton type="card" count={4} />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="bg-tint-gray p-3 sm:p-4 lg:p-6 space-y-6 sm:space-y-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <CardTitle className="text-xl font-semibold text-destructive mb-2">Dashboard Error</CardTitle>
                <p className="text-muted-foreground">
                  {error || "Failed to load dashboard data"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="bg-tint-gray p-3 sm:p-4 lg:p-6 space-y-6 sm:space-y-8">
        {/* Sub-User Banner */}
        <SubUserBanner />
        
        {/* Health Check Banner */}
        <HealthCheckBanner />
        
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Welcome to Zira Homes property management system
          </p>
        </div>
        
        {/* Lease Expiry Alert */}
        {expiringCount > 0 && (
          <Alert className="border-warning/20 bg-warning/5">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                <strong>{expiringCount}</strong> lease{expiringCount > 1 ? 's' : ''} expiring in the next 90 days
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/leases?expiringWithinDays=90')}
                className="ml-4"
              >
                <Calendar className="h-3 w-3 mr-1" />
                View Details
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* KPI Summary Cards - Using optimized version with actual data */}
        <GettingStartedWidget />
        
        <Suspense fallback={<LoadingSkeleton type="card" count={4} />}>
          <GatedOptimizedStatsCards stats={stats} isLoading={loading} />
        </Suspense>
        
        {/* Charts Section */}
        <Suspense fallback={<LoadingSkeleton type="chart" />}>
          <GatedOptimizedChartsSection chartData={chartData} isLoading={loading} />
        </Suspense>
        
        {/* Recent Activity Section */}
        <Suspense fallback={<LoadingSkeleton type="list" />}>
          <RecentActivityAlerts />
        </Suspense>
        
        {/* Recent Payments Table */}
        <Suspense fallback={<LoadingSkeleton type="table" />}>
          <RecentPayments />
        </Suspense>
      </div>

      {/* Floating Action Menu */}
      <GatedFloatingActionMenu />
    </DashboardLayout>
  );
}
