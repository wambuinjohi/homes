import { useState, useEffect } from "react";
import { useTrialManagement } from "@/hooks/useTrialManagement";

interface FeatureAccess {
  canAccess: boolean;
  isLimited: boolean;
  limitExceeded: boolean;
  currentUsage?: number;
  limit?: number;
  remainingUsage?: number;
}

export function useFeatureAccess(featureName: string, currentCount: number = 1) {
  const { trialStatus, checkFeatureAccess, loading: trialLoading } = useTrialManagement();
  const [access, setAccess] = useState<FeatureAccess>({
    canAccess: false,
    isLimited: false,
    limitExceeded: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      if (trialLoading) return;
      
      setLoading(true);
      
      try {
        // Always allow access for non-trial users or active subscriptions
        if (!trialStatus || (!trialStatus.isActive && !trialStatus.isExpired)) {
          setAccess({
            canAccess: true,
            isLimited: false,
            limitExceeded: false
          });
          return;
        }

        // CRITICAL: Trial users get FULL PREMIUM ACCESS
        if (trialStatus.isActive) {
          setAccess({
            canAccess: true,
            isLimited: false,
            limitExceeded: false,
            currentUsage: currentCount
          });
          return;
        }

        // Block all access for suspended accounts
        if (trialStatus.isSuspended) {
          setAccess({
            canAccess: false,
            isLimited: true,
            limitExceeded: true
          });
          return;
        }

        // For expired trials with grace period, check actual plan features
        if (trialStatus.isExpired && trialStatus.hasGracePeriod) {
          const canAccess = await checkFeatureAccess(featureName, currentCount);
          
          setAccess({
            canAccess,
            isLimited: true,
            limitExceeded: !canAccess,
            currentUsage: currentCount
          });
        } else {
          // Trial expired, no grace period
          setAccess({
            canAccess: false,
            isLimited: true,
            limitExceeded: true
          });
        }
      } catch (error) {
        console.error('Error checking feature access:', error);
        setAccess({
          canAccess: false,
          isLimited: true,
          limitExceeded: true
        });
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [featureName, currentCount, trialStatus, checkFeatureAccess, trialLoading]);

  return {
    ...access,
    loading,
    trialStatus
  };
}