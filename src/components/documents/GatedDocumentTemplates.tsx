import React from "react";
import { FeatureGate } from "@/components/ui/feature-gate";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";

interface GatedDocumentTemplatesProps {
  children: React.ReactNode;
}

export function GatedDocumentTemplates({ children }: GatedDocumentTemplatesProps) {
  return (
    <FeatureGate
      feature={FEATURES.DOCUMENT_TEMPLATES}
      fallbackTitle="Document Templates"
      fallbackDescription="Create and customize professional document templates for leases, invoices, notices, and more."
      allowReadOnly={true}
      readOnlyMessage="Document Templates - View-only mode. Upgrade for custom template creation"
    >
      {children}
    </FeatureGate>
  );
}