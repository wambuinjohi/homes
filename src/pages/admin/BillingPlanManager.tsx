import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EditBillingPlanDialog } from "@/components/admin/EditBillingPlanDialog";
import { PlanFeaturesList } from "@/components/billing/PlanFeaturesList";
import { BillingPreviewCalculator } from "@/components/admin/BillingPreviewCalculator";
import { Plus, Search, Settings, Users, Crown, Zap, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getCurrencySymbol } from "@/utils/currency";

interface BillingPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  billing_cycle: string;
  billing_model: 'percentage' | 'fixed_per_unit' | 'tiered';
  percentage_rate?: number;
  fixed_amount_per_unit?: number;
  tier_pricing?: { min_units: number; max_units: number; price_per_unit: number; }[];
  max_properties: number;
  max_units: number;
  sms_credits_included: number;
  features: string[];
  is_active: boolean;
  is_custom: boolean;
  contact_link?: string;
  currency: string;
  plan_category: 'landlord' | 'agency' | 'both';
  created_at: string;
  updated_at: string;
}

export default function BillingPlanManager() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'landlord' | 'agency' | 'both'>('all');
  const [editingPlan, setEditingPlan] = useState<BillingPlan | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [subscriptionCounts, setSubscriptionCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchBillingPlans();
  }, []);

  const fetchBillingPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('billing_plans')
        .select('*')
        .order('price', { ascending: true });

      if (error) throw error;

      // Fetch subscription counts
      const { data: subscriptions, error: subError } = await supabase
        .from('landlord_subscriptions')
        .select('billing_plan_id, status')
        .eq('status', 'active');

      if (subError) {
        console.error('Error fetching subscription counts:', subError);
      }

      // Count subscriptions by plan
      const counts: Record<string, number> = {};
      subscriptions?.forEach(sub => {
        if (sub.billing_plan_id) {
          counts[sub.billing_plan_id] = (counts[sub.billing_plan_id] || 0) + 1;
        }
      });

      setSubscriptionCounts(counts);

      const processedPlans: BillingPlan[] = (data || []).map(plan => ({
        id: plan.id,
        name: plan.name,
        description: plan.description || '',
        price: plan.price,
        billing_cycle: plan.billing_cycle || 'monthly',
        billing_model: (['percentage', 'fixed_per_unit', 'tiered'].includes(plan.billing_model as string) 
          ? plan.billing_model 
          : 'percentage') as 'percentage' | 'fixed_per_unit' | 'tiered',
        percentage_rate: plan.percentage_rate || undefined,
        fixed_amount_per_unit: plan.fixed_amount_per_unit || undefined,
        tier_pricing: Array.isArray(plan.tier_pricing) ? 
          (plan.tier_pricing as { min_units: number; max_units: number; price_per_unit: number; }[]) : 
          undefined,
        max_properties: plan.max_properties,
        max_units: plan.max_units,
        sms_credits_included: plan.sms_credits_included,
        features: Array.isArray(plan.features) ? (plan.features as string[]) : 
                 typeof plan.features === 'string' ? [plan.features] : [],
        is_active: plan.is_active,
        is_custom: plan.is_custom || false,
        contact_link: plan.contact_link || undefined,
        currency: plan.currency || 'KES',
        plan_category: (plan.plan_category as 'landlord' | 'agency' | 'both') || 'both',
        created_at: plan.created_at,
        updated_at: plan.updated_at
      }));

      setPlans(processedPlans);
    } catch (error) {
      console.error('Error fetching billing plans:', error);
      toast.error('Failed to load billing plans');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = () => {
    const newPlan: BillingPlan = {
      id: '',
      name: '',
      description: '',
      price: 0,
      billing_cycle: 'monthly',
      billing_model: 'percentage',
      max_properties: 0,
      max_units: 0,
      sms_credits_included: 0,
      features: [],
      is_active: true,
      is_custom: false,
      currency: 'KES',
      plan_category: 'landlord',
      created_at: '',
      updated_at: ''
    };
    setEditingPlan(newPlan);
    setEditDialogOpen(true);
  };

  const handleEditPlan = (plan: BillingPlan) => {
    setEditingPlan(plan);
    setEditDialogOpen(true);
  };

  const handleSavePlan = async (plan: BillingPlan) => {
    try {
      let result;
      if (plan.id) {
        // Update existing plan
        result = await supabase
          .from('billing_plans')
          .update({
            name: plan.name,
            description: plan.description,
            price: plan.price,
            billing_cycle: plan.billing_cycle,
            billing_model: plan.billing_model,
            percentage_rate: plan.percentage_rate,
            fixed_amount_per_unit: plan.fixed_amount_per_unit,
            tier_pricing: plan.tier_pricing,
            max_properties: plan.max_properties,
            max_units: plan.max_units,
            sms_credits_included: plan.sms_credits_included,
            features: plan.features,
            is_active: plan.is_active,
            is_custom: plan.is_custom,
            contact_link: plan.contact_link,
            currency: plan.currency
          })
          .eq('id', plan.id);
      } else {
        // Create new plan
        result = await supabase
          .from('billing_plans')
          .insert({
            name: plan.name,
            description: plan.description,
            price: plan.price,
            billing_cycle: plan.billing_cycle,
            billing_model: plan.billing_model,
            percentage_rate: plan.percentage_rate,
            fixed_amount_per_unit: plan.fixed_amount_per_unit,
            tier_pricing: plan.tier_pricing,
            max_properties: plan.max_properties,
            max_units: plan.max_units,
            sms_credits_included: plan.sms_credits_included,
            features: plan.features,
            is_active: plan.is_active,
            is_custom: plan.is_custom,
            contact_link: plan.contact_link,
            currency: plan.currency
          });
      }

      if (result.error) throw result.error;

      toast.success(plan.id ? 'Plan updated successfully' : 'Plan created successfully');
      setEditDialogOpen(false);
      setEditingPlan(null);
      fetchBillingPlans();
    } catch (error) {
      console.error('Error saving plan:', error);
      toast.error('Failed to save plan');
    }
  };

  const handleDeletePlan = async (planId: string) => {
    try {
      const { error } = await supabase
        .from('billing_plans')
        .delete()
        .eq('id', planId);

      if (error) throw error;

      toast.success('Plan deleted successfully');
      setEditDialogOpen(false);
      setEditingPlan(null);
      fetchBillingPlans();
    } catch (error) {
      console.error('Error deleting plan:', error);
      toast.error('Failed to delete plan');
    }
  };

  const getPlanIcon = (planName: string) => {
    const name = planName.toLowerCase();
    if (name.includes('starter') || name.includes('basic')) {
      return <Zap className="h-5 w-5 text-green-600" />;
    }
    if (name.includes('professional') || name.includes('pro')) {
      return <Star className="h-5 w-5 text-blue-600" />;
    }
    if (name.includes('enterprise') || name.includes('premium')) {
      return <Crown className="h-5 w-5 text-purple-600" />;
    }
    return <Settings className="h-5 w-5 text-gray-600" />;
  };

  const getCategoryBadge = (category: 'landlord' | 'agency' | 'both') => {
    switch (category) {
      case 'landlord':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Landlord</Badge>;
      case 'agency':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Agency</Badge>;
      case 'both':
        return <Badge variant="secondary">Both</Badge>;
    }
  };

  const filteredPlans = plans.filter(plan => {
    const matchesSearch = plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || plan.plan_category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Billing Plan Management</h1>
            <p className="text-muted-foreground">
              Create and manage subscription plans with features and pricing tiers
            </p>
          </div>
          <Button onClick={handleCreatePlan}>
            <Plus className="mr-2 h-4 w-4" />
            Create Plan
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search plans..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Category:</span>
            <div className="flex gap-1">
              {(['all', 'landlord', 'agency', 'both'] as const).map((cat) => (
                <Button
                  key={cat}
                  variant={categoryFilter === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCategoryFilter(cat)}
                  className="capitalize"
                >
                  {cat === 'all' ? 'All' : cat}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Total:</span>
            <Badge variant="secondary">{filteredPlans.length}/{plans.length}</Badge>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredPlans.map((plan) => (
            <Card key={plan.id} className={`cursor-pointer transition-all hover:shadow-lg ${!plan.is_active ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getPlanIcon(plan.name)}
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {getCategoryBadge(plan.plan_category)}
                  </div>
                  <div className="flex items-center gap-1">
                    {!plan.is_active && <Badge variant="secondary">Inactive</Badge>}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleEditPlan(plan)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription className="text-sm">{plan.description}</CardDescription>
                
                <div className="mt-3">
                  {plan.is_custom ? (
                    <div>
                      <span className="text-lg font-bold text-purple-600">Custom pricing</span>
                      <span className="text-muted-foreground text-sm block">Contact for quote</span>
                    </div>
                  ) : plan.billing_model === 'percentage' && plan.percentage_rate ? (
                    <>
                      <span className="text-2xl font-bold text-primary">
                        {plan.percentage_rate}%
                      </span>
                      <span className="text-muted-foreground text-sm block">commission on rent collected</span>
                    </>
                  ) : plan.billing_model === 'fixed_per_unit' && plan.fixed_amount_per_unit ? (
                    <>
                      <span className="text-2xl font-bold">
                        {getCurrencySymbol(plan.currency)}{plan.fixed_amount_per_unit}
                      </span>
                      <span className="text-muted-foreground text-sm">per unit/{plan.billing_cycle}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl font-bold">
                        {getCurrencySymbol(plan.currency)}{plan.price}
                      </span>
                      <span className="text-muted-foreground text-sm">/{plan.billing_cycle}</span>
                    </>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="space-y-3">
                  {/* Limits */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-muted/50 rounded text-center">
                      <div className="text-xs text-muted-foreground">Max Units</div>
                      <div className="font-medium text-sm">
                        {plan.max_units === 0 ? '∞' : plan.max_units}
                      </div>
                    </div>
                    <div className="p-2 bg-muted/50 rounded text-center">
                      <div className="text-xs text-muted-foreground">SMS Credits</div>
                      <div className="font-medium text-sm">
                        {plan.sms_credits_included === 0 ? '0' : plan.sms_credits_included}
                      </div>
                    </div>
                  </div>

                  {/* Features Preview */}
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Features ({plan.features.length})</div>
                    <div className="flex flex-wrap gap-1">
                      {plan.features.slice(0, 3).map((feature, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {feature.split('.').pop()}
                        </Badge>
                      ))}
                      {plan.features.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{plan.features.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
                    <span>Created: {new Date(plan.created_at).toLocaleDateString()}</span>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>{subscriptionCounts[plan.id] || 0} users</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredPlans.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
              <Settings className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No plans found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'Try adjusting your search criteria' : 'Create your first billing plan to get started'}
            </p>
            {!searchTerm && (
              <Button onClick={handleCreatePlan}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Plan
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Preview Calculator Section */}
      {editingPlan && editDialogOpen && !editingPlan.is_custom && (
        <div className="mb-6">
          <BillingPreviewCalculator
            planId={editingPlan.id}
            billingModel={editingPlan.billing_model}
            percentageRate={editingPlan.percentage_rate}
            fixedAmountPerUnit={editingPlan.fixed_amount_per_unit}
            tierPricing={editingPlan.tier_pricing}
            currency={editingPlan.currency}
          />
        </div>
      )}

      {/* Edit Dialog */}
      <EditBillingPlanDialog
        plan={editingPlan}
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEditingPlan(null);
        }}
        onSave={handleSavePlan}
        onDelete={handleDeletePlan}
      />
    </DashboardLayout>
  );
}