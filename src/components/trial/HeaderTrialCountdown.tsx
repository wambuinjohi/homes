import React, { useState } from "react";
import { Crown, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTrialManagement } from "@/hooks/useTrialManagement";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/context/RoleContext";
import { UpgradeModal } from "@/components/billing/UpgradeModal";

export function HeaderTrialCountdown() {
  const { user } = useAuth();
  const { effectiveRole } = useRole();
  const { trialStatus, trialDaysRemaining, loading } = useTrialManagement();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Show only for active trial users in header (exclude admins)
  const shouldShow = !loading && 
                     effectiveRole !== 'admin' && 
                     trialStatus && 
                     trialStatus.status === 'trial' && 
                     trialDaysRemaining >= 0;
  if (!shouldShow) {
    return null;
  }

  const isUrgent = trialDaysRemaining <= 3;

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowUpgradeModal(true)}
          className="focus:outline-none"
          aria-label="Upgrade plan - Premium trial active"
          title="You're enjoying full Enterprise features"
        >
          <Badge 
            variant={isUrgent ? 'destructive' : 'default'}
            className={`px-2 py-0.5 text-[10px] sm:text-xs shadow-md bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0 ${isUrgent ? 'animate-pulse' : ''}`}
          >
            <Crown className="h-3 w-3 mr-1 animate-pulse" />
            <span className="sm:hidden">{trialDaysRemaining}d Trial</span>
            <span className="hidden sm:inline">{trialDaysRemaining} {trialDaysRemaining === 1 ? 'Day' : 'Days'} Trial</span>
          </Badge>
        </button>
      </div>
      
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </>
  );
}