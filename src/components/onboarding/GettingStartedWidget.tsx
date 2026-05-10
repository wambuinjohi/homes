import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { useGettingStarted, GettingStartedStep } from "@/hooks/useGettingStarted";
import { Rocket, Building2, LayoutGrid, Users, CheckCircle2, X } from "lucide-react";

const STEP_CONFIG: Record<
  GettingStartedStep,
  { label: string; route: string; icon: React.ComponentType<{ className?: string }> }
> = {
  add_property: { label: "Add your first property", route: "/dashboard/properties", icon: Building2 },
  add_units: { label: "Create units", route: "/dashboard/units", icon: LayoutGrid },
  add_tenants: { label: "Add tenants", route: "/dashboard/tenants", icon: Users },
};

export function GettingStartedWidget() {
  const navigate = useNavigate();
  const { currentStep, progress, dismissStep } = useGettingStarted();

  // Don't show if completed
  if (progress === 100 || !currentStep) {
    return null;
  }

  const stepConfig = STEP_CONFIG[currentStep];
  const StepIcon = stepConfig.icon;

  const handleContinue = () => {
    navigate(stepConfig.route);
  };

  const handleDismiss = () => {
    dismissStep(currentStep);
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Getting Started</CardTitle>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Setup Progress</span>
            <span className="font-medium text-primary">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Current Step */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-card border">
          <div className="rounded-full bg-primary/10 p-2">
            <StepIcon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Next Step</p>
            <p className="text-sm text-muted-foreground">{stepConfig.label}</p>
          </div>
        </div>

        {/* Continue Button */}
        <Button onClick={handleContinue} className="w-full">
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Continue Setup
        </Button>
      </CardContent>
    </Card>
  );
}
