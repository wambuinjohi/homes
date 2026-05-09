import React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Lock, Crown } from "lucide-react";
import { usePlanFeatureAccess, type Feature } from "@/hooks/usePlanFeatureAccess";
import { usePlatformAnalytics } from "@/hooks/usePlatformAnalytics";
import { PlanUpgradeButton } from "./PlanUpgradeButton";
import { useAuth } from "@/hooks/useAuth";

interface DisabledActionWrapperProps {
  feature: Feature;
  currentCount?: number;
  children: React.ReactElement;
  fallbackTitle?: string;
  fallbackDescription?: string;
  showUpgradeInTooltip?: boolean;
  tooltipSide?: "top" | "bottom" | "left" | "right";
}

export function DisabledActionWrapper({
  feature,
  currentCount = 1,
  children,
  fallbackTitle,
  fallbackDescription,
  showUpgradeInTooltip = true,
  tooltipSide = "top"
}: DisabledActionWrapperProps) {
  const { allowed, is_limited, remaining, plan_name, loading, reason } = usePlanFeatureAccess(feature, currentCount);
  const { analytics } = usePlatformAnalytics();
  const { hasRole } = useAuth();

  const handleDisabledClick = () => {
    // Track disabled feature interaction
    console.log('Feature interaction:', feature, 'disabled_click');
  };

  // Allow Admins/System to bypass gating
  const [adminBypass, setAdminBypass] = React.useState<boolean>(false);
  React.useEffect(() => {
    (async () => {
      try {
        const isAdmin = await hasRole('Admin');
        const isSystem = await hasRole('System');
        setAdminBypass(Boolean(isAdmin || isSystem));
      } catch {
        setAdminBypass(false);
      }
    })();
  }, [hasRole]);

  // If allowed or admin bypass, render the children normally
  const netBypass = !loading && (reason === 'network_error' || reason === 'rpc_error' || reason === 'error');
  if ((allowed || adminBypass || netBypass) && !loading) {
    return children;
  }

  if (loading) {
    return React.cloneElement(children, { 
      disabled: true,
      className: `${children.props.className || ''} opacity-50 animate-pulse`
    });
  }

  // Create disabled version with tooltip
  const disabledChild = React.cloneElement(children, {
    disabled: true,
    onClick: handleDisabledClick,
    className: `${children.props.className || ''} opacity-75 cursor-not-allowed relative`
  });

  const tooltipTitle = fallbackTitle || `${feature.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Required`;
  const tooltipDesc = fallbackDescription || `Upgrade your plan to access this feature`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">
            {disabledChild}
            <div className="absolute -top-1 -right-1 bg-destructive rounded-full p-1">
              <Lock className="h-3 w-3 text-destructive-foreground" />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide} className="max-w-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              <span className="font-semibold">{tooltipTitle}</span>
            </div>
            <p className="text-sm text-muted-foreground">{tooltipDesc}</p>
            {is_limited && remaining !== undefined && (
              <Badge variant="destructive" className="text-xs">
                {remaining > 0 ? `${remaining} remaining` : 'Limit reached'}
              </Badge>
            )}
            {showUpgradeInTooltip && (
              <div className="pt-2 border-t">
                <PlanUpgradeButton 
                  feature={feature}
                  size="sm" 
                  variant="default"
                  className="w-full"
                >
                  Upgrade Plan
                </PlanUpgradeButton>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
