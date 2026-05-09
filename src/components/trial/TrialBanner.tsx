import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Calendar, Crown, Zap, ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, differenceInDays } from "date-fns";
import { TrialStatusBanner } from "@/components/trial/TrialStatusBanner";

interface TrialInfo {
  daysRemaining: number;
  totalDays: number;
  featuresEnabled: string[];
  limitations: Record<string, number>;
  isTrialActive: boolean;
}

export function TrialBanner() {
  const { user } = useAuth();
  const [trialInfo, setTrialInfo] = useState<TrialInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTrialInfo();
    }
  }, [user]);

  // First show the new status banner for critical states
  const statusBannerComponent = <TrialStatusBanner />;

  const fetchTrialInfo = async () => {
    try {
      const { data: subscription } = await supabase
        .from('landlord_subscriptions')
        .select(`
          *,
          billing_plans (
            name,
            price,
            currency
          )
        `)
        .eq('landlord_id', user?.id)
        .single();

      if (subscription && subscription.status === 'trial') {
        const trialEndDate = new Date(subscription.trial_end_date);
        const today = new Date();
        const daysRemaining = Math.max(0, differenceInDays(trialEndDate, today));
        const trialStartDate = new Date(subscription.trial_start_date);
        const totalDays = differenceInDays(trialEndDate, trialStartDate);

        setTrialInfo({
          daysRemaining,
          totalDays,
          featuresEnabled: [],
          limitations: {},
          isTrialActive: daysRemaining > 0,
        });
      }
    } catch (error) {
      console.error('Error fetching trial info:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => {
    // Navigate to upgrade page
    window.location.href = '/upgrade';
  };

  if (loading || !trialInfo) return statusBannerComponent;

  const progressPercentage = ((trialInfo.totalDays - trialInfo.daysRemaining) / trialInfo.totalDays) * 100;

  return (
    <>
      {statusBannerComponent}
      
      {trialInfo.isTrialActive && (
        <Card className="mb-6 border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-full">
                  <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100">🎉 Enjoying Full Enterprise Access</h3>
                    <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100">
                      {trialInfo.daysRemaining} days left
                    </Badge>
                  </div>
                  <p className="text-sm text-purple-800 dark:text-purple-200 mb-3">
                    You're experiencing all premium features with no limits. Keep this access after your trial ends!
                  </p>
                  
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Trial Progress</span>
                        <span>{trialInfo.totalDays - trialInfo.daysRemaining} of {trialInfo.totalDays} days used</span>
                      </div>
                      <Progress value={progressPercentage} className="h-2" />
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Expires {format(new Date(Date.now() + trialInfo.daysRemaining * 24 * 60 * 60 * 1000), 'MMM dd')}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <div className="text-xs text-purple-700 dark:text-purple-300 font-semibold">Premium features you're enjoying:</div>
                    <Badge variant="outline" className="text-xs border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-100">
                      Unlimited Units
                    </Badge>
                    <Badge variant="outline" className="text-xs border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-100">
                      Advanced Reports
                    </Badge>
                    <Badge variant="outline" className="text-xs border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-100">
                      Team Management
                    </Badge>
                    <Badge variant="outline" className="text-xs border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-100">
                      API Access
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <Button onClick={handleUpgrade} className="bg-purple-600 hover:bg-purple-700 text-white">
                  <Crown className="h-4 w-4 mr-2" />
                  Keep Premium Access
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <div className="text-xs text-center text-purple-700 dark:text-purple-300">
                  Continue with all features
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}