import React from "react";
import { Lock, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface LockedMenuItemProps {
  children: React.ReactNode;
  isLocked: boolean;
  isPartiallyLocked?: boolean;
  lockMessage?: string;
  className?: string;
  requiredPlan?: string;
  featureTier?: 'starter' | 'professional' | 'enterprise' | 'core';
}

export function LockedMenuItem({ 
  children, 
  isLocked, 
  isPartiallyLocked = false,
  lockMessage = "Upgrade to Pro to access this feature",
  className,
  requiredPlan,
  featureTier = 'professional'
}: LockedMenuItemProps) {
  if (!isLocked && !isPartiallyLocked) {
    return <>{children}</>;
  }

  const LockIcon = isPartiallyLocked ? LockKeyhole : Lock;
  const opacity = isLocked ? "opacity-60" : "opacity-80";
  
  // Color-code locks based on plan tier
  const getTierColor = () => {
    if (isPartiallyLocked) return "text-warning/70";
    switch (featureTier) {
      case 'starter': return "text-yellow-500/70";
      case 'professional': return "text-purple-500/70";
      case 'enterprise': return "text-amber-500/70";
      default: return "text-muted-foreground/60";
    }
  };
  
  const iconOpacity = getTierColor();
  
  const getTooltipMessage = () => {
    if (isPartiallyLocked) return "Some features require Pro plan";
    if (requiredPlan) return `Upgrade to ${requiredPlan} to access this feature`;
    return lockMessage;
  };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("relative flex items-center justify-between", opacity, className)}>
            <div className="flex-1">
              {children}
            </div>
            <div className="flex-shrink-0 ml-2">
              <LockIcon className={cn("h-3 w-3", iconOpacity)} />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <p className="text-sm">{getTooltipMessage()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}