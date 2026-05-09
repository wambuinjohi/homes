import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, ArrowRight, ArrowLeft, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

// Import onboarding step components
import { WelcomeStep } from "./steps/WelcomeStep";
import { ProfileSetupStep } from "./steps/ProfileSetupStep";
import { AddPropertyStep } from "./steps/AddPropertyStep";
import { AddUnitsStep } from "./steps/AddUnitsStep";
import { PaymentSetupStep } from "./steps/PaymentSetupStep";
import { InviteTenantsStep } from "./steps/InviteTenantsStep";
import { ExploreFeaturesStep } from "./steps/ExploreFeaturesStep";

interface OnboardingStep {
  id: string;
  step_name: string;
  step_order: number;
  title: string;
  description: string | null;
  component_name: string;
  is_required: boolean;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forceShow?: boolean;
}

const stepComponents = {
  WelcomeStep,
  ProfileSetupStep,
  AddPropertyStep,
  AddUnitsStep,
  PaymentSetupStep,
  InviteTenantsStep,
  ExploreFeaturesStep,
};

export function OnboardingWizard({ open, onOpenChange, forceShow = false }: OnboardingWizardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    if (user && open) {
      fetchOnboardingSteps();
    }
  }, [user, open]);

  const fetchOnboardingSteps = async () => {
    try {
      setLoading(true);
      
      // Get onboarding steps
      const { data: onboardingSteps, error: stepsError } = await supabase
        .from('onboarding_steps')
        .select('*')
        .order('step_order');

      if (stepsError) throw stepsError;

      // Get user's progress
      const { data: userProgress, error: progressError } = await supabase
        .from('user_onboarding_progress')
        .select('step_id, status, completed_at')
        .eq('user_id', user?.id);

      if (progressError) throw progressError;

      // Merge steps with user progress
      const progressMap = new Map(userProgress?.map(p => [p.step_id, p]) || []);
      const stepsWithProgress = onboardingSteps?.map(step => ({
        ...step,
        status: (progressMap.get(step.id)?.status || 'pending') as 'pending' | 'in_progress' | 'completed' | 'skipped'
      })) || [];

      setSteps(stepsWithProgress);

      // Find the first incomplete step
      const firstIncompleteIndex = stepsWithProgress.findIndex(
        step => step.status === 'pending' || step.status === 'in_progress'
      );
      setCurrentStepIndex(Math.max(0, firstIncompleteIndex));

      // Check if onboarding is already completed
      const allCompleted = stepsWithProgress.every(step => 
        step.status === 'completed' || step.status === 'skipped' || !step.is_required
      );
      
      if (allCompleted && !forceShow) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error fetching onboarding steps:', error);
      toast({
        title: "Error",
        description: "Failed to load onboarding steps",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateStepStatus = async (stepId: string, status: 'completed' | 'skipped' | 'in_progress') => {
    try {
      const { error } = await supabase
        .from('user_onboarding_progress')
        .upsert({
          user_id: user?.id,
          step_id: stepId,
          status,
          ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
          ...(status === 'in_progress' ? { started_at: new Date().toISOString() } : {}),
        });

      if (error) throw error;

      // Update local state
      setSteps(prev => prev.map(step => 
        step.id === stepId ? { ...step, status } : step
      ));
    } catch (error) {
      console.error('Error updating step status:', error);
      toast({
        title: "Error",
        description: "Failed to update progress",
        variant: "destructive",
      });
    }
  };

  const handleNext = async () => {
    const currentStep = steps[currentStepIndex];
    if (currentStep) {
      await updateStepStatus(currentStep.id, 'completed');
    }

    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      const nextStep = steps[currentStepIndex + 1];
      if (nextStep) {
        await updateStepStatus(nextStep.id, 'in_progress');
      }
    } else {
      await completeOnboarding();
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleSkip = async () => {
    const currentStep = steps[currentStepIndex];
    if (currentStep && !currentStep.is_required) {
      await updateStepStatus(currentStep.id, 'skipped');
      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
      } else {
        await completeOnboarding();
      }
    }
  };

  const completeOnboarding = async () => {
    try {
      setCompleting(true);
      
      // Mark onboarding as completed in subscription
      const { error } = await supabase
        .from('landlord_subscriptions')
        .update({
          onboarding_completed: true,
          onboarding_completed_at: new Date().toISOString()
        })
        .eq('landlord_id', user?.id);

      if (error) throw error;

      toast({
        title: "Onboarding Complete!",
        description: "Welcome to the platform! You're all set to start managing your properties.",
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      toast({
        title: "Error",
        description: "Failed to complete onboarding",
        variant: "destructive",
      });
    } finally {
      setCompleting(false);
    }
  };

  const currentStep = steps[currentStepIndex];
  const StepComponent = currentStep ? stepComponents[currentStep.component_name as keyof typeof stepComponents] : null;
  const progress = ((currentStepIndex + 1) / steps.length) * 100;
  const completedSteps = steps.filter(step => step.status === 'completed').length;

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading onboarding...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl text-primary">Getting Started</DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Header */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Step {currentStepIndex + 1} of {steps.length}
              </div>
              <Badge variant="secondary">
                {completedSteps} of {steps.length} completed
              </Badge>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Steps Navigation */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {steps.map((step, index) => (
              <button
                key={step.id}
                onClick={() => setCurrentStepIndex(index)}
                className={`flex items-center gap-2 p-2 rounded-lg border transition-colors min-w-0 flex-shrink-0 ${
                  index === currentStepIndex
                    ? 'border-primary bg-primary/5 text-primary'
                    : step.status === 'completed'
                    ? 'border-success bg-success/5 text-success'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {step.status === 'completed' ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
                <span className="text-sm font-medium truncate">{step.title}</span>
              </button>
            ))}
          </div>

          {/* Current Step Content */}
          <div className="min-h-[400px]">
            {currentStep && StepComponent ? (
              <StepComponent
                step={currentStep}
                onNext={handleNext}
                onSkip={handleSkip}
                onComplete={() => updateStepStatus(currentStep.id, 'completed')}
              />
            ) : (
              <div className="text-center p-8">
                <p className="text-muted-foreground">Step not found</p>
              </div>
            )}
          </div>

          {/* Navigation Footer */}
          <div className="flex justify-between items-center pt-4 border-t">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStepIndex === 0}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </Button>

            <div className="flex gap-2">
              {currentStep && !currentStep.is_required && (
                <Button
                  variant="ghost"
                  onClick={handleSkip}
                  className="text-muted-foreground"
                >
                  Skip Step
                </Button>
              )}
              <Button
                onClick={handleNext}
                disabled={completing}
                className="flex items-center gap-2"
              >
                {currentStepIndex === steps.length - 1 ? (
                  completing ? 'Completing...' : 'Complete Setup'
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}