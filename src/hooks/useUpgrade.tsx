import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface BillingPlan {
  id: string;
  name: string;
  price: number;
  billing_cycle: string;
  billing_model?: 'percentage' | 'fixed_per_unit' | 'tiered';
  percentage_rate?: number;
  fixed_amount_per_unit?: number;
  tier_pricing?: any;
  currency: string;
}

interface UseUpgradeResult {
  upgradeToPlan: (planId: string) => Promise<void>;
  isProcessing: boolean;
  error: string | null;
}

export function useUpgrade(): UseUpgradeResult {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upgradeToPlan = async (planId: string) => {
    if (!user) {
      setError("User not authenticated");
      toast({
        title: "Error",
        description: "You must be logged in to upgrade",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      console.log('🚀 Starting upgrade process:', { planId, userId: user.id });

      // Fetch the selected plan
      const { data: plan, error: planError } = await supabase
        .from('billing_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (planError || !plan) {
        throw new Error('Failed to fetch billing plan details');
      }

      console.log('📋 Plan details:', plan);

      // Calculate next billing date (end of current month)
      const now = new Date();
      const nextBillingDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month
      
      // All plans activate immediately with end-of-month billing
      console.log('✅ Activating plan immediately - billing at end of month');

      const { data, error: activateError } = await supabase.functions.invoke(
        'activate-billing-plan',
        {
          body: { 
            planId,
            nextBillingDate: nextBillingDate.toISOString()
          },
        }
      );

      if (activateError) {
        console.error('❌ Activation error:', activateError);
        throw new Error(activateError.message || 'Failed to activate plan');
      }

      if (!data || data.error) {
        console.error('❌ Activation failed:', data?.error);
        throw new Error(data?.error || 'Failed to activate plan');
      }

      console.log('✅ Plan activated:', data);

      // Build success message based on billing model
      let billingMessage = '';
      if (plan.billing_model === 'percentage' && plan.percentage_rate) {
        billingMessage = `Your first billing will be at the end of this month based on ${plan.percentage_rate}% of rent collected.`;
      } else if (plan.billing_model === 'fixed_per_unit' && plan.fixed_amount_per_unit) {
        billingMessage = `Your first billing will be at the end of this month based on your units (${plan.currency} ${plan.fixed_amount_per_unit} per unit).`;
      } else if (plan.billing_model === 'tiered') {
        billingMessage = `Your first billing will be at the end of this month based on your units and tier pricing.`;
      } else {
        billingMessage = `Your first billing will be at the end of this month.`;
      }

      toast({
        title: "Plan Activated!",
        description: `You've been upgraded to ${plan.name}. ${billingMessage}`,
      });

      // Log user activity
      try {
        await supabase.rpc('log_user_activity', {
          _user_id: user.id,
          _action: 'plan_upgrade',
          _details: { 
            plan_id: planId, 
            plan_name: plan.name, 
            billing_model: plan.billing_model,
            next_billing_date: nextBillingDate.toISOString()
          },
        });
      } catch (logError) {
        console.warn('Failed to log activity:', logError);
      }

      // Redirect to dashboard
      setTimeout(() => navigate('/'), 1500);

    } catch (err: any) {
      console.error('❌ Upgrade error:', err);
      const errorMessage = err.message || 'Failed to process upgrade';
      setError(errorMessage);
      toast({
        title: "Upgrade Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    upgradeToPlan,
    isProcessing,
    error,
  };
}
