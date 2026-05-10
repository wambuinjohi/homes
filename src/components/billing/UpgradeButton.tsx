import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";
import { UpgradeModal } from "./UpgradeModal";
import { useTrialManagement } from "@/hooks/useTrialManagement";

interface UpgradeButtonProps {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  className?: string;
  children?: React.ReactNode;
}

export function UpgradeButton({ 
  variant = "default", 
  size = "default", 
  className
}: UpgradeButtonProps) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { trialStatus } = useTrialManagement();

  // Don't show if user is not in trial
  if (!trialStatus || trialStatus.status === 'active') {
    return null;
  }

  

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setShowUpgradeModal(true)}
      >
        <Crown className="h-4 w-4 mr-2" />
        Upgrade plan
      </Button>
      
      <UpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)} 
      />
    </>
  );
}