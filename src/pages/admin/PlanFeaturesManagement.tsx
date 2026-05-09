import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Edit, Trash2, Save } from "lucide-react";
import * as LucideIcons from "lucide-react";

interface PlanFeature {
  id: string;
  feature_key: string;
  display_name: string;
  description: string | null;
  category: 'core' | 'advanced' | 'premium' | 'enterprise';
  icon_name: string | null;
  menu_item_title: string | null;
  is_active: boolean;
  sort_order: number;
}

interface BillingPlan {
  id: string;
  name: string;
}

interface PlanFeatureAssignment {
  billing_plan_id: string;
  feature_key: string;
  is_enabled: boolean;
  custom_limit: number | null;
}

const ICON_OPTIONS = ['Building2', 'Home', 'Users', 'FileText', 'DollarSign', 'Wrench', 'Receipt', 'BarChart3', 'TrendingUp', 'TrendingDown', 'Mail', 'MessageSquare', 'Upload', 'Shield', 'Palette', 'Paintbrush', 'Headphones', 'UserCheck', 'Code', 'Calculator'];

export default function PlanFeaturesManagement() {
  const queryClient = useQueryClient();
  const [showFeatureDialog, setShowFeatureDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [editingFeature, setEditingFeature] = useState<PlanFeature | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");

  // Fetch features
  const { data: features = [], isLoading: loadingFeatures } = useQuery({
    queryKey: ['plan-features'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plan_features' as any)
        .select('*')
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as PlanFeature[];
    }
  });

  // Fetch billing plans
  const { data: plans = [] } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_plans')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as BillingPlan[];
    }
  });

  // Fetch plan assignments
  const { data: assignments = [] } = useQuery({
    queryKey: ['plan-feature-assignments', selectedFeature],
    queryFn: async () => {
      if (!selectedFeature) return [];
      const { data, error } = await supabase
        .from('billing_plan_features' as any)
        .select('*')
        .eq('feature_key', selectedFeature);
      if (error) throw error;
      return (data || []) as unknown as PlanFeatureAssignment[];
    },
    enabled: !!selectedFeature
  });

  // Create/Update feature
  const saveFeatureMutation = useMutation({
    mutationFn: async (feature: Partial<PlanFeature>) => {
      if (feature.id) {
        const { error } = await supabase
          .from('plan_features' as any)
          .update(feature)
          .eq('id', feature.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('plan_features' as any)
          .insert([feature]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-features'] });
      toast.success('Feature saved successfully');
      setShowFeatureDialog(false);
      setEditingFeature(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save feature');
    }
  });

  // Toggle feature assignment
  const toggleAssignmentMutation = useMutation({
    mutationFn: async ({ planId, featureKey, enabled }: { planId: string; featureKey: string; enabled: boolean }) => {
      if (enabled) {
        const { error } = await supabase
          .from('billing_plan_features' as any)
          .insert([{ billing_plan_id: planId, feature_key: featureKey, is_enabled: true }]);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('billing_plan_features' as any)
          .delete()
          .eq('billing_plan_id', planId)
          .eq('feature_key', featureKey);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-feature-assignments'] });
      toast.success('Assignment updated');
    }
  });

  const handleSaveFeature = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const feature = {
      id: editingFeature?.id,
      feature_key: formData.get('feature_key') as string,
      display_name: formData.get('display_name') as string,
      description: formData.get('description') as string || null,
      category: formData.get('category') as PlanFeature['category'],
      icon_name: formData.get('icon_name') as string || null,
      menu_item_title: formData.get('menu_item_title') as string || null,
      sort_order: parseInt(formData.get('sort_order') as string) || 0,
      is_active: true
    };
    saveFeatureMutation.mutate(feature);
  };

  // Filter features based on active tab
  const getFilteredFeatures = () => {
    switch (activeTab) {
      case 'reports':
        return features.filter(f => f.feature_key.startsWith('reports.'));
      case 'dashboard':
        return features.filter(f => f.feature_key.startsWith('dashboard.'));
      default:
        return features;
    }
  };

  const filteredFeatures = getFilteredFeatures();

  const renderFeaturesTable = (featuresToShow: PlanFeature[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Feature Key</TableHead>
          <TableHead>Display Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Icon</TableHead>
          <TableHead>Sort</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {featuresToShow.map((feature) => {
          const Icon = feature.icon_name ? (LucideIcons as any)[feature.icon_name] : null;
          return (
            <TableRow key={feature.id}>
              <TableCell className="font-mono text-xs">{feature.feature_key}</TableCell>
              <TableCell>{feature.display_name}</TableCell>
              <TableCell>
                <Badge variant={
                  feature.category === 'enterprise' ? 'default' :
                  feature.category === 'premium' ? 'secondary' :
                  feature.category === 'advanced' ? 'outline' : 'secondary'
                }>
                  {feature.category}
                </Badge>
              </TableCell>
              <TableCell>{Icon && <Icon className="h-4 w-4" />}</TableCell>
              <TableCell>{feature.sort_order}</TableCell>
              <TableCell className="space-x-2">
                <Button size="sm" variant="ghost" onClick={() => { setEditingFeature(feature); setShowFeatureDialog(true); }}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setSelectedFeature(feature.feature_key); setShowAssignDialog(true); }}>
                  <Save className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Plan Features Management</h1>
            <p className="text-muted-foreground">Manage feature definitions and plan assignments</p>
          </div>
          <Button onClick={() => { setEditingFeature(null); setShowFeatureDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Feature
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
            <CardDescription>Define features and their properties. Use tabs to filter by category.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingFeatures ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="all">All Features ({features.length})</TabsTrigger>
                  <TabsTrigger value="reports">
                    Reports ({features.filter(f => f.feature_key.startsWith('reports.')).length})
                  </TabsTrigger>
                  <TabsTrigger value="dashboard">
                    Dashboard ({features.filter(f => f.feature_key.startsWith('dashboard.')).length})
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="all">
                  {renderFeaturesTable(filteredFeatures)}
                </TabsContent>
                
                <TabsContent value="reports">
                  <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      🟢 Core (all plans) · 🟡 Advanced (Starter+) · 🟣 Premium (Professional+) · 👑 Enterprise
                    </p>
                  </div>
                  {renderFeaturesTable(filteredFeatures)}
                </TabsContent>
                
                <TabsContent value="dashboard">
                  <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Configure which dashboard sections are visible for each plan tier.
                    </p>
                  </div>
                  {renderFeaturesTable(filteredFeatures)}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        {/* Feature Editor Dialog */}
        <Dialog open={showFeatureDialog} onOpenChange={setShowFeatureDialog}>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSaveFeature}>
              <DialogHeader>
                <DialogTitle>{editingFeature ? 'Edit Feature' : 'Add Feature'}</DialogTitle>
                <DialogDescription>Define the feature properties and metadata</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="feature_key">Feature Key *</Label>
                    <Input id="feature_key" name="feature_key" defaultValue={editingFeature?.feature_key} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="display_name">Display Name *</Label>
                    <Input id="display_name" name="display_name" defaultValue={editingFeature?.display_name} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" defaultValue={editingFeature?.description || ''} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select name="category" defaultValue={editingFeature?.category || 'core'}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="core">Core</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="icon_name">Icon</Label>
                    <Select name="icon_name" defaultValue={editingFeature?.icon_name || ''}>
                      <SelectTrigger><SelectValue placeholder="Select icon" /></SelectTrigger>
                      <SelectContent>
                        {ICON_OPTIONS.map(icon => <SelectItem key={icon} value={icon}>{icon}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sort_order">Sort Order</Label>
                    <Input id="sort_order" name="sort_order" type="number" defaultValue={editingFeature?.sort_order || 0} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="menu_item_title">Menu Item Title</Label>
                  <Input id="menu_item_title" name="menu_item_title" defaultValue={editingFeature?.menu_item_title || ''} placeholder="e.g., Reports" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowFeatureDialog(false)}>Cancel</Button>
                <Button type="submit">Save Feature</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Plan Assignment Dialog */}
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign to Plans</DialogTitle>
              <DialogDescription>Toggle feature availability per plan</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {plans.map((plan) => {
                const isAssigned = assignments.some(a => a.billing_plan_id === plan.id && a.is_enabled);
                return (
                  <div key={plan.id} className="flex items-center justify-between">
                    <Label>{plan.name}</Label>
                    <Switch
                      checked={isAssigned}
                      onCheckedChange={(enabled) => 
                        toggleAssignmentMutation.mutate({ 
                          planId: plan.id, 
                          featureKey: selectedFeature!, 
                          enabled 
                        })
                      }
                    />
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
