import React from "react";
import { formatAmount } from "@/utils/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, DollarSign, AlertCircle, Home, HomeIcon } from "lucide-react";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { Skeleton } from "@/components/ui/skeleton";

export function StatsCards() {
  const { stats, loading } = useDashboardStats();

  const statsConfig = [
    {
      title: "Total Properties",
      value: stats.totalProperties.toString(),
      icon: Building2,
      description: "Properties managed",
      tint: "blue",
      iconColor: "text-accent",
    },
    {
      title: "Rented Units",
      value: stats.occupiedUnits.toString(),
      icon: Home,
      description: `${stats.occupancyRate}% occupancy rate`,
      tint: "green",
      iconColor: "text-success",
    },
    {
      title: "Vacant Units", 
      value: stats.vacantUnits.toString(),
      icon: HomeIcon,
      description: "Available for rent",
      tint: "amber",
      iconColor: "text-warning",
    },
    {
      title: "Monthly Revenue",
      value: formatAmount(stats.monthlyRevenue),
      icon: DollarSign,
      description: "From occupied units",
      tint: "blue",
      iconColor: "text-accent",
    },
    {
      title: "Active Tenants",
      value: stats.activeTenants.toString(),
      icon: Users,
      description: "Registered tenants",
      tint: "gray",
      iconColor: "text-primary",
    },
    {
      title: "Total Units",
      value: stats.totalUnits.toString(),
      icon: AlertCircle,
      description: "All units managed",
      tint: "red",
      iconColor: "text-destructive",
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="w-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-2 pt-3">
              <Skeleton className="h-3 w-[50px]" />
              <Skeleton className="h-3 w-3 rounded flex-shrink-0" />
            </CardHeader>
            <CardContent className="pt-0 px-2 pb-3">
              <Skeleton className="h-4 w-[35px] mb-2" />
              <Skeleton className="h-2 w-[60px]" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {statsConfig.map((stat) => (
        <Card key={stat.title} className={`bg-tint-${stat.tint} border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] w-full`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-2 pt-3">
            <CardTitle className="text-[10px] sm:text-xs font-semibold text-foreground/80 leading-tight line-clamp-2 flex-1 pr-1">{stat.title}</CardTitle>
            <div className={`p-1 rounded-md bg-white/60 backdrop-blur-sm ${stat.iconColor} flex-shrink-0`}>
              <stat.icon className="h-3 w-3" />
            </div>
          </CardHeader>
          <CardContent className="pt-0 px-2 pb-3">
            <div className="text-sm sm:text-lg font-bold text-foreground mb-1 line-clamp-1">{stat.value}</div>
            <p className="text-[9px] sm:text-xs text-muted-foreground font-medium leading-tight line-clamp-2">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}