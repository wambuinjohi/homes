import React from "react";
import { Badge } from "@/components/ui/badge";
import { Crown, Lock, CheckCircle } from "lucide-react";
import { usePlanFeatureAccess, type Feature } from "@/hooks/usePlanFeatureAccess";

interface FeatureBadgeProps {
  feature: Feature;
  currentCount?: number;
  showIcon?: boolean;
  showPlanName?: boolean;
  size?: "sm" | "default";
}

export function FeatureBadge({ 
  feature, 
  currentCount = 1,
  showIcon = true,
  showPlanName = false,
  size = "default"
}: FeatureBadgeProps) {
  const { allowed, is_limited, limit, remaining, plan_name, loading } = usePlanFeatureAccess(feature, currentCount);

  if (loading) {
    return (
      <Badge variant="outline" className="animate-pulse">
        <div className="w-12 h-3 bg-muted rounded"></div>
      </Badge>
    );
  }

  const getVariant = () => {
    if (allowed) {
      if (is_limited && remaining !== undefined && remaining <= 2) {
        return "destructive" as const;
      }
      return "default" as const;
    }
    return "outline" as const;
  };

  const getIcon = () => {
    if (!showIcon) return null;
    
    if (allowed) {
      if (is_limited && remaining !== undefined && remaining <= 2) {
        return <Crown className="h-3 w-3 mr-1" />;
      }
      return <CheckCircle className="h-3 w-3 mr-1" />;
    }
    return <Lock className="h-3 w-3 mr-1" />;
  };

  const getText = () => {
    if (allowed) {
      if (is_limited && limit && remaining !== undefined) {
        if (remaining <= 2) {
          return `${remaining}/${limit} left`;
        }
        return "Available";
      }
      return "Available";
    }
    return "Locked";
  };

  const badgeClass = size === "sm" ? "text-xs px-2 py-0.5" : "";

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant={getVariant()}
        className={badgeClass}
      >
        {getIcon()}
        {getText()}
      </Badge>
      
      {showPlanName && plan_name && (
        <Badge variant="outline" className="text-xs">
          {plan_name}
        </Badge>
      )}
    </div>
  );
}