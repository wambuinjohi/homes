import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, ArrowRight, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PlanUpgradePromptProps {
  currentPlan?: string;
  requiredFeature?: string;
  title?: string;
  description?: string;
  benefits?: string[];
  className?: string;
}

export function PlanUpgradePrompt({
  currentPlan,
  requiredFeature,
  title = "Upgrade Required",
  description = "This feature requires a higher plan to access",
  benefits = ["Access premium features", "Unlock full functionality", "Priority support"],
  className
}: PlanUpgradePromptProps) {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    if (requiredFeature === 'enterprise') {
      window.open('/support?topic=enterprise', '_blank');
    } else {
      navigate("/upgrade");
    }
  };

  return (
    <Card className={`border-2 border-dashed border-primary/20 ${className}`}>
      <CardHeader className="text-center pb-4">
        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
          <Crown className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
        {currentPlan && (
          <Badge variant="outline" className="self-center mt-2">
            Current: {currentPlan}
          </Badge>
        )}
      </CardHeader>
      
      <CardContent className="text-center space-y-4">
        <div className="space-y-2">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span>{benefit}</span>
            </div>
          ))}
        </div>
        
        <Button onClick={handleUpgrade} className="w-full">
          <Crown className="mr-2 h-4 w-4" />
          {requiredFeature === 'enterprise' ? 'Contact Us' : 'Upgrade Plan'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>

        <p className="text-xs text-muted-foreground">
          Upgrade anytime • Cancel anytime • Instant access
        </p>
      </CardContent>
    </Card>
  );
}