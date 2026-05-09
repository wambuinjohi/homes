import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { Crown, Lock, Sparkles, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlanFeatureAccess, type Feature } from "@/hooks/usePlanFeatureAccess";

interface TrialFeatureBadgeProps {
  feature: Feature;
  children: React.ReactNode;
  showTooltip?: boolean;
}

export function TrialFeatureBadge({ 
  feature, 
  children,
  showTooltip = true 
}: TrialFeatureBadgeProps) {
  const navigate = useNavigate();
  const { allowed, plan_name, status, reason } = usePlanFeatureAccess(feature);

  const handleUpgrade = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    navigate("/upgrade");
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!allowed && reason !== 'network_error' && reason !== 'rpc_error' && reason !== 'error') {
      e.stopPropagation();
      e.preventDefault();
    }
  };

  // If feature is allowed and NOT on trial, show children without badge (paid user)
  if ((allowed || reason === 'network_error' || reason === 'rpc_error' || reason === 'error') && status !== 'trial') {
    return <>{children}</>;
  }

  // Trial user with access - show with "Trial" badge (functional)
  if (allowed && status === 'trial') {
    if (!showTooltip) {
      return (
        <div className="relative inline-block">
          {children}
          <Badge 
            variant="outline" 
            className="absolute -top-2 -right-2 gap-1 text-[10px] h-5 px-1.5 border-purple-500/30 bg-purple-500/10 backdrop-blur-sm shadow-sm pointer-events-auto cursor-pointer"
            onClick={handleUpgrade}
          >
            <Sparkles className="h-2.5 w-2.5 text-purple-600" />
            Trial
          </Badge>
        </div>
      );
    }

    return (
      <TooltipProvider>
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <div className="relative inline-block">
              {children}
              <Badge 
                variant="outline" 
                className="absolute -top-2 -right-2 gap-1 text-[10px] h-5 px-1.5 border-purple-500/30 bg-purple-500/10 backdrop-blur-sm shadow-sm hover:bg-purple-500/20 transition-colors pointer-events-auto cursor-pointer z-10"
              >
                <Sparkles className="h-2.5 w-2.5 text-purple-600" />
                Trial
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent 
            side="bottom" 
            className="max-w-xs p-4 bg-popover border shadow-lg"
            sideOffset={8}
          >
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="p-1.5 bg-purple-100 dark:bg-purple-950 rounded">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Premium Feature</h4>
                  <p className="text-xs text-muted-foreground">
                    Available during your trial period. Upgrade to keep access after trial ends.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-950 rounded text-xs">
                <Sparkles className="h-3 w-3 text-purple-600" />
                <span className="text-purple-900 dark:text-purple-100">
                  Active during trial
                </span>
              </div>
              
              {plan_name && (
                <p className="text-xs text-muted-foreground">
                  Current plan: <span className="font-medium">{plan_name}</span>
                </p>
              )}
              
              <Button 
                size="sm" 
                className="w-full h-8 text-xs"
                onClick={handleUpgrade}
              >
                <Crown className="h-3 w-3 mr-1" />
                Upgrade to Keep Access
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Feature locked - show with "Pro" badge (disabled)
  if (!showTooltip) {
    return (
      <div className="relative inline-block" onClick={handleClick}>
        <div className="opacity-60 pointer-events-none">
          {children}
        </div>
        <Badge 
          variant="outline" 
          className="absolute -top-2 -right-2 gap-1 text-[10px] h-5 px-1.5 border-primary/30 bg-primary/10 backdrop-blur-sm shadow-sm pointer-events-auto cursor-pointer"
          onClick={handleUpgrade}
        >
          <Crown className="h-2.5 w-2.5" />
          Pro
        </Badge>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div className="relative inline-block" onClick={handleClick}>
            <div className="opacity-60 pointer-events-none">
              {children}
            </div>
            <Badge 
              variant="outline" 
              className="absolute -top-2 -right-2 gap-1 text-[10px] h-5 px-1.5 border-primary/30 bg-primary/10 backdrop-blur-sm shadow-sm hover:bg-primary/20 transition-colors pointer-events-auto cursor-pointer z-10"
            >
              <Crown className="h-2.5 w-2.5" />
              Pro
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="bottom" 
          className="max-w-xs p-4 bg-popover border shadow-lg"
          sideOffset={8}
        >
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <div className="p-1.5 bg-primary/10 rounded">
                <Lock className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1">Premium Feature</h4>
                <p className="text-xs text-muted-foreground">
                  Unlock bulk operations to efficiently manage multiple items at once.
                </p>
              </div>
            </div>
            
            {plan_name && (
              <p className="text-xs text-muted-foreground">
                Current plan: <span className="font-medium">{plan_name}</span>
              </p>
            )}
            
            <Button 
              size="sm" 
              className="w-full h-8 text-xs"
              onClick={handleUpgrade}
            >
              <Crown className="h-3 w-3 mr-1" />
              Upgrade Now
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
