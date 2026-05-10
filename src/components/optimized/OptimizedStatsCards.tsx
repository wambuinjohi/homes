import React, { memo } from "react";
import { formatAmount, getCurrencySymbol } from "@/utils/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Home, DollarSign, AlertTriangle, Calendar } from "lucide-react";
import { DashboardStats } from "@/hooks/optimized/useDashboardStats";
import { KpiGrid } from "@/components/kpi/KpiGrid";
import { KpiStatCard } from "@/components/kpi/KpiStatCard";

interface OptimizedStatsCardsProps {
  stats?: DashboardStats;
  isLoading: boolean;
}




export const OptimizedStatsCards = memo(({ stats, isLoading }: OptimizedStatsCardsProps) => {
  const formatCurrency = (amount: number) => {
    const symbol = getCurrencySymbol();
    if (amount >= 1000000) {
      return `${symbol} ${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${symbol} ${Math.round(amount / 1000)}K`;
    } else {
      return formatAmount(amount);
    }
  };

  const primaryCards = [
    {
      title: "Total Properties",
      value: stats?.totalProperties ?? 0,
      subtitle: "Active properties",
      icon: Building2,
      gradient: "card-gradient-blue"
    },
    {
      title: "Active Tenants", 
      value: stats?.activeTenants ?? 0,
      subtitle: "Current tenants",
      icon: Users,
      gradient: "card-gradient-green"
    },
    {
      title: "Total Units",
      value: stats?.totalUnits ?? 0,
      subtitle: "All units",
      icon: Home,
      gradient: "card-gradient-orange"
    },
    {
      title: "Monthly Revenue",
      value: stats?.monthlyRevenue ? formatCurrency(stats.monthlyRevenue) : formatAmount(0),
      subtitle: "Expected monthly",
      icon: DollarSign,
      gradient: "card-gradient-navy"
    }
  ];

  const secondaryCards = [
    {
      title: "Occupancy Rate",
      value: `${Math.round(Number(stats?.occupancyRate ?? 0))}%`,
      subtitle: `${stats?.totalUnits ?? 0} total units`,
      icon: Home,
      gradient: "card-gradient-green"
    },
    {
      title: "Vacant Units",
      value: stats?.vacantUnits ?? 0,
      subtitle: "Available for rent",
      icon: Calendar,
      gradient: "card-gradient-orange"
    },
    {
      title: "Maintenance Requests",
      value: stats?.maintenanceRequests ?? 0,
      subtitle: "Pending action",
      icon: AlertTriangle,
      gradient: "card-gradient-red"
    }
  ];

  return (
    <>
      {/* Primary KPI Cards */}
      <KpiGrid>
        {primaryCards.map((card, index) => (
          <KpiStatCard
            key={`primary-${index}`}
            title={card.title}
            value={card.value}
            subtitle={card.subtitle}
            icon={card.icon}
            gradient={card.gradient}
            isLoading={isLoading}
          />
        ))}
      </KpiGrid>
      
      {/* Secondary KPI Cards */}
      <KpiGrid className="lg:grid-cols-3">
        {secondaryCards.map((card, index) => (
          <KpiStatCard
            key={`secondary-${index}`}
            title={card.title}
            value={card.value}
            subtitle={card.subtitle}
            icon={card.icon}
            gradient={card.gradient}
            isLoading={isLoading}
          />
        ))}
      </KpiGrid>
    </>
  );
});

OptimizedStatsCards.displayName = "OptimizedStatsCards";
