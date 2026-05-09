import React from "react";
import { FileText, TrendingUp, Calendar, Users } from "lucide-react";
import { KpiGrid } from "@/components/kpi/KpiGrid";
import { KpiStatCard } from "@/components/kpi/KpiStatCard";
import { useReportKpis } from "@/hooks/useReportKpis";
import { fmtNumber, fmtPercent } from "@/lib/format";

interface ReportKpiCardsProps {
  onReportClick?: (reportType: string) => void;
  availableCount?: number;
  totalCount?: number;
}

export function ReportKpiCards({ onReportClick, availableCount, totalCount }: ReportKpiCardsProps) {
  const { data: kpis, isLoading } = useReportKpis();

  const kpiCards = [
    {
      title: "Reports Generated",
      value: kpis ? fmtNumber(kpis.reportsGenerated) : "0",
      subtitle: "This month",
      icon: FileText,
      gradient: "bg-gradient-to-br from-blue-500 to-blue-600",
      onClick: () => onReportClick?.('all')
    },
    {
      title: "Collection Rate",
      value: kpis ? fmtPercent(kpis.collectionRate, 1) : "0%",
      subtitle: "Current month",
      icon: TrendingUp,
      gradient: "bg-gradient-to-br from-green-500 to-green-600",
      onClick: () => onReportClick?.('rent-collection')
    },
    {
      title: "Available Reports", 
      value: availableCount !== undefined ? fmtNumber(availableCount) : (kpis ? fmtNumber(kpis.scheduledReports) : "0"),
      subtitle: totalCount !== undefined ? `of ${totalCount} total` : "Ready to generate",
      icon: Calendar,
      gradient: "bg-gradient-to-br from-orange-500 to-orange-600",
      onClick: () => onReportClick?.('scheduled')
    },
    {
      title: "Data Coverage",
      value: kpis ? `${fmtNumber(kpis.dataCoverage)}%` : "0%",
      subtitle: "Properties analyzed",
      icon: Users,
      gradient: "bg-gradient-to-br from-slate-500 to-slate-600",
      onClick: () => onReportClick?.('coverage')
    }
  ];

  return (
    <KpiGrid className="mb-6">
      {kpiCards.map((kpi, index) => (
        <div 
          key={index}
          onClick={kpi.onClick}
          className="cursor-pointer"
        >
          <KpiStatCard
            title={kpi.title}
            value={kpi.value}
            subtitle={kpi.subtitle}
            icon={kpi.icon}
            gradient={kpi.gradient}
            isLoading={isLoading}
          />
        </div>
      ))}
    </KpiGrid>
  );
}