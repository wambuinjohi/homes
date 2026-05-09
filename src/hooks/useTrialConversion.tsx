import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TrialConversion {
  totalTrialUsers: number;
  convertedUsers: number;
  conversionRate: number;
  avgTrialDuration: number;
  conversionsByPlan: Array<{
    planName: string;
    conversions: number;
    rate: number;
  }>;
}

export function useTrialConversion() {
  const [conversion, setConversion] = useState<TrialConversion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversionData = async () => {
    try {
      setLoading(true);

      // Get trial users
      const { data: trialUsers } = await supabase
        .from('landlord_subscriptions')
        .select('*')
        .in('status', ['trial', 'trial_expired', 'suspended']);

      // Get converted users (active subscriptions)
      const { data: activeUsers } = await supabase
        .from('landlord_subscriptions')
        .select('*')
        .eq('status', 'active');

      // Get billing plans for conversion breakdown
      const { data: billingPlans } = await supabase
        .from('billing_plans')
        .select('*')
        .eq('is_active', true);

      const totalTrials = trialUsers?.length || 0;
      const totalConverted = activeUsers?.length || 0;
      const conversionRate = totalTrials > 0 ? (totalConverted / totalTrials) * 100 : 0;

      // Calculate average trial duration (mock for now)
      const avgTrialDuration = 18; // days

      // Calculate conversions by plan
      const conversionsByPlan = billingPlans?.map(plan => ({
        planName: plan.name,
        conversions: Math.floor(Math.random() * 20) + 5, // Mock data
        rate: Math.floor(Math.random() * 30) + 10 // Mock conversion rate
      })) || [];

      setConversion({
        totalTrialUsers: totalTrials,
        convertedUsers: totalConverted,
        conversionRate,
        avgTrialDuration,
        conversionsByPlan
      });
    } catch (err) {
      console.error('Error fetching trial conversion data:', err);
      setError('Failed to fetch trial conversion data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversionData();
  }, []);

  return {
    conversion,
    loading,
    error,
    refetch: fetchConversionData
  };
}