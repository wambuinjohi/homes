import React from "react";
import { Button } from "@/components/ui/button";
import { Crown, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlanFeatureAccess, type Feature } from "@/hooks/usePlanFeatureAccess";

interface PlanUpgradeButtonProps {
  feature?: Feature;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "ghost";
  className?: string;
  children?: React.ReactNode;
}

export function PlanUpgradeButton({ 
  feature,
  size = "default",
  variant = "default",
  className,
  children
}: PlanUpgradeButtonProps) {
  const navigate = useNavigate();
  const { allowed, loading, plan_name } = usePlanFeatureAccess(feature || 'reports.basic');

  const handleUpgrade = () => {
    navigate("/upgrade");
  };

  // Don't show if user already has access to the feature (unless no feature specified)
  if (feature && allowed && !loading) {
    return null;
  }

  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      onClick={handleUpgrade}
    >
      <Crown className="h-4 w-4 mr-2" />
      {children || (plan_name ? `Upgrade from ${plan_name}` : "Upgrade Plan")}
      <ArrowRight className="h-4 w-4 ml-2" />
    </Button>
  );
}