import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Check, Sparkles, Building2, Crown, Zap, Calculator, Users, Home, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLandingSettings } from "@/hooks/useLandingSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface BillingPlan {
  id: string;
  name: string;
  price: number;
  billing_cycle: string;
  billing_model: string | null;
  percentage_rate: number | null;
  fixed_amount_per_unit: number | null;
  tier_pricing: any;
  currency: string | null;
  description: string | null;
  features: any;
  max_properties: number | null;
  max_units: number | null;
  is_custom: boolean | null;
  sms_credits_included: number | null;
  plan_category: string | null;
  min_units: number | null;
  max_units_display: string | null;
  display_order: number | null;
  is_popular: boolean | null;
  competitive_note: string | null;
  yearly_discount_percent: number | null;
}

const FEATURE_DISPLAY_MAP: Record<string, string> = {
  'property_management': 'Property Management',
  'tenant_management': 'Tenant Management',
  'basic_invoicing': 'Basic Invoicing',
  'payment_tracking': 'Payment Tracking',
  'maintenance_requests': 'Maintenance Requests',
  'tenant_portal': 'Tenant Portal',
  'document_storage': 'Document Storage',
  'lease_management': 'Lease Management',
  'analytics_reports': 'Analytics & Reports',
  'custom_branding': 'Custom Branding',
  'api_access': 'API Access',
  'priority_support': 'Priority Support',
  'sub_users': 'Team Members',
  'bulk_messaging': 'Bulk Messaging',
  'automated_reminders': 'Automated Reminders',
  'mpesa_integration': 'M-Pesa Integration',
  'dedicated_support': 'Dedicated Support',
  'white_label': 'White Label',
};

function getPlanIcon(planName: string, category: string) {
  const name = planName.toLowerCase();
  if (name.includes('enterprise') || name.includes('corporate') || name.includes('custom')) {
    return Crown;
  } else if (name.includes('premium') || name.includes('scale')) {
    return Sparkles;
  } else if (name.includes('growth') || name.includes('standard')) {
    return TrendingUp;
  } else if (category === 'agency') {
    return Users;
  }
  return Home;
}

function formatPrice(plan: BillingPlan): string {
  if (plan.is_custom) {
    return "Custom";
  }
  
  if (plan.billing_model === 'percentage' && plan.percentage_rate) {
    return `${plan.percentage_rate}%`;
  }
  
  if (plan.billing_model === 'fixed_per_unit' && plan.fixed_amount_per_unit) {
    return `KES ${plan.fixed_amount_per_unit}`;
  }
  
  if (plan.price === 0) {
    return "Free";
  }
  
  return `KES ${plan.price.toLocaleString()}`;
}

function getPriceSubtext(plan: BillingPlan, trialDays: number): string {
  if (plan.is_custom) {
    return "Contact us for pricing";
  }
  
  if (plan.billing_model === 'percentage') {
    return "of rent collected";
  }
  
  if (plan.billing_model === 'fixed_per_unit') {
    return "per unit / month";
  }
  
  if (plan.price === 0) {
    return `${trialDays} days trial`;
  }
  
  return `/ ${plan.billing_cycle}`;
}

function getDisplayFeatures(features: any): string[] {
  if (!features) return [];
  
  if (Array.isArray(features)) {
    return features.map(f => FEATURE_DISPLAY_MAP[f] || f).slice(0, 6);
  }
  
  if (typeof features === 'object') {
    return Object.entries(features)
      .filter(([_, value]) => value === true)
      .map(([key]) => FEATURE_DISPLAY_MAP[key] || key)
      .slice(0, 6);
  }
  
  return [];
}

function PlanCard({ plan, trialDays, billingCycle }: { plan: BillingPlan; trialDays: number; billingCycle: 'monthly' | 'annual' }) {
  const Icon = getPlanIcon(plan.name, plan.plan_category || 'landlord');
  const features = getDisplayFeatures(plan.features);
  const isPopular = plan.is_popular;
  
  // Get tier price (the base plan price) and per-unit price
  const tierPrice = plan.price;
  const perUnitPrice = plan.fixed_amount_per_unit;
  const yearlyDiscount = plan.yearly_discount_percent || 15;
  
  // Calculate annual pricing
  const isAnnual = billingCycle === 'annual';
  const annualTotal = tierPrice * 12 * (1 - yearlyDiscount / 100);
  const monthlyEquivalent = Math.round(annualTotal / 12);
  const displayPrice = isAnnual ? monthlyEquivalent : tierPrice;
  
  // Annual per-unit pricing
  const annualPerUnitTotal = perUnitPrice ? perUnitPrice * 12 * (1 - yearlyDiscount / 100) : 0;
  const monthlyPerUnitEquivalent = perUnitPrice ? Math.round(annualPerUnitTotal / 12) : 0;
  const displayPerUnitPrice = isAnnual ? monthlyPerUnitEquivalent : perUnitPrice;
  
  // Check if annual pricing applies (not for custom or percentage-based plans)
  const showAnnualPricing = !plan.is_custom && plan.billing_model !== 'percentage' && tierPrice > 0;
  
  return (
    <div 
      className={`relative bg-card rounded-2xl p-6 border transition-all duration-300 hover:shadow-lg flex flex-col ${
        isPopular 
          ? 'border-primary shadow-lg ring-2 ring-primary/20' 
          : 'border-border hover:border-primary/30'
      }`}
    >
      {/* Popular Badge */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
            <Sparkles className="w-3 h-3" />
            Most Popular
          </span>
        </div>
      )}
      
      
      {/* Plan Header */}
      <div className="mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
          isPopular ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
        }`}>
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-1">
          {plan.name}
        </h3>
        {plan.description && (
          <p className="text-sm text-muted-foreground">
            {plan.description}
          </p>
        )}
      </div>
      
      {/* Unit Range */}
      {plan.max_units_display && (
        <div className="mb-4">
          <Badge variant="outline" className="text-xs">
            {plan.max_units_display}
          </Badge>
        </div>
      )}
      
      {/* Tier Price - Primary Display */}
      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-foreground">
            {plan.is_custom ? "Custom" : tierPrice === 0 ? "Free" : `KES ${displayPrice.toLocaleString()}`}
          </span>
          {!plan.is_custom && tierPrice > 0 && (
            <span className="text-sm text-muted-foreground">/ month</span>
          )}
        </div>
        {/* Annual billing subtext */}
        {showAnnualPricing && isAnnual && (
          <div className="mt-1 space-y-0.5">
            <span className="text-sm text-success font-medium">Save {yearlyDiscount}%</span>
            <p className="text-xs text-muted-foreground">
              KES {Math.round(annualTotal).toLocaleString()} billed annually
            </p>
          </div>
        )}
        {plan.is_custom && (
          <span className="text-sm text-muted-foreground">Contact us for pricing</span>
        )}
        {tierPrice === 0 && !plan.is_custom && (
          <span className="text-sm text-muted-foreground">{trialDays} days trial</span>
        )}
      </div>
      
      {/* Features */}
      <ul className="space-y-3 mb-6 flex-grow">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2">
            <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
            <span className="text-sm text-foreground">{feature}</span>
          </li>
        ))}
        {plan.sms_credits_included && plan.sms_credits_included > 0 && (
          <li className="flex items-start gap-2">
            <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
            <span className="text-sm text-foreground">
              {plan.sms_credits_included.toLocaleString()} SMS credits included
            </span>
          </li>
        )}
        {plan.is_custom && plan.name.toLowerCase().includes('enterprise') && (
          <li className="flex items-start gap-2">
            <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
            <span className="text-sm text-foreground">SMS credits negotiated</span>
          </li>
        )}
        {plan.is_custom && plan.name.toLowerCase().includes('corporate') && (
          <li className="flex items-start gap-2">
            <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
            <span className="text-sm text-foreground">SMS credits negotiated</span>
          </li>
        )}
      </ul>
      
      {/* Per Unit Price - Bottom Display */}
      {displayPerUnitPrice && displayPerUnitPrice > 0 && !plan.is_custom && (
        <div className="mb-4 pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">KES {displayPerUnitPrice}</span> per unit / month
          </p>
          {isAnnual && perUnitPrice && (
            <p className="text-xs text-muted-foreground">
              (was KES {perUnitPrice} per unit)
            </p>
          )}
        </div>
      )}
      
      {/* CTA Button */}
      <Link to="/auth" className="block mt-auto">
        <Button 
          className={`w-full ${
            isPopular 
              ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
              : plan.is_custom 
                ? 'bg-accent text-accent-foreground hover:bg-accent/90'
                : ''
          }`}
          variant={isPopular || plan.is_custom ? "default" : "outline"}
        >
          {plan.is_custom ? 'Contact Sales' : 'Start Free Trial'}
        </Button>
      </Link>
    </div>
  );
}

export function PricingSection() {
  const { trialDays } = useLandingSettings();
  const [activeTab, setActiveTab] = useState<string>("landlord");
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  
  const { data: plans, isLoading, error } = useQuery({
    queryKey: ['landing-billing-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return (data as BillingPlan[]).filter(p => !p.name.toLowerCase().includes('free trial'));
    },
    staleTime: 1000 * 60 * 5,
  });

  // Filter plans by category
  const landlordPlans = plans?.filter(p => 
    p.plan_category === 'landlord' || p.plan_category === 'both'
  ) || [];
  
  const agencyPlans = plans?.filter(p => 
    p.plan_category === 'agency' || p.plan_category === 'both'
  ) || [];

  // Check if we have category-specific plans
  const hasCategorizedPlans = plans?.some(p => p.plan_category === 'landlord' || p.plan_category === 'agency');

  return (
    <section id="pricing" className="py-20 bg-secondary/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-8">
          <span className="inline-block px-4 py-1 rounded-full bg-success/10 text-success text-sm font-medium mb-4">
            Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Affordable & Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground mb-6">
            Choose the plan that fits your portfolio. Up to 600% cheaper than competitors.
          </p>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-card border border-border">
            <Label 
              htmlFor="billing-toggle" 
              className={`text-sm font-medium cursor-pointer ${billingCycle === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              Monthly
            </Label>
            <Switch
              id="billing-toggle"
              checked={billingCycle === 'annual'}
              onCheckedChange={(checked) => setBillingCycle(checked ? 'annual' : 'monthly')}
            />
            <Label 
              htmlFor="billing-toggle" 
              className={`text-sm font-medium cursor-pointer flex items-center gap-2 ${billingCycle === 'annual' ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              Annual
              <Badge variant="secondary" className="bg-success/10 text-success text-xs">
                Save 15%
              </Badge>
            </Label>
          </div>
        </div>

        {/* Category Tabs */}
        {hasCategorizedPlans ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-center mb-8">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="landlord" className="flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  Landlord Packages
                </TabsTrigger>
                <TabsTrigger value="agency" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Agency Packages
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Callout Banner */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-accent/10 border border-accent/20">
                <Calculator className="w-5 h-5 text-accent" />
                <div className="text-left">
                  {activeTab === 'landlord' ? (
                    <>
                      <p className="text-sm font-medium text-foreground">Pay as low as KES 25 per unit</p>
                      <p className="text-xs text-muted-foreground">Example: 20 units = KES 500/month • SMS credits included</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground">Agency pricing from KES 10 per unit</p>
                      <p className="text-xs text-muted-foreground">Example: 200 units = KES 2,000/month • Bulk SMS included</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-card rounded-2xl p-6 border border-border">
                    <Skeleton className="h-6 w-24 mb-4" />
                    <Skeleton className="h-10 w-32 mb-2" />
                    <Skeleton className="h-4 w-20 mb-6" />
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((j) => (
                        <Skeleton key={j} className="h-4 w-full" />
                      ))}
                    </div>
                    <Skeleton className="h-12 w-full mt-6" />
                  </div>
                ))}
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Unable to load pricing. Please try again later.</p>
              </div>
            )}

            {/* Landlord Plans */}
            <TabsContent value="landlord">
              {landlordPlans.length > 0 && (
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {landlordPlans.map((plan) => (
                    <PlanCard key={plan.id} plan={plan} trialDays={trialDays} billingCycle={billingCycle} />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Agency Plans */}
            <TabsContent value="agency">
              {agencyPlans.length > 0 && (
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {agencyPlans.map((plan) => (
                    <PlanCard key={plan.id} plan={plan} trialDays={trialDays} billingCycle={billingCycle} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          // Fallback: Show all plans without tabs if no categorization exists
          <>
            {/* Small Landlord Callout */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-accent/10 border border-accent/20">
                <Calculator className="w-5 h-5 text-accent" />
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">Even with just 1 unit? Pay only KES 100/month</p>
                  <p className="text-xs text-muted-foreground">Example: 5 units = KES 500/month • 10 SMS per unit included</p>
                </div>
              </div>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-card rounded-2xl p-6 border border-border">
                    <Skeleton className="h-6 w-24 mb-4" />
                    <Skeleton className="h-10 w-32 mb-2" />
                    <Skeleton className="h-4 w-20 mb-6" />
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((j) => (
                        <Skeleton key={j} className="h-4 w-full" />
                      ))}
                    </div>
                    <Skeleton className="h-12 w-full mt-6" />
                  </div>
                ))}
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Unable to load pricing. Please try again later.</p>
              </div>
            )}

            {/* Plans Grid */}
            {plans && plans.length > 0 && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} trialDays={trialDays} billingCycle={billingCycle} />
                ))}
              </div>
            )}
          </>
        )}
        
        {/* Comparison with Competitors */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 text-success text-sm font-medium mb-4">
            <TrendingUp className="w-4 h-4" />
            Up to 600% cheaper than leading competitors
          </div>
        </div>
        
        {/* Bottom note */}
        <p className="text-center text-sm text-muted-foreground mt-8">
          All plans include a {trialDays}-day free trial. No credit card required.
        </p>
      </div>
    </section>
  );
}
