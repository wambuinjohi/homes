import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

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
  // New fields for landlord/agency categorization (optional for backward compatibility)
  plan_category?: 'landlord' | 'agency' | 'both';
  min_units?: number;
  max_units_display?: string;
  display_order?: number;
  yearly_discount_percent?: number;
  is_popular?: boolean;
  competitive_note?: string;
}

interface EditBillingPlanDialogProps {
  plan: BillingPlan | null;
  open: boolean;
  onClose: () => void;
  onSave: (plan: BillingPlan) => void;
  onDelete: (planId: string) => void;
}

export const EditBillingPlanDialog: React.FC<EditBillingPlanDialogProps> = ({
  plan,
  open,
  onClose,
  onSave,
  onDelete
}) => {
  const [editedPlan, setEditedPlan] = useState<BillingPlan | null>(null);
  const [newFeature, setNewFeature] = useState("");

  useEffect(() => {
    if (plan) {
      setEditedPlan({ ...plan });
    }
  }, [plan]);

  const handleSave = () => {
    if (editedPlan) {
      // Validate required fields based on billing model
      if (!editedPlan.is_custom) {
        if (editedPlan.billing_model === 'percentage' && (!editedPlan.percentage_rate || editedPlan.percentage_rate <= 0)) {
          toast.error('Percentage rate is required and must be greater than 0');
          return;
        }
        if (editedPlan.billing_model === 'fixed_per_unit' && (!editedPlan.fixed_amount_per_unit || editedPlan.fixed_amount_per_unit <= 0)) {
          toast.error('Fixed amount per unit is required and must be greater than 0');
          return;
        }
        if (editedPlan.billing_model === 'tiered' && (!editedPlan.tier_pricing || editedPlan.tier_pricing.length === 0)) {
          toast.error('At least one pricing tier is required');
          return;
        }
      }
      
      // Validate tier pricing structure
      if (editedPlan.billing_model === 'tiered' && editedPlan.tier_pricing) {
        for (let i = 0; i < editedPlan.tier_pricing.length; i++) {
          const tier = editedPlan.tier_pricing[i];
          if (tier.min_units < 0 || tier.max_units < tier.min_units || tier.price_per_unit <= 0) {
            toast.error(`Invalid tier ${i + 1}: Check min/max units and price`);
            return;
          }
        }
      }

      onSave(editedPlan);
    }
  };

  const handleDelete = () => {
    if (editedPlan && window.confirm('Are you sure you want to delete this billing plan?')) {
      onDelete(editedPlan.id);
      onClose();
    }
  };

  const addFeature = () => {
    if (newFeature.trim() && editedPlan) {
      setEditedPlan({
        ...editedPlan,
        features: [...editedPlan.features, newFeature.trim()]
      });
      setNewFeature("");
    }
  };

  const removeFeature = (index: number) => {
    if (editedPlan) {
      setEditedPlan({
        ...editedPlan,
        features: editedPlan.features.filter((_, i) => i !== index)
      });
    }
  };

  const addTierPricing = () => {
    if (editedPlan) {
      const newTier = { min_units: 1, max_units: 10, price_per_unit: 100 };
      setEditedPlan({
        ...editedPlan,
        tier_pricing: [...(editedPlan.tier_pricing || []), newTier]
      });
    }
  };

  const updateTierPricing = (index: number, field: string, value: number) => {
    if (editedPlan && editedPlan.tier_pricing) {
      const updated = [...editedPlan.tier_pricing];
      updated[index] = { ...updated[index], [field]: value };
      setEditedPlan({
        ...editedPlan,
        tier_pricing: updated
      });
    }
  };

  const removeTierPricing = (index: number) => {
    if (editedPlan && editedPlan.tier_pricing) {
      setEditedPlan({
        ...editedPlan,
        tier_pricing: editedPlan.tier_pricing.filter((_, i) => i !== index)
      });
    }
  };

  if (!editedPlan) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editedPlan.id ? 'Edit Billing Plan' : 'Create New Billing Plan'}
          </DialogTitle>
          {editedPlan.id && (
            <div className="absolute top-4 right-16">
              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Plan
              </Button>
            </div>
          )}
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="plan-name">Plan Name</Label>
                <Input
                  id="plan-name"
                  value={editedPlan.name}
                  onChange={(e) => setEditedPlan({ ...editedPlan, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan-description">Description</Label>
                <Textarea
                  id="plan-description"
                  value={editedPlan.description}
                  onChange={(e) => setEditedPlan({ ...editedPlan, description: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan-category">Plan Category</Label>
                <Select 
                  value={editedPlan.plan_category || 'both'} 
                  onValueChange={(value: 'landlord' | 'agency' | 'both') => setEditedPlan({ ...editedPlan, plan_category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="landlord">Landlord Only</SelectItem>
                    <SelectItem value="agency">Agency Only</SelectItem>
                    <SelectItem value="both">Both (Landlord & Agency)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan-currency">Currency</Label>
                <Select 
                  value={editedPlan.currency} 
                  onValueChange={(value) => setEditedPlan({ ...editedPlan, currency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KES">KES (Kenyan Shilling)</SelectItem>
                    <SelectItem value="USD">USD (US Dollar)</SelectItem>
                    <SelectItem value="EUR">EUR (Euro)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="billing-cycle">Billing Cycle</Label>
                <Select 
                  value={editedPlan.billing_cycle} 
                  onValueChange={(value) => setEditedPlan({ ...editedPlan, billing_cycle: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="display-order">Display Order</Label>
                  <Input
                    id="display-order"
                    type="number"
                    value={editedPlan.display_order || 0}
                    onChange={(e) => setEditedPlan({ ...editedPlan, display_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yearly-discount">Yearly Discount %</Label>
                  <Input
                    id="yearly-discount"
                    type="number"
                    value={editedPlan.yearly_discount_percent || 15}
                    onChange={(e) => setEditedPlan({ ...editedPlan, yearly_discount_percent: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="plan-active"
                  checked={editedPlan.is_active}
                  onCheckedChange={(checked) => setEditedPlan({ ...editedPlan, is_active: checked })}
                />
                <Label htmlFor="plan-active">Active Plan</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="plan-popular"
                  checked={editedPlan.is_popular || false}
                  onCheckedChange={(checked) => setEditedPlan({ ...editedPlan, is_popular: checked })}
                />
                <Label htmlFor="plan-popular">Popular Plan (highlighted)</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="plan-custom"
                  checked={editedPlan.is_custom}
                  onCheckedChange={(checked) => setEditedPlan({ ...editedPlan, is_custom: checked })}
                />
                <Label htmlFor="plan-custom">Custom Pricing (Enterprise)</Label>
              </div>

              {editedPlan.is_custom && (
                <div className="space-y-2">
                  <Label htmlFor="contact-link">Contact Link (for quotes)</Label>
                  <Input
                    id="contact-link"
                    placeholder="/support?topic=enterprise"
                    value={editedPlan.contact_link || ''}
                    onChange={(e) => setEditedPlan({ ...editedPlan, contact_link: e.target.value })}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="max-units-display">Unit Range Display (e.g., "1-20 units")</Label>
                <Input
                  id="max-units-display"
                  placeholder="1-20 units"
                  value={editedPlan.max_units_display || ''}
                  onChange={(e) => setEditedPlan({ ...editedPlan, max_units_display: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="competitive-note">Competitive Note (badge text)</Label>
                <Input
                  id="competitive-note"
                  placeholder="Up to 600% cheaper"
                  value={editedPlan.competitive_note || ''}
                  onChange={(e) => setEditedPlan({ ...editedPlan, competitive_note: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Billing Model & Limits */}
          <Card>
            <CardHeader>
              <CardTitle>Billing Model & Limits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!editedPlan.is_custom && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="billing-model">Billing Model</Label>
                    <Select 
                      value={editedPlan.billing_model} 
                      onValueChange={(value: 'percentage' | 'fixed_per_unit' | 'tiered') => 
                        setEditedPlan({ ...editedPlan, billing_model: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed_per_unit">Fixed per Unit</SelectItem>
                        <SelectItem value="tiered">Tiered Pricing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {editedPlan.billing_model === 'percentage' && (
                    <div className="space-y-2">
                      <Label htmlFor="percentage-rate">Percentage Rate (%)</Label>
                      <Input
                        id="percentage-rate"
                        type="number"
                        step="0.1"
                        value={editedPlan.percentage_rate || 0}
                        onChange={(e) => setEditedPlan({ 
                          ...editedPlan, 
                          percentage_rate: parseFloat(e.target.value) || 0 
                        })}
                      />
                    </div>
                  )}

                  {editedPlan.billing_model === 'fixed_per_unit' && (
                    <div className="space-y-2">
                      <Label htmlFor="fixed-amount">Fixed Amount per Unit</Label>
                      <Input
                        id="fixed-amount"
                        type="number"
                        value={editedPlan.fixed_amount_per_unit || 0}
                        onChange={(e) => setEditedPlan({ 
                          ...editedPlan, 
                          fixed_amount_per_unit: parseFloat(e.target.value) || 0 
                        })}
                      />
                    </div>
                  )}
                </>
              )}

              {editedPlan.is_custom && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-purple-800 font-medium">
                    Custom Pricing Plan
                  </p>
                  <p className="text-xs text-purple-600 mt-1">
                    Pricing will be negotiated on a case-by-case basis. Standard pricing fields are disabled.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max-properties">Max Properties</Label>
                  <Input
                    id="max-properties"
                    type="number"
                    value={editedPlan.max_properties}
                    onChange={(e) => setEditedPlan({ 
                      ...editedPlan, 
                      max_properties: parseInt(e.target.value) || 0 
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-units">Max Units</Label>
                  <Input
                    id="max-units"
                    type="number"
                    value={editedPlan.max_units}
                    onChange={(e) => setEditedPlan({ 
                      ...editedPlan, 
                      max_units: parseInt(e.target.value) || 0 
                    })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sms-credits">SMS Credits Included</Label>
                <Input
                  id="sms-credits"
                  type="number"
                  value={editedPlan.sms_credits_included}
                  onChange={(e) => setEditedPlan({ 
                    ...editedPlan, 
                    sms_credits_included: parseInt(e.target.value) || 0 
                  })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <Card>
            <CardHeader>
              <CardTitle>Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Add custom feature..."
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addFeature()}
                  />
                  <Button onClick={addFeature} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-2">Quick Add Common Features:</p>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      'reports.advanced', 'reports.financial', 'integrations.api', 
                      'integrations.accounting', 'team.roles', 'branding.white_label',
                      'support.priority', 'operations.bulk', 'notifications.sms',
                      'tenant.portal', 'documents.templates', 'billing.automated'
                    ].map((feature) => (
                      <button
                        key={feature}
                        type="button"
                        className="text-left text-xs px-2 py-1 hover:bg-muted rounded border"
                        onClick={() => {
                          if (!editedPlan?.features.includes(feature)) {
                            setEditedPlan({
                              ...editedPlan!,
                              features: [...editedPlan!.features, feature]
                            });
                          }
                        }}
                      >
                        {feature}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {editedPlan.features.map((feature, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <Badge variant="outline">{feature}</Badge>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => removeFeature(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tiered Pricing (if applicable) */}
          {editedPlan.billing_model === 'tiered' && !editedPlan.is_custom && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Tiered Pricing
                  <Button onClick={addTierPricing} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Tier
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {editedPlan.tier_pricing?.map((tier, index) => (
                  <div key={index} className="grid grid-cols-4 gap-2 items-center">
                    <Input
                      type="number"
                      placeholder="Min units"
                      value={tier.min_units}
                      onChange={(e) => updateTierPricing(index, 'min_units', parseInt(e.target.value) || 0)}
                    />
                    <Input
                      type="number"
                      placeholder="Max units"
                      value={tier.max_units}
                      onChange={(e) => updateTierPricing(index, 'max_units', parseInt(e.target.value) || 0)}
                    />
                    <Input
                      type="number"
                      placeholder="Price per unit"
                      value={tier.price_per_unit}
                      onChange={(e) => updateTierPricing(index, 'price_per_unit', parseFloat(e.target.value) || 0)}
                    />
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => removeTierPricing(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};