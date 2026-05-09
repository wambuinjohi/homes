import React from "react";
import { FeatureGate } from "@/components/ui/feature-gate";
import { FEATURES, type Feature } from "@/hooks/usePlanFeatureAccess";

interface PlanAccessGateProps {
  children: React.ReactNode;
  feature: Feature;
  currentCount?: number;
  fallbackTitle?: string;
  fallbackDescription?: string;
  allowReadOnly?: boolean;
  readOnlyMessage?: string;
}

export function PlanAccessGate({ 
  children, 
  feature, 
  currentCount = 1,
  fallbackTitle,
  fallbackDescription,
  allowReadOnly = false,
  readOnlyMessage
}: PlanAccessGateProps) {
  return (
    <FeatureGate
      feature={feature}
      currentCount={currentCount}
      fallbackTitle={fallbackTitle}
      fallbackDescription={fallbackDescription}
      allowReadOnly={allowReadOnly}
      readOnlyMessage={readOnlyMessage}
    >
      {children}
    </FeatureGate>
  );
}

// Pre-configured gates for common features
export const ReportsGate = ({ children }: { children: React.ReactNode }) => (
  <PlanAccessGate
    feature={FEATURES.BASIC_REPORTING}
    fallbackTitle="Advanced Reporting"
    fallbackDescription="Generate comprehensive financial and operational reports with advanced analytics."
  >
    {children}
  </PlanAccessGate>
);

export const BulkOperationsGate = ({ children }: { children: React.ReactNode }) => (
  <PlanAccessGate
    feature={FEATURES.BULK_OPERATIONS}
    fallbackTitle="Bulk Operations"
    fallbackDescription="Efficiently manage multiple properties with bulk upload and operations."
  >
    {children}
  </PlanAccessGate>
);

export const SubUsersGate = ({ children }: { children: React.ReactNode }) => (
  <PlanAccessGate
    feature={FEATURES.SUB_USERS}
    fallbackTitle="Team Management"
    fallbackDescription="Add team members with custom permissions and role-based access control."
  >
    {children}
  </PlanAccessGate>
);

export const SMSGate = ({ children, currentCount = 1 }: { children: React.ReactNode; currentCount?: number }) => (
  <PlanAccessGate
    feature={FEATURES.SMS_NOTIFICATIONS}
    currentCount={currentCount}
    fallbackTitle="SMS Notifications"
    fallbackDescription="Stay connected with tenants through SMS notifications and alerts."
  >
    {children}
  </PlanAccessGate>
);

export const APIGate = ({ children }: { children: React.ReactNode }) => (
  <PlanAccessGate
    feature={FEATURES.API_ACCESS}
    fallbackTitle="API Integration"
    fallbackDescription="Connect with third-party applications and automate workflows."
  >
    {children}
  </PlanAccessGate>
);

export const DocumentTemplatesGate = ({ children }: { children: React.ReactNode }) => (
  <PlanAccessGate
    feature={FEATURES.DOCUMENT_TEMPLATES}
    fallbackTitle="Document Templates"
    fallbackDescription="Create and customize professional document templates."
  >
    {children}
  </PlanAccessGate>
);