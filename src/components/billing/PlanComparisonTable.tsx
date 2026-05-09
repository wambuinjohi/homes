import React from "react";
import { Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useMultiplePlanFeatures } from "@/hooks/useBillingPlanFeatures";
import * as LucideIcons from "lucide-react";

interface BillingPlan {
  id: string;
  name: string;
  price: number;
  billing_cycle: string;
  currency: string;
  description?: string;
  is_recommended?: boolean;
}

interface PlanComparisonTableProps {
  plans: BillingPlan[];
  currentPlanId?: string;
  onSelectPlan: (planId: string) => void;
}

const CATEGORY_LABELS = {
  core: { label: "Core Features", icon: "Layers", color: "text-blue-500" },
  advanced: { label: "Advanced Features", icon: "Zap", color: "text-green-500" },
  premium: { label: "Premium Features", icon: "Star", color: "text-purple-500" },
  enterprise: { label: "Enterprise Features", icon: "Crown", color: "text-amber-500" }
};

export function PlanComparisonTable({ plans, currentPlanId, onSelectPlan }: PlanComparisonTableProps) {
  const planIds = plans.map(p => p.id);
  const { data: planFeatures, isLoading } = useMultiplePlanFeatures(planIds);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  if (!planFeatures) return null;

  // Get all unique features across all plans
  const allFeatures = new Map<string, {
    feature_key: string;
    display_name: string;
    description: string | null;
    category: string;
    icon_name: string | null;
  }>();

  Object.values(planFeatures).forEach(categorized => {
    Object.values(categorized).flat().forEach(feature => {
      if (!allFeatures.has(feature.feature_key)) {
        allFeatures.set(feature.feature_key, feature);
      }
    });
  });

  const categories = ['core', 'advanced', 'premium', 'enterprise'] as const;

  const getIcon = (iconName: string | null) => {
    if (!iconName) return null;
    const Icon = (LucideIcons as any)[iconName];
    return Icon ? <Icon className="h-4 w-4" /> : null;
  };

  return (
    <div className="space-y-6">
      {/* Plan Headers */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {plans.map(plan => {
          const isCurrentPlan = plan.id === currentPlanId;
          return (
            <Card key={plan.id} className={`p-6 ${plan.is_recommended ? 'border-primary shadow-lg' : ''}`}>
              <div className="space-y-4">
                {plan.is_recommended && (
                  <Badge className="mb-2">Recommended</Badge>
                )}
                <h3 className="text-2xl font-bold">{plan.name}</h3>
                <div className="text-3xl font-bold">
                  {plan.currency} {plan.price}
                  <span className="text-sm font-normal text-muted-foreground">/{plan.billing_cycle}</span>
                </div>
                {plan.description && (
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                )}
                <Button
                  onClick={() => onSelectPlan(plan.id)}
                  disabled={isCurrentPlan}
                  variant={plan.is_recommended ? "default" : "outline"}
                  className="w-full"
                >
                  {isCurrentPlan ? "Current Plan" : "Select Plan"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Feature Comparison */}
      <div className="space-y-8">
        {categories.map(category => {
          const categoryInfo = CATEGORY_LABELS[category];
          const CategoryIcon = (LucideIcons as any)[categoryInfo.icon];
          
          // Get features for this category
          const categoryFeatures = Array.from(allFeatures.values())
            .filter(f => f.category === category);

          if (categoryFeatures.length === 0) return null;

          return (
            <div key={category} className="space-y-4">
              <div className="flex items-center gap-2">
                <CategoryIcon className={`h-5 w-5 ${categoryInfo.color}`} />
                <h3 className="text-lg font-semibold">{categoryInfo.label}</h3>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-4 font-medium">Feature</th>
                      {plans.map(plan => (
                        <th key={plan.id} className="text-center p-4 font-medium">
                          {plan.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {categoryFeatures.map(feature => (
                      <tr key={feature.feature_key} className="border-t hover:bg-muted/30">
                        <td className="p-4">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-2 cursor-help">
                                  {getIcon(feature.icon_name)}
                                  <span>{feature.display_name}</span>
                                </div>
                              </TooltipTrigger>
                              {feature.description && (
                                <TooltipContent>
                                  <p className="max-w-xs">{feature.description}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                        {plans.map(plan => {
                          const planFeature = planFeatures[plan.id];
                          const isEnabled = planFeature && 
                            Object.values(planFeature).flat()
                              .find(f => f.feature_key === feature.feature_key)?.is_enabled;

                          return (
                            <td key={plan.id} className="p-4 text-center">
                              {isEnabled ? (
                                <Check className="h-5 w-5 text-green-500 mx-auto" />
                              ) : (
                                <X className="h-5 w-5 text-muted-foreground/30 mx-auto" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
