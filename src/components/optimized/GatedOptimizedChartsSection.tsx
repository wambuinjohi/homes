import React from "react";
import { OptimizedChartsSection } from "./OptimizedChartsSection";
import { FeatureGate } from "@/components/ui/feature-gate";

interface GatedOptimizedChartsSectionProps {
  chartData: any[];
  isLoading: boolean;
}

export function GatedOptimizedChartsSection({ chartData, isLoading }: GatedOptimizedChartsSectionProps) {
  return (
    <FeatureGate
      feature="dashboard.charts"
      fallbackTitle="Advanced Charts & Analytics"
      fallbackDescription="Visualize your property data with comprehensive charts and trend analysis."
      allowReadOnly={false}
    >
      <OptimizedChartsSection chartData={chartData} isLoading={isLoading} />
    </FeatureGate>
  );
}