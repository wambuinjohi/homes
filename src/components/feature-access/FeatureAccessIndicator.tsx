import React from "react";
import { Badge } from "@/components/ui/badge";
import { Crown, Lock, CheckCircle, AlertCircle } from "lucide-react";
import { usePlanFeatureAccess, type Feature } from "@/hooks/usePlanFeatureAccess";

interface FeatureAccessIndicatorProps {
  feature: Feature;
  currentCount?: number;
  showPlanName?: boolean;
  variant?: "default" | "mini" | "detailed";
}

export function FeatureAccessIndicator({ 
  feature, 
  currentCount = 1, 
  showPlanName = false,
  variant = "default"
}: FeatureAccessIndicatorProps) {
  const { allowed, is_limited, limit, remaining, plan_name, loading } = usePlanFeatureAccess(feature, currentCount);

  if (loading) {
    return (
      <Badge variant="outline" className="animate-pulse">
        <div className="w-16 h-3 bg-muted rounded"></div>
      </Badge>
    );
  }

  if (variant === "mini") {
    return (
      <div className="flex items-center gap-1">
        {allowed ? (
          <CheckCircle className="h-3 w-3 text-success" />
        ) : (
          <Lock className="h-3 w-3 text-muted-foreground" />
        )}
      </div>
    );
  }

  if (variant === "detailed") {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {allowed ? (
            <>
              <CheckCircle className="h-4 w-4 text-success" />
              <span className="text-sm font-medium text-success">Available</span>
            </>
          ) : (
            <>
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Locked</span>
            </>
          )}
          {showPlanName && plan_name && (
            <Badge variant="outline" className="text-xs">
              {plan_name}
            </Badge>
          )}
        </div>
        
        {is_limited && limit && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <AlertCircle className="h-3 w-3" />
            <span>
              {remaining !== undefined ? `${remaining} of ${limit} remaining` : `Limited to ${limit}`}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant={allowed ? "default" : "outline"}
        className={allowed ? "bg-success text-white" : ""}
      >
        {allowed ? (
          <>
            <CheckCircle className="h-3 w-3 mr-1" />
            Available
          </>
        ) : (
          <>
            <Lock className="h-3 w-3 mr-1" />
            Upgrade Required
          </>
        )}
      </Badge>
      
      {showPlanName && plan_name && (
        <Badge variant="outline" className="text-xs">
          {plan_name}
        </Badge>
      )}
      
      {is_limited && limit && remaining !== undefined && (
        <span className="text-xs text-muted-foreground">
          {remaining} of {limit} remaining
        </span>
      )}
    </div>
  );
}