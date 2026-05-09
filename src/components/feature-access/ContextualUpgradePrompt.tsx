import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, ArrowRight, X, Sparkles } from "lucide-react";
import { usePlanFeatureAccess, type Feature } from "@/hooks/usePlanFeatureAccess";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { usePlatformAnalytics } from "@/hooks/usePlatformAnalytics";

interface ContextualUpgradePromptProps {
  feature: Feature;
  title?: string;
  description?: string;
  benefits?: string[];
  dismissible?: boolean;
  variant?: "card" | "banner" | "inline";
  size?: "sm" | "default" | "lg";
}

export function ContextualUpgradePrompt({
  feature,
  title,
  description,
  benefits = [],
  dismissible = true,
  variant = "card",
  size = "default"
}: ContextualUpgradePromptProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { allowed, plan_name, loading } = usePlanFeatureAccess(feature);
  const { analytics } = usePlatformAnalytics();

  // Don't show if user has access or loading
  if (allowed || loading || isDismissed) {
    return null;
  }

  const handleUpgradeClick = () => {
    console.log('Upgrade prompt click:', feature, variant);
    setShowUpgradeModal(true);
  };

  const handleDismiss = () => {
    console.log('Upgrade prompt dismiss:', feature, variant);
    setIsDismissed(true);
  };

  const defaultTitle = title || `Unlock ${feature.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
  const defaultDescription = description || `Upgrade your plan to access this premium feature and grow your property management business.`;

  if (variant === "banner") {
    return (
      <>
        <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Crown className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-primary">{defaultTitle}</h3>
                <p className="text-sm text-muted-foreground">{defaultDescription}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleUpgradeClick}
                className="bg-primary hover:bg-primary/90"
              >
                <Crown className="h-4 w-4 mr-2" />
                Upgrade
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              {dismissible && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
        <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
      </>
    );
  }

  if (variant === "inline") {
    return (
      <>
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{defaultTitle}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {plan_name || 'Current Plan'}
            </Badge>
            <Button size="sm" variant="outline" onClick={handleUpgradeClick}>
              Upgrade
            </Button>
          </div>
        </div>
        <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
      </>
    );
  }

  // Default card variant
  const cardSize = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-md";

  return (
    <>
      <Card className={`${cardSize} mx-auto border-primary/20 bg-gradient-to-br from-primary/5 to-transparent`}>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Crown className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {defaultTitle}
                  <Sparkles className="h-4 w-4 text-amber-500" />
                </CardTitle>
                <CardDescription className="mt-1">
                  {defaultDescription}
                </CardDescription>
              </div>
            </div>
            {dismissible && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {benefits.length > 0 && (
            <ul className="space-y-2">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <div className="h-1.5 w-1.5 bg-primary rounded-full" />
                  {benefit}
                </li>
              ))}
            </ul>
          )}
          
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Current:</span>
              <Badge variant="outline">{plan_name || 'Free Plan'}</Badge>
            </div>
            <Button
              onClick={handleUpgradeClick}
              className="bg-primary hover:bg-primary/90"
            >
              <Crown className="h-4 w-4 mr-2" />
              Upgrade Plan
            </Button>
          </div>
        </CardContent>
      </Card>
      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </>
  );
}