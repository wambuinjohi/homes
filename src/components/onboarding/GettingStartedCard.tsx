import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, CheckCircle2, LucideIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import confetti from "canvas-confetti";

interface GettingStartedCardProps {
  stepId: string;
  title: string;
  description: string;
  icon: LucideIcon;
  actionLabel: string;
  onAction: () => void;
  onDismiss: () => void;
  currentStep: number;
  totalSteps: number;
  className?: string;
}

export function GettingStartedCard({
  stepId,
  title,
  description,
  icon: Icon,
  actionLabel,
  onAction,
  onDismiss,
  currentStep,
  totalSteps,
  className = "",
}: GettingStartedCardProps) {
  const progressPercent = (currentStep / totalSteps) * 100;

  const handleAction = () => {
    onAction();
    // Trigger confetti on step completion
    if (currentStep === totalSteps) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  };

  return (
    <Card className={`border-primary/20 bg-gradient-to-br from-primary/5 to-transparent ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 -mt-1 -mr-1"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Step {currentStep} of {totalSteps}
            </span>
            <span className="font-medium text-primary">{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Action Button */}
        <Button onClick={handleAction} className="w-full" size="lg">
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
