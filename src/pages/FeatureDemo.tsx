import React from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { FeatureGateExamples } from "@/components/demo/FeatureGateExamples";

export default function FeatureDemo() {
  return (
    <DashboardLayout>
      <FeatureGateExamples />
    </DashboardLayout>
  );
}