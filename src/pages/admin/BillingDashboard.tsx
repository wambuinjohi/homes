import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatAmount } from "@/utils/currency";
import { useAuth } from "@/hooks/useAuth";
import { EditBillingPlanDialog } from "@/components/admin/EditBillingPlanDialog";
import { DeleteBillingPlanDialog } from "@/components/admin/DeleteBillingPlanDialog";
import { 
  CreditCard, 
  DollarSign, 
  Users, 
  Clock, 
  AlertCircle,
  Search,
  Plus,
  Settings,
  Download,
  Calendar,
  TrendingUp,
  Mail,
  MessageSquare,
  Crown,
  Star,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Filter,
  MoreVertical,
  Sparkles,
  ChevronRight,
  Edit,
  Trash2,
  Archive
} from "lucide-react";
import { EnhancedAnalyticsCharts } from "@/components/admin/EnhancedAnalyticsCharts";
import { PropertyStakeholderSubscriptions } from "@/components/admin/PropertyStakeholderSubscriptions";
import { CustomTrialManagement } from "@/components/admin/CustomTrialManagement";
import { PropertyOwnershipAudit } from "@/components/admin/PropertyOwnershipAudit";

interface BillingStats {
  totalRevenue: number;
  monthlyRevenue: number;
  totalLandlords: number;
  trialLandlords: number;
  activeLandlords: number;
  overdueLandlords: number;
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
}

interface PropertyStakeholderSubscription {
  id: string;
  landlord_id: string;
  status: string;
  trial_start_date?: string;
  trial_end_date?: string;
  next_billing_date?: string;
  sms_credits_balance: number;
  daysRemaining: number;
  role: string;
  property_count?: number;
  unit_count?: number;
  tenant_count?: number;
  billing_plan?: {
    id: string;
    name: string;
    price: number;
    billing_cycle: string;
    currency: string;
    billing_model: string;
    percentage_rate?: number;
    fixed_amount_per_unit?: number;
    tier_pricing?: any;
  };
  profiles?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

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
}

interface BillingSettings {
  trial_period_days: number;
  sms_cost_per_unit: number;
  grace_period_days: number;
  auto_invoice_generation: boolean;
  payment_reminder_days: number[];
}

const BillingDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<BillingStats>({
    totalRevenue: 0,
    monthlyRevenue: 0,
    totalLandlords: 0,
    trialLandlords: 0,
    activeLandlords: 0,
    overdueLandlords: 0,
    totalInvoices: 0,
    paidInvoices: 0,
    pendingInvoices: 0,
  });
  const [subscriptions, setSubscriptions] = useState<PropertyStakeholderSubscription[]>([]);
  const [billingPlans, setBillingPlans] = useState<BillingPlan[]>([]);
  const [billingSettings, setBillingSettings] = useState<BillingSettings>({
    trial_period_days: 14,
    sms_cost_per_unit: 0.05,
    grace_period_days: 7,
    auto_invoice_generation: true,
    payment_reminder_days: [3, 1],
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPlan, setSelectedPlan] = useState<BillingPlan | null>(null);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [isAddingPlan, setIsAddingPlan] = useState(false);
  const [newPlan, setNewPlan] = useState<Partial<BillingPlan>>({
    name: '',
    description: '',
    price: 0,
    billing_cycle: 'monthly',
    billing_model: 'percentage',
    percentage_rate: 2,
    max_properties: 0,
    max_units: 0,
    sms_credits_included: 0,
    features: [],
    is_active: true,
    currency: 'KES', // Default to KES
    tier_pricing: [
      { min_units: 1, max_units: 20, price_per_unit: 1500 },
      { min_units: 21, max_units: 50, price_per_unit: 1200 },
      { min_units: 51, max_units: 999, price_per_unit: 1000 }
    ]
  });
  const [editingPlan, setEditingPlan] = useState<BillingPlan | null>(null);
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState<BillingPlan | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Currency formatting helper routed to app utility
  const formatCurrency = (amount: number, currency?: string) => {
    return formatAmount(amount, currency);
  };

  useEffect(() => {
    if (user) {
      fetchBillingData();
    }
  }, [user]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Starting to fetch billing data...');

      // Get all users with property-related roles (Landlord, Manager, Agent)
      const { data: stakeholderRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['Landlord', 'Manager', 'Agent']);

      if (rolesError) {
        console.error('❌ Error fetching stakeholder roles:', rolesError);
        throw rolesError;
      }
      
      const stakeholderUserIds = stakeholderRoles?.map(role => role.user_id) || [];
      console.log('✅ Found property stakeholder user IDs:', stakeholderUserIds.length);

      // Then fetch profiles for those users
      const { data: stakeholderProfiles, error: profilesError } = stakeholderUserIds.length > 0 
        ? await supabase
            .from('profiles')
            .select('*')
            .in('id', stakeholderUserIds)
        : { data: [], error: null };

      if (profilesError) {
        console.error('❌ Error fetching stakeholder profiles:', profilesError);
        throw profilesError;
      }
      console.log('✅ Fetched stakeholder profiles:', stakeholderProfiles?.length);

      // Fetch subscriptions separately
      const { data: subscriptionsData, error: subscriptionsError } = await supabase
        .from("landlord_subscriptions")
        .select(`
          *,
          billing_plan:billing_plans(*)
        `);

      if (subscriptionsError) {
        console.error('❌ Error fetching subscriptions:', subscriptionsError);
        throw subscriptionsError;
      }
      console.log('✅ Fetched subscriptions:', subscriptionsData?.length);

      // Fetch property counts for each landlord
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select('id, owner_id');
      
      if (propertiesError) {
        console.error('❌ Error fetching properties:', propertiesError);
      }

      // Fetch unit counts
      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select('id, property_id');
      
      if (unitsError) {
        console.error('❌ Error fetching units:', unitsError);
      }

      // Fetch active tenant counts via leases
      const { data: leasesData, error: leasesError } = await supabase
        .from('leases')
        .select('tenant_id, unit_id, status')
        .eq('status', 'active');
      
      if (leasesError) {
        console.error('❌ Error fetching leases:', leasesError);
      }

      // Create lookup maps for counts per landlord
      const propertyCounts = new Map<string, number>();
      const unitCounts = new Map<string, number>();
      const tenantCounts = new Map<string, number>();

      // Count properties per landlord
      propertiesData?.forEach(property => {
        propertyCounts.set(property.owner_id, (propertyCounts.get(property.owner_id) || 0) + 1);
      });

      // Count units per landlord (via properties)
      unitsData?.forEach(unit => {
        const property = propertiesData?.find(p => p.id === unit.property_id);
        if (property) {
          unitCounts.set(property.owner_id, (unitCounts.get(property.owner_id) || 0) + 1);
        }
      });

      // Count active tenants per landlord (via units -> properties)
      const uniqueTenantsByLandlord = new Map<string, Set<string>>();
      leasesData?.forEach(lease => {
        const unit = unitsData?.find(u => u.id === lease.unit_id);
        if (unit) {
          const property = propertiesData?.find(p => p.id === unit.property_id);
          if (property) {
            if (!uniqueTenantsByLandlord.has(property.owner_id)) {
              uniqueTenantsByLandlord.set(property.owner_id, new Set());
            }
            uniqueTenantsByLandlord.get(property.owner_id)?.add(lease.tenant_id);
          }
        }
      });

      uniqueTenantsByLandlord.forEach((tenants, landlordId) => {
        tenantCounts.set(landlordId, tenants.size);
      });

      console.log('✅ Calculated counts - Properties:', propertyCounts.size, 'Units:', unitCounts.size, 'Tenants:', tenantCounts.size);

      // Combine stakeholder profiles with their subscription data and roles
      const combinedData = stakeholderProfiles?.map(profile => {
        const subscription = subscriptionsData?.find(sub => sub.landlord_id === profile.id);
        const userRole = stakeholderRoles?.find(role => role.user_id === profile.id);
        
        // Calculate trial days remaining
        let daysRemaining = 0;
        if (subscription?.trial_end_date) {
          const trialEndDate = new Date(subscription.trial_end_date);
          const today = new Date();
          daysRemaining = Math.max(0, Math.ceil((trialEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
        }
        
        return {
          id: subscription?.id || `no-sub-${profile.id}`,
          landlord_id: profile.id,
          status: subscription?.status || 'not_subscribed',
          trial_start_date: subscription?.trial_start_date,
          trial_end_date: subscription?.trial_end_date,
          next_billing_date: subscription?.next_billing_date,
          sms_credits_balance: subscription?.sms_credits_balance || 0,
          billing_plan: subscription?.billing_plan || null,
          daysRemaining,
          role: userRole?.role || 'Unknown',
          property_count: propertyCounts.get(profile.id) || 0,
          unit_count: unitCounts.get(profile.id) || 0,
          tenant_count: tenantCounts.get(profile.id) || 0,
          profiles: {
            first_name: profile.first_name,
            last_name: profile.last_name,
            email: profile.email
          }
        };
      }) || [];

      // Fetch all billing plans (for admin management)
      const { data: plansData, error: plansError } = await supabase
        .from("billing_plans")
        .select("*")
        .order("price", { ascending: true });

      if (plansError) {
        console.error('❌ Error fetching billing plans:', plansError);
        throw plansError;
      }
      console.log('✅ Fetched billing plans:', plansData?.length, plansData);

      // Fetch billing settings
      const { data: settingsData, error: settingsError } = await supabase
        .from("billing_settings")
        .select("setting_key, setting_value");

      if (settingsError) {
        console.error('❌ Error fetching billing settings:', settingsError);
        throw settingsError;
      }
      console.log('✅ Fetched billing settings:', settingsData?.length);

      // Process settings data
      const settingsObj: any = {};
      settingsData?.forEach((setting) => {
        try {
          settingsObj[setting.setting_key] = typeof setting.setting_value === 'string' 
            ? JSON.parse(setting.setting_value) 
            : setting.setting_value;
        } catch (e) {
          settingsObj[setting.setting_key] = setting.setting_value;
        }
      });

      // Auto-normalize if trial_settings was accidentally stored as a JSON string
      const trialSettingRaw = settingsData?.find(s => s.setting_key === 'trial_settings')?.setting_value as any;
      if (typeof trialSettingRaw === 'string') {
        try {
          const parsed = JSON.parse(trialSettingRaw);
          await supabase.from('billing_settings').upsert({
            setting_key: 'trial_settings',
            setting_value: parsed,
          }, { onConflict: 'setting_key' });
          console.log('🔧 Normalized trial_settings to JSON object');
        } catch (err) {
          console.warn('⚠️ Failed to normalize trial_settings:', err);
        }
      }
      // Calculate stats from combined data
      const totalLandlords = combinedData?.length || 0;
      const trialLandlords = combinedData?.filter(s => s.status === 'trial').length || 0;
      const activeLandlords = combinedData?.filter(s => s.status === 'active').length || 0;
      const overdueLandlords = combinedData?.filter(s => s.status === 'overdue').length || 0;

      // Process plans data to ensure features is an array and types are correct
      const processedPlans = (plansData || []).map(plan => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features as string[] : 
                  typeof plan.features === 'string' ? [plan.features] : [],
        tier_pricing: plan.tier_pricing ? plan.tier_pricing as { min_units: number; max_units: number; price_per_unit: number; }[] : undefined,
        billing_model: plan.billing_model as 'percentage' | 'fixed_per_unit' | 'tiered'
      }));

      console.log('🎯 Setting state with plans:', processedPlans);
      
      setSubscriptions(combinedData);
      setBillingPlans(processedPlans as BillingPlan[]);
      setBillingSettings({
        trial_period_days: settingsObj.trial_settings?.trial_period_days || 30,
        sms_cost_per_unit: settingsObj.trial_settings?.sms_cost_per_unit || 0.05,
        grace_period_days: settingsObj.trial_settings?.grace_period_days || 7,
        auto_invoice_generation: settingsObj.trial_settings?.auto_invoice_generation || true,
        payment_reminder_days: settingsObj.trial_settings?.payment_reminder_days || [3, 1],
      });
      setStats({
        totalRevenue: 0,
        monthlyRevenue: 0,
        totalLandlords,
        trialLandlords,
        activeLandlords,
        overdueLandlords,
        totalInvoices: 0,
        paidInvoices: 0,
        pendingInvoices: 0,
      });

      console.log('✅ Successfully updated all state');

    } catch (error) {
      console.error("❌ Error fetching billing data:", error);
      toast({
        title: "Error",
        description: "Failed to load billing data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateBillingSettings = async () => {
    try {
      // Update trial settings as a single object
      const trialSettings = {
        trial_period_days: billingSettings.trial_period_days,
        grace_period_days: billingSettings.grace_period_days,
        default_sms_credits: 100,
        auto_invoice_generation: billingSettings.auto_invoice_generation,
        payment_reminder_days: billingSettings.payment_reminder_days,
        sms_cost_per_unit: billingSettings.sms_cost_per_unit
      };

      const updates = [
        { setting_key: 'trial_settings', setting_value: trialSettings }
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from("billing_settings")
          .upsert(update, { onConflict: 'setting_key' });
        
        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Billing settings updated successfully",
      });
      setIsEditingSettings(false);
    } catch (error) {
      console.error("Error updating settings:", error);
      toast({
        title: "Error",
        description: "Failed to update billing settings",
        variant: "destructive",
      });
    }
  };

  const createBillingPlan = async () => {
    try {
      console.log('🔄 Creating billing plan with data:', newPlan);
      
      const planData = {
        name: newPlan.name,
        description: newPlan.description,
        price: newPlan.price,
        billing_cycle: newPlan.billing_cycle,
        billing_model: newPlan.billing_model,
        percentage_rate: newPlan.billing_model === 'percentage' ? newPlan.percentage_rate : null,
        fixed_amount_per_unit: newPlan.billing_model === 'fixed_per_unit' ? newPlan.fixed_amount_per_unit : null,
        tier_pricing: newPlan.billing_model === 'tiered' ? newPlan.tier_pricing : null,
        max_properties: newPlan.max_properties,
        max_units: newPlan.max_units,
        sms_credits_included: newPlan.sms_credits_included,
        features: Array.isArray(newPlan.features) ? newPlan.features : [],
        is_active: newPlan.is_active,
        currency: newPlan.currency || 'KES',
      };

      console.log('📝 Inserting plan data:', planData);

      const { data, error } = await supabase
        .from("billing_plans")
        .insert(planData)
        .select();

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      console.log('✅ Plan created successfully:', data);

      toast({
        title: "Success",
        description: "Billing plan created successfully",
      });
      
      // Reset form with proper tiered pricing structure
      const resetTieredPricing = [
        { min_units: 1, max_units: 20, price_per_unit: 1500 },
        { min_units: 21, max_units: 50, price_per_unit: 1200 },
        { min_units: 51, max_units: 999, price_per_unit: 1000 }
      ];
      
      setNewPlan({
        name: '',
        description: '',
        price: 0,
        billing_cycle: 'monthly',
        billing_model: 'percentage',
        percentage_rate: 2,
        max_properties: 0,
        max_units: 0,
        sms_credits_included: 0,
        features: [],
        is_active: true,
        currency: 'KES',
        tier_pricing: resetTieredPricing
      });
      
      setIsAddingPlan(false);
      
      // Refresh data
      await fetchBillingData();
      
    } catch (error) {
      console.error("❌ Error creating billing plan:", error);
      toast({
        title: "Error",
        description: "Failed to create billing plan",
        variant: "destructive",
      });
    }
  };

  const assignPlanToLandlord = async (landlordId: string, planId: string) => {
    try {
      console.log('🔄 Admin assigning plan:', { landlordId, planId });
      
      // Use edge function for proper admin override with logging
      const { data, error } = await supabase.functions.invoke('admin-assign-plan', {
        body: { landlordId, planId }
      });

      if (error) {
        console.error('❌ Edge function error:', error);
        toast({
          title: "Failed to Assign Plan",
          description: error.message || "Please check the console for details",
          variant: "destructive",
        });
        throw error;
      }

      if (!data?.success) {
        console.error('❌ Assignment failed:', data);
        toast({
          title: "Failed to Assign Plan", 
          description: data?.error || "Unknown error occurred",
          variant: "destructive",
        });
        throw new Error(data?.error || 'Failed to assign plan');
      }

      console.log('✅ Plan assigned successfully');
      toast({
        title: "Success",
        description: "Billing plan assigned successfully",
      });
      
      await fetchBillingData(); // Refresh data
    } catch (error) {
      console.error('❌ Error assigning plan:', error);
      // Error already shown in toast above
      return;
    }
  };

  const updateBillingPlan = async (plan: BillingPlan) => {
    try {
      console.log('🔄 Updating billing plan:', plan);
      
      const { data, error } = await supabase
        .from("billing_plans")
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
          currency: plan.currency,
        })
        .eq('id', plan.id)
        .select();

      if (error) {
        console.error('❌ Database error during plan update:', error);
        throw error;
      }

      console.log('✅ Plan updated successfully:', data);

      toast({
        title: "Success",
        description: "Billing plan updated successfully",
      });
      
      setEditingPlan(null);
      setIsEditingPlan(false);
      await fetchBillingData();
    } catch (error) {
      console.error("❌ Error updating billing plan:", error);
      toast({
        title: "Error",
        description: "Failed to update billing plan",
        variant: "destructive",
      });
    }
  };

  const togglePlanStatus = async (planId: string, isActive: boolean) => {
    try {
      console.log('🔄 Toggling plan status:', { planId, isActive });
      
      const { error } = await supabase
        .from("billing_plans")
        .update({ is_active: isActive })
        .eq('id', planId);

      if (error) {
        console.error('❌ Database error during plan status toggle:', error);
        throw error;
      }

      console.log('✅ Plan status toggled successfully');

      toast({
        title: "Success",
        description: `Billing plan ${isActive ? 'activated' : 'deactivated'} successfully`,
      });
      
      await fetchBillingData();
    } catch (error) {
      console.error("❌ Error toggling plan status:", error);
      toast({
        title: "Error",
        description: "Failed to update billing plan status",
        variant: "destructive",
      });
    }
  };

  const deleteBillingPlan = async (planId: string) => {
    try {
      console.log('🗑️ Deleting billing plan:', planId);
      
      const { error } = await supabase
        .from("billing_plans")
        .delete()
        .eq('id', planId);

      if (error) {
        console.error('❌ Database error during plan deletion:', error);
        throw error;
      }

      console.log('✅ Plan deleted successfully');

      toast({
        title: "Success",
        description: "Billing plan deleted successfully",
      });
      
      await fetchBillingData();
    } catch (error) {
      console.error("❌ Error deleting billing plan:", error);
      toast({
        title: "Error",
        description: "Failed to delete billing plan",
        variant: "destructive",
      });
    }
  };

  const archiveLandlord = async (landlordId: string) => {
    try {
      const { error } = await supabase
        .from("landlord_subscriptions")
        .update({ status: 'archived' })
        .eq('landlord_id', landlordId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Landlord subscription archived successfully",
      });
      
      await fetchBillingData();
    } catch (error) {
      console.error("❌ Error archiving landlord:", error);
      toast({
        title: "Error",
        description: "Failed to archive landlord subscription",
        variant: "destructive",
      });
    }
  };

  const unarchiveLandlord = async (landlordId: string) => {
    try {
      const { error } = await supabase
        .from("landlord_subscriptions")
        .update({ status: 'active' })
        .eq('landlord_id', landlordId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Landlord subscription restored successfully",
      });
      
      await fetchBillingData();
    } catch (error) {
      console.error("❌ Error restoring landlord:", error);
      toast({
        title: "Error",
        description: "Failed to restore landlord subscription",
        variant: "destructive",
      });
    }
  };

  const filteredSubscriptions = subscriptions.filter(subscription => {
    const matchesSearch = subscription.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         subscription.profiles?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         subscription.profiles?.last_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || subscription.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      trial: { variant: "secondary" as const, label: "Trial", icon: Clock },
      active: { variant: "default" as const, label: "Active", icon: null },
      suspended: { variant: "destructive" as const, label: "Suspended", icon: AlertCircle },
      overdue: { variant: "destructive" as const, label: "Overdue", icon: AlertCircle },
      not_subscribed: { variant: "outline" as const, label: "No Plan", icon: null },
      archived: { variant: "outline" as const, label: "Archived", icon: Archive },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.trial;
    return (
      <Badge variant={config.variant}>
        {config.icon && <config.icon className="h-3 w-3 mr-1" />}
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-[100px]" />
                  <Skeleton className="h-4 w-4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-[60px]" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Billing Dashboard</h1>
            <p className="text-muted-foreground">
              Manage billing plans, subscriptions, and settings
            </p>
          </div>
        </div>

        {/* Enhanced Stats Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="relative overflow-hidden bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border-blue-200/50 hover:border-blue-300/70 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 animate-fade-in">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative">
              <CardTitle className="text-sm font-semibold text-gray-600">Total Landlords</CardTitle>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-gray-900 mb-1">{stats.totalLandlords}</div>
              <div className="flex items-center text-sm text-blue-600">
                <ArrowUpRight className="h-4 w-4 mr-1" />
                <span className="font-medium">All registered</span>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent border-green-200/50 hover:border-green-300/70 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/10 animate-fade-in [animation-delay:100ms]">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative">
              <CardTitle className="text-sm font-semibold text-gray-600">Active Subscriptions</CardTitle>
              <div className="p-2 bg-green-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-gray-900 mb-1">{stats.activeLandlords}</div>
              <div className="flex items-center text-sm text-green-600">
                <TrendingUp className="h-4 w-4 mr-1" />
                <span className="font-medium">Generating revenue</span>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-gradient-to-br from-yellow-500/10 via-yellow-500/5 to-transparent border-yellow-200/50 hover:border-yellow-300/70 transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/10 animate-fade-in [animation-delay:200ms]">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative">
              <CardTitle className="text-sm font-semibold text-gray-600">Trial Users</CardTitle>
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-gray-900 mb-1">{stats.trialLandlords}</div>
              <div className="flex items-center text-sm text-yellow-600">
                <Sparkles className="h-4 w-4 mr-1" />
                <span className="font-medium">Evaluating platform</span>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent border-red-200/50 hover:border-red-300/70 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/10 animate-fade-in [animation-delay:300ms]">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative">
              <CardTitle className="text-sm font-semibold text-gray-600">Overdue Accounts</CardTitle>
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-gray-900 mb-1">{stats.overdueLandlords}</div>
              <div className="flex items-center text-sm text-red-600">
                {stats.overdueLandlords > 0 ? (
                  <ArrowDownRight className="h-4 w-4 mr-1" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                <span className="font-medium">
                  {stats.overdueLandlords > 0 ? 'Requires attention' : 'All up to date'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Navigation Tabs */}
        <Tabs defaultValue="analytics" className="space-y-8">
          <div className="flex justify-center">
            <TabsList className="grid w-full max-w-3xl grid-cols-5 bg-gray-100/80 backdrop-blur-sm p-1 h-12 rounded-xl shadow-lg border-0">
              <TabsTrigger 
                value="analytics" 
                className="relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary hover:bg-white/50"
              >
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Analytics</span>
                <span className="sm:hidden">Stats</span>
              </TabsTrigger>
              <TabsTrigger 
                value="subscriptions" 
                className="relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary hover:bg-white/50"
              >
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Subscriptions</span>
                <span className="sm:hidden">Subs</span>
              </TabsTrigger>
              <TabsTrigger 
                value="audit" 
                className="relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary hover:bg-white/50"
              >
                <AlertCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Audit</span>
                <span className="sm:hidden">Audit</span>
              </TabsTrigger>
              <TabsTrigger 
                value="plans" 
                className="relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary hover:bg-white/50"
              >
                <Crown className="h-4 w-4" />
                <span className="hidden sm:inline">Plans</span>
                <span className="sm:hidden">Plans</span>
              </TabsTrigger>
              <TabsTrigger 
                value="settings" 
                className="relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary hover:bg-white/50"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
                <span className="sm:hidden">Config</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="analytics" className="space-y-6">
            <EnhancedAnalyticsCharts />
          </TabsContent>

          <TabsContent value="subscriptions" className="space-y-6">
            <PropertyStakeholderSubscriptions
              subscriptions={subscriptions}
              billingPlans={billingPlans}
              onAssignPlan={assignPlanToLandlord}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
            />
          </TabsContent>

          <TabsContent value="audit" className="space-y-6">
            <PropertyOwnershipAudit />
          </TabsContent>

          <TabsContent value="plans" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Billing Plans</CardTitle>
                    <CardDescription>
                      Create and manage subscription plans
                    </CardDescription>
                  </div>
                  <Button onClick={() => setIsAddingPlan(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Plan
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {billingPlans.map((plan) => (
                    <Card key={plan.id} className="relative">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{plan.name}</CardTitle>
                           <div className="flex space-x-1">
                             <Switch
                               checked={plan.is_active}
                               onCheckedChange={(checked) => togglePlanStatus(plan.id, checked)}
                               className="mr-2"
                             />
                             <Button 
                               size="sm" 
                               variant="outline"
                               onClick={() => {
                                 console.log('🎯 Edit button clicked for plan:', plan.id);
                                 setEditingPlan(plan);
                                 setIsEditingPlan(true);
                               }}
                             >
                               <Edit className="h-4 w-4" />
                             </Button>
                             <Button 
                               size="sm" 
                               variant="destructive"
                               onClick={() => {
                                 setDeletingPlan(plan);
                                 setIsDeleteDialogOpen(true);
                               }}
                             >
                               <Trash2 className="h-4 w-4" />
                             </Button>
                           </div>
                        </div>
                        <CardDescription>{plan.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                           {/* Display pricing based on billing model */}
                           <div className="text-2xl font-bold">
                             {plan.is_custom ? (
                               <span>Custom pricing</span>
                             ) : plan.billing_model === 'percentage' ? (
                               <span>{plan.percentage_rate}% commission</span>
                             ) : plan.billing_model === 'fixed_per_unit' ? (
                               <span>
                                 {formatCurrency(plan.fixed_amount_per_unit || 0, plan.currency)}
                                 <span className="text-sm font-normal text-muted-foreground">
                                   /unit/{plan.billing_cycle}
                                 </span>
                               </span>
                             ) : plan.billing_model === 'tiered' ? (
                               <span className="text-lg">Tiered Pricing</span>
                             ) : null}
                           </div>
                          
                          {/* Show billing model badge */}
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {plan.billing_model === 'percentage' && 'Percentage'}
                              {plan.billing_model === 'fixed_per_unit' && 'Fixed Rate'}
                              {plan.billing_model === 'tiered' && 'Tiered'}
                            </Badge>
                            <Badge variant={plan.is_active ? "default" : "secondary"}>
                              {plan.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          
                          {/* Show tier pricing summary for tiered plans */}
                          {plan.billing_model === 'tiered' && plan.tier_pricing && plan.tier_pricing.length > 0 && (
                            <div className="text-sm text-muted-foreground">
                              {plan.tier_pricing.length} pricing tiers
                            </div>
                          )}
                          
                          <div className="text-sm text-muted-foreground">
                            {plan.max_properties === -1 ? 'Unlimited' : plan.max_properties} properties • {' '}
                            {plan.max_units === -1 ? 'Unlimited' : plan.max_units} units
                          </div>
                          
                          <div className="text-sm text-muted-foreground">
                            {plan.sms_credits_included} SMS credits included
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            {/* Custom Trial Management */}
            <Card>
              <CardHeader>
                <CardTitle>Flexible Trial Management</CardTitle>
                <CardDescription>
                  Create users with custom trial periods and manage existing trials
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CustomTrialManagement onTrialCreated={fetchBillingData} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Default Trial Settings</CardTitle>
                <CardDescription>
                  Configure default trial parameters for new users
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Default Trial Period (Days)</Label>
                    <Input
                      type="number"
                      value={billingSettings.trial_period_days}
                      onChange={(e) => setBillingSettings({
                        ...billingSettings,
                        trial_period_days: Number(e.target.value)
                      })}
                      disabled={!isEditingSettings}
                    />
                    <p className="text-xs text-muted-foreground">
                      Default trial period for new users
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Grace Period (Days)</Label>
                    <Input
                      type="number"
                      value={billingSettings.grace_period_days}
                      onChange={(e) => setBillingSettings({
                        ...billingSettings,
                        grace_period_days: Number(e.target.value)
                      })}
                      disabled={!isEditingSettings}
                    />
                    <p className="text-xs text-muted-foreground">
                      Extended access after trial expiration
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>SMS Cost per Unit</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={billingSettings.sms_cost_per_unit}
                      onChange={(e) => setBillingSettings({
                        ...billingSettings,
                        sms_cost_per_unit: Number(e.target.value)
                      })}
                      disabled={!isEditingSettings}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Auto Invoice Generation</Label>
                    <Switch
                      checked={billingSettings.auto_invoice_generation}
                      onCheckedChange={(checked) => setBillingSettings({
                        ...billingSettings,
                        auto_invoice_generation: checked
                      })}
                      disabled={!isEditingSettings}
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  {isEditingSettings ? (
                    <>
                      <Button variant="outline" onClick={() => setIsEditingSettings(false)}>
                        Cancel
                      </Button>
                      <Button onClick={updateBillingSettings}>
                        Save Settings
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => setIsEditingSettings(true)}>
                      <Settings className="h-4 w-4 mr-2" />
                      Edit Settings
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Plan Dialog */}
        {editingPlan && (
          <EditBillingPlanDialog
            plan={editingPlan}
            open={isEditingPlan}
            onClose={() => {
              setIsEditingPlan(false);
              setEditingPlan(null);
            }}
            onSave={updateBillingPlan}
            onDelete={deleteBillingPlan}
          />
        )}

        {/* Add Plan Dialog */}
        <EditBillingPlanDialog
          plan={isAddingPlan ? {
            id: '',
            name: newPlan.name || '',
            description: newPlan.description || '',
            price: newPlan.price || 0,
            billing_cycle: newPlan.billing_cycle || 'monthly',
            billing_model: newPlan.billing_model || 'percentage',
            percentage_rate: newPlan.percentage_rate,
            fixed_amount_per_unit: newPlan.fixed_amount_per_unit,
            tier_pricing: newPlan.tier_pricing,
            max_properties: newPlan.max_properties || 0,
            max_units: newPlan.max_units || 0,
            sms_credits_included: newPlan.sms_credits_included || 0,
            features: newPlan.features || [],
            is_active: newPlan.is_active !== false,
            is_custom: newPlan.is_custom || false,
            contact_link: newPlan.contact_link,
            currency: newPlan.currency || 'KES'
          } : null}
          open={isAddingPlan}
          onClose={() => setIsAddingPlan(false)}
          onSave={async (plan) => {
            // Update newPlan state and create the plan
            setNewPlan(plan);
            await createBillingPlan();
          }}
          onDelete={() => {}} // Not applicable for new plans
        />

        {/* Delete Confirmation Dialog */}
        <DeleteBillingPlanDialog
          plan={deletingPlan}
          open={isDeleteDialogOpen}
          onClose={() => {
            setIsDeleteDialogOpen(false);
            setDeletingPlan(null);
          }}
          onConfirm={() => {
            if (deletingPlan) {
              deleteBillingPlan(deletingPlan.id);
            }
          }}
        />
      </div>
    </DashboardLayout>
  );
};

export default BillingDashboard;
