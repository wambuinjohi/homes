import React from "react";
import { StatsCards } from "./StatsCards";
import { FeatureGate } from "@/components/ui/feature-gate";

export function GatedStatsCards() {
  return (
    <FeatureGate
      feature="dashboard.stats_cards"
      fallbackTitle="Analytics Dashboard"
      fallbackDescription="Get detailed insights into your property performance with advanced analytics."
      allowReadOnly={false}
    >
      <StatsCards />
    </FeatureGate>
  );
}