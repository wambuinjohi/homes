import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TRIAL_DEFAULTS } from "@/constants/trialDefaults";

interface TrialStatus {
  status: string;
  isActive: boolean;
  isExpired: boolean;
  isSuspended: boolean;
  hasGracePeriod: boolean;
  daysRemaining: number;
  gracePeriodDays?: number;
  totalTrialDays?: number;
  planName?: string;
  planId?: string;
  isSubUserOnLandlordTrial?: boolean;
  landlordName?: string;
}

export function useTrialManagement() {
  const { user } = useAuth();
  const [isTrialUser, setIsTrialUser] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      checkTrialStatus();
    } else {
      // Reset state when no user
      setTrialStatus(null);
      setIsTrialUser(false);
      setTrialDaysRemaining(0);
      setShowOnboarding(false);
    }
  }, [user]);

  const checkTrialStatus = async () => {
    const timestamp = new Date().toISOString();
    console.log(`🔄 [${timestamp}] useTrialManagement: Starting checkTrialStatus for user:`, user?.id);
    
    if (!user) {
      console.log('❌ useTrialManagement: No user found');
      setLoading(false);
      return;
    }

    try {
      // Try to load cached trial status for immediate display
      const cachedStatus = localStorage.getItem(`trial-status-${user.id}`);
      if (cachedStatus) {
        try {
          const parsed = JSON.parse(cachedStatus);
          console.log('📦 useTrialManagement: Loaded cached status:', parsed);
          setTrialStatus(parsed.trialStatus);
          setTrialDaysRemaining(parsed.trialDaysRemaining);
          setIsTrialUser(parsed.isTrialUser);
        } catch (e) {
          console.error('❌ Failed to parse cached trial status:', e);
        }
      }
      console.log('🔍 useTrialManagement: Checking user role...');
      // Check user role first
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      console.log('📝 useTrialManagement: User roles fetched:', userRoles);
      
      const currentUserRole = userRoles?.[0]?.role;
      setUserRole(currentUserRole);
      
      console.log('👤 useTrialManagement: Current user role:', currentUserRole);

      // Check if user is a sub-user and fetch landlord's trial status
      const { data: subUserData } = await supabase
        .from('sub_users')
        .select('landlord_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      let landlordTrialStatus = null;
      let landlordName = null;

      if (subUserData?.landlord_id) {
        console.log('👥 useTrialManagement: User is a sub-user, fetching landlord trial status...');
        
        // Fetch landlord's subscription status
        const { data: landlordSubscription } = await supabase
          .from('landlord_subscriptions')
          .select(`
            *,
            billing_plan:billing_plans(*)
          `)
          .eq('landlord_id', subUserData.landlord_id)
          .in('status', ['active', 'trial'])
          .maybeSingle();

        // Fetch landlord's name
        const { data: landlordProfile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', subUserData.landlord_id)
          .maybeSingle();

        if (landlordProfile) {
          landlordName = `${landlordProfile.first_name} ${landlordProfile.last_name}`;
        }

        if (landlordSubscription && landlordSubscription.status === 'trial') {
          console.log('🎯 useTrialManagement: Sub-user landlord is on trial!');
          const trialEndDate = new Date(landlordSubscription.trial_end_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          trialEndDate.setHours(23, 59, 59, 999);
          
          const daysRemaining = Math.ceil((trialEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          landlordTrialStatus = {
            status: 'trial',
            isActive: daysRemaining > 0,
            isExpired: false,
            isSuspended: false,
            hasGracePeriod: false,
            daysRemaining: Math.max(0, daysRemaining),
            planName: (landlordSubscription.billing_plan as any)?.name || 'Enterprise',
            planId: (landlordSubscription.billing_plan as any)?.id,
            isSubUserOnLandlordTrial: true,
            landlordName: landlordName
          };

          // For sub-users, use landlord's trial status
          setTrialStatus(landlordTrialStatus);
          setTrialDaysRemaining(Math.max(0, daysRemaining));
          setIsTrialUser(true);
          setLoading(false);
          return; // Exit early for sub-users on landlord trial
        }
      }

      console.log('🎯 useTrialManagement: Fetching trial status...');
      // Fetch subscription data directly
      console.log('🔍 useTrialManagement: Fetching subscription data with maybeSingle...');
      const { data: subscription, error: subscriptionError } = await supabase
        .from('landlord_subscriptions')
        .select(`
          *,
          billing_plan:billing_plans(*)
        `)
        .eq('landlord_id', user.id)
        .maybeSingle();

      console.log('💳 useTrialManagement: Subscription data:', subscription);
      console.log('❗ useTrialManagement: Subscription error:', subscriptionError);

      // Fallback: Always try to fetch basic subscription data if joined query failed
      let basicSubscription = null;
      if (!subscription && subscriptionError) {
        console.log('🔄 useTrialManagement: Joined query failed, fetching basic data...');
        const { data: basic } = await supabase
          .from('landlord_subscriptions')
          .select('*')
          .eq('landlord_id', user.id)
          .maybeSingle();
        basicSubscription = basic;
        console.log('🔧 useTrialManagement: Basic subscription fallback:', basicSubscription);
      }

      // Use subscription or fallback to basic subscription
      const effectiveSubscription = subscription || basicSubscription;

      if (!effectiveSubscription) {
        console.log('❌ useTrialManagement: No subscription found at all');
      } else {
        console.log('✅ useTrialManagement: Processing subscription data...');
        const actualStatus = effectiveSubscription.status;
        const isTrialRelated = ['trial', 'trial_expired', 'suspended'].includes(actualStatus);
        
        console.log('🏷️ useTrialManagement: Processed status info:', {
          actualStatus,
          isTrialRelated,
          subscriptionStatus: effectiveSubscription.status
        });
        
        setIsTrialUser(isTrialRelated);
        
        let daysRemaining = 0;
        let gracePeriodDays = 0;
        let totalTrialDays = TRIAL_DEFAULTS.TRIAL_PERIOD_DAYS;
        
        if (effectiveSubscription.trial_end_date) {
          const trialEndDate = new Date(effectiveSubscription.trial_end_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          trialEndDate.setHours(23, 59, 59, 999);
          
          daysRemaining = Math.ceil((trialEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          console.log('📅 useTrialManagement: Date calculations:', {
            trialEndDate: trialEndDate.toISOString(),
            today: today.toISOString(),
            daysRemaining
          });
          
          // Calculate grace period
          if (actualStatus === 'trial_expired') {
            const gracePeriodEnd = new Date(trialEndDate.getTime() + (TRIAL_DEFAULTS.GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000));
            gracePeriodDays = Math.max(0, Math.ceil((gracePeriodEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
          }

          // Calculate total trial days
          if (effectiveSubscription.trial_start_date) {
            totalTrialDays = Math.ceil((trialEndDate.getTime() - new Date(effectiveSubscription.trial_start_date).getTime()) / (1000 * 60 * 60 * 24));
          }
        }
        
        setTrialDaysRemaining(Math.max(0, daysRemaining));

        const finalTrialStatus = {
          status: actualStatus,
          isActive: actualStatus === 'trial' && daysRemaining > 0,
          isExpired: actualStatus === 'trial_expired',
          isSuspended: actualStatus === 'suspended',
          hasGracePeriod: actualStatus === 'trial_expired' && gracePeriodDays > 0,
          daysRemaining: Math.max(0, daysRemaining),
          gracePeriodDays: gracePeriodDays,
          totalTrialDays: totalTrialDays,
          planName: (subscription?.billing_plan as any)?.name || 'Free Trial',
          planId: (subscription?.billing_plan as any)?.id
        };

        console.log('🎯 useTrialManagement: Setting final trial status:', finalTrialStatus);
        setTrialStatus(finalTrialStatus);

        // Cache the trial status
        try {
          localStorage.setItem(`trial-status-${user.id}`, JSON.stringify({
            trialStatus: finalTrialStatus,
            trialDaysRemaining: Math.max(0, daysRemaining),
            isTrialUser: isTrialRelated,
            timestamp: new Date().toISOString()
          }));
        } catch (e) {
          console.error('❌ Failed to cache trial status:', e);
        }

        // Show onboarding if not completed
        if (!effectiveSubscription.onboarding_completed) {
          setShowOnboarding(true);
        }
      }
    } catch (error) {
      try {
        console.error('❌ useTrialManagement: Error checking trial status:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      } catch (e) {
        console.error('❌ useTrialManagement: Error checking trial status (unserializable):', error);
      }
    } finally {
      console.log('🏁 useTrialManagement: Finished, setting loading to false');
      setLoading(false);
    }
  };

  const trackFeatureUsage = async (featureName: string) => {
    if (!user || !isTrialUser) return;

    try {
      // Update usage data in subscription record (trial_usage_data field)
      const { data: currentSub } = await supabase
        .from('landlord_subscriptions')
        .select('trial_usage_data')
        .eq('landlord_id', user.id)
        .maybeSingle();

      const usageData = currentSub?.trial_usage_data as any || {};
      const featureUsage = usageData[featureName] || { count: 0, last_used: null };

      await supabase
        .from('landlord_subscriptions')
        .update({
          trial_usage_data: {
            ...usageData,
            [featureName]: {
              count: featureUsage.count + 1,
              last_used: new Date().toISOString(),
            }
          }
        })
        .eq('landlord_id', user.id);
    } catch (error) {
      console.error('Error tracking feature usage:', error);
    }
  };

  const checkFeatureAccess = async (featureName: string, currentCount: number = 1): Promise<boolean> => {
    if (!user) return false;
    
    try {
      // Simplified feature access check - during trial, allow all features
      const { data: subscription } = await supabase
        .from('landlord_subscriptions')
        .select('status, trial_end_date')
        .eq('landlord_id', user.id)
        .maybeSingle();

      if (!subscription) return false;

      // If trial is active, allow access
      if (subscription.status === 'trial') {
        const trialEndDate = subscription.trial_end_date ? new Date(subscription.trial_end_date) : null;
        if (trialEndDate && trialEndDate > new Date()) {
          return true; // Full access during trial
        }
      }

      // For active subscriptions, allow access
      if (subscription.status === 'active') {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking feature access:', error);
      return false;
    }
  };

  return {
    isTrialUser,
    showOnboarding,
    trialDaysRemaining,
    trialStatus,
    loading,
    userRole,
    setShowOnboarding,
    trackFeatureUsage,
    checkFeatureAccess,
    refreshTrialStatus: checkTrialStatus,
  };
}
