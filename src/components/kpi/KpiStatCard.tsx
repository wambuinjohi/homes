import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface KpiStatCardProps {
  title: string;
  value: React.ReactNode;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  isLoading?: boolean;
  className?: string;
}

export function KpiStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient,
  isLoading = false,
  className,
}: KpiStatCardProps) {
  return (
    <Card
      className={cn(
        `${gradient} hover:shadow-elevated transition-all duration-500 transform lg:hover:scale-105 rounded-2xl min-h-[80px] sm:min-h-[92px] lg:min-h-[108px]`,
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 p-2.5 lg:p-3">
        <CardTitle className="text-[11px] sm:text-sm font-semibold text-white">{title}</CardTitle>
        <div className="p-1.5 lg:p-2 rounded-full bg-white/20 backdrop-blur-sm">
          <Icon className="h-4 w-4 text-white" />
        </div>
      </CardHeader>
      <CardContent className="p-2.5 pt-0 lg:p-3">
        {isLoading ? (
          <div className="space-y-1.5">
            <div className="h-6 bg-white/20 rounded animate-pulse"></div>
            <div className="h-3 bg-white/10 rounded animate-pulse"></div>
          </div>
        ) : (
          <>
            <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-0.5">{value}</div>
            <p className="text-[11px] sm:text-sm text-white/90 font-medium">{subtitle}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default KpiStatCard;
