import React, { useState, useEffect } from "react";
import { X, Clock, CreditCard, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTrialManagement } from "@/hooks/useTrialManagement";
import { useAuth } from "@/hooks/useAuth";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { TRIAL_DEFAULTS, TRIAL_URGENCY } from "@/constants/trialDefaults";

export function FloatingTrialCountdown() {
  console.log('🚀 FloatingTrialCountdown component rendering...');
  const { user } = useAuth();
  const { trialStatus, trialDaysRemaining, loading } = useTrialManagement();
  const [isDismissed, setIsDismissed] = useState(() => {
    // Check localStorage for dismissal status
    const dismissed = localStorage.getItem(`trial-dismissed-${user?.id}`);
    return dismissed === 'true';
  });
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Debug logging
  console.log('🔍 FloatingTrialCountdown Debug:', {
    loading,
    user: user?.id,
    trialStatus,
    trialDaysRemaining,
    isDismissed
  });

  // Smart display logic - hide during onboarding and on billing pages
  const currentPath = window.location.pathname;
  const isOnBillingPage = currentPath.includes('/billing') || currentPath.includes('/upgrade');
  const isOnOnboardingPage = currentPath.includes('/onboarding');
  
  // Show for trial users with more robust conditions - ANY plan can have trial status
  const shouldShow = !loading && 
    !isDismissed && 
    !isOnBillingPage &&
    !isOnOnboardingPage &&
    trialStatus && 
    (trialStatus.status === 'trial' || trialStatus.status === 'trial_expired') &&
    trialDaysRemaining >= 0; // Show even on last day (0 days remaining)

  console.log('🎯 FloatingTrialCountdown shouldShow logic:', {
    timestamp: new Date().toISOString(),
    shouldShow,
    conditions: {
      notLoading: !loading,
      notDismissed: !isDismissed,
      notOnBillingPage: !isOnBillingPage,
      notOnOnboardingPage: !isOnOnboardingPage,
      statusIsTrial: trialStatus?.status === 'trial',
      planName: trialStatus?.planName,
      daysRemaining: trialDaysRemaining
    }
  });

  if (!shouldShow) {
    console.log('❌ FloatingTrialCountdown not showing');
    return null;
  }

  // Calculate trial progress dynamically based on actual trial period
  const totalTrialDays = trialStatus?.totalTrialDays || TRIAL_DEFAULTS.TRIAL_PERIOD_DAYS;
  const trialProgress = ((totalTrialDays - trialDaysRemaining) / totalTrialDays) * 100;
  
  // Improved percentage-based urgency levels based on days remaining
  const urgencyLevel = trialDaysRemaining <= TRIAL_URGENCY.CRITICAL ? 'critical' :
                      trialDaysRemaining <= TRIAL_URGENCY.WARNING ? 'warning' :
                      trialDaysRemaining <= TRIAL_URGENCY.INFO ? 'info' :
                      'early';
  
  const getUrgencyStyles = () => {
    switch (urgencyLevel) {
      case 'critical':
        return 'bg-gradient-to-r from-destructive to-red-600 border-destructive/50 shadow-lg shadow-destructive/20';
      case 'warning':
        return 'bg-gradient-to-r from-orange-500 to-orange-600 border-orange-400/50 shadow-lg shadow-orange-500/20';
      case 'info':
        return 'bg-gradient-to-r from-primary to-blue-600 border-primary/50 shadow-lg shadow-primary/20';
      case 'early':
      default:
        return 'bg-gradient-to-r from-green-500 to-green-600 border-green-400/50 shadow-lg shadow-green-500/20';
    }
  };

  const handleUpgrade = () => {
    setShowUpgradeModal(true);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    // Store dismissal in localStorage for 24 hours
    if (user?.id) {
      localStorage.setItem(`trial-dismissed-${user.id}`, 'true');
      // Set a timeout to remove the dismissal after 24 hours
      setTimeout(() => {
        localStorage.removeItem(`trial-dismissed-${user.id}`);
      }, 24 * 60 * 60 * 1000);
    }
  };

  // Return null since trial countdown is now shown in the header
  return null;
}