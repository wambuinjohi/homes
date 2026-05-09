import React from "react";
import { ChartsSection } from "./ChartsSection";
import { FeatureGate } from "@/components/ui/feature-gate";

export function GatedChartsSection() {
  return (
    <FeatureGate
      feature="dashboard.charts"
      fallbackTitle="Advanced Charts & Analytics"
      fallbackDescription="Visualize your property data with comprehensive charts and trend analysis."
      allowReadOnly={false}
    >
      <ChartsSection />
    </FeatureGate>
  );
}