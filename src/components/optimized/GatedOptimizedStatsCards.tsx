import React from "react";
import { OptimizedStatsCards } from "./OptimizedStatsCards";
import { FeatureGate } from "@/components/ui/feature-gate";

interface GatedOptimizedStatsCardsProps {
  stats: any;
  isLoading: boolean;
}

export function GatedOptimizedStatsCards({ stats, isLoading }: GatedOptimizedStatsCardsProps) {
  return (
    <FeatureGate
      feature="dashboard.stats_cards"
      fallbackTitle="Analytics Dashboard"
      fallbackDescription="Get detailed insights into your property performance with advanced analytics."
      allowReadOnly={false}
    >
      <OptimizedStatsCards stats={stats} isLoading={isLoading} />
    </FeatureGate>
  );
}