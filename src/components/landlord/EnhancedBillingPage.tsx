import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { formatAmount, getCurrencySymbol } from "@/utils/currency";
import { usePaymentMethodMetadata } from "@/hooks/usePaymentMethodMetadata";
import { useUserCountry } from "@/hooks/useUserCountry";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LandlordServiceChargeMpesaDialog } from "./LandlordServiceChargeMpesaDialog";
import { useAuth } from "@/hooks/useAuth";
import { ServiceChargeInvoiceModal } from "./ServiceChargeInvoiceModal";
import { UnifiedPDFRenderer } from "@/utils/unifiedPDFRenderer";
import { TablePaginator } from "@/components/ui/table-paginator";
import { format } from "date-fns";
import { 
  CreditCard, 
  Smartphone, 
  Building2, 
  Calendar, 
  Download,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Clock,
  Receipt,
  DollarSign,
  ArrowRight,
  Settings,
  Star,
  Crown,
  Zap,
  Phone,
  Filter,
  Eye,
  FileText,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  MessageCircle,
  AlertCircle
} from "lucide-react";
import { useSmsUsage } from '@/hooks/useSmsUsage';
import { CreateSupportTicketDialog } from "@/components/support/CreateSupportTicketDialog";

interface EnhancedBillingData {
  current_plan: {
    id: string;
    name: string;
    billing_cycle: string;
    currency: string;
    next_billing_date?: string;
    features: string[];
    max_properties: number;
    max_units: number;
    sms_credits_included: number;
    billing_model: string;
    percentage_rate?: number;
    fixed_amount_per_unit?: number;
  };
  sms_credits_balance: number;
  current_usage: {
    properties_count: number;
    units_count: number;
    this_month_rent_collected: number;
    calculated_service_charge: number;
    sms_credits_used?: number;
    sms_charges?: number;
    transactions: any[];
  };
  service_charge_invoices: {
    id: string;
    invoice_number: string;
    billing_period_start: string;
    billing_period_end: string;
    rent_collected: number;
    service_charge_amount: number;
    sms_charges: number;
    whatsapp_charges?: number;
    other_charges?: number;
    total_amount: number;
    status: string;
    due_date: string;
    payment_date?: string;
    currency: string;
  }[];
  approved_payment_methods: {
    id: string;
    payment_method_type: string;
    provider_name: string;
    is_active: boolean;
    country_code: string;
    configuration: any;
  }[];
  payment_preferences: {
    preferred_payment_method: string;
    mpesa_phone_number?: string;
    auto_payment_enabled: boolean;
    payment_reminders_enabled: boolean;
  };
}

export const EnhancedBillingPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { primaryCountry } = useUserCountry();
  const { getIcon, getLabel } = usePaymentMethodMetadata(primaryCountry);
  const smsUsage = useSmsUsage();
  const [billingData, setBillingData] = useState<EnhancedBillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const [showInvoiceDetails, setShowInvoiceDetails] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showMpesaDialog, setShowMpesaDialog] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<any>(null);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const invoicesPageSize = 10;

  const handlePaymentSuccess = () => {
    setShowMpesaDialog(false);
    setSelectedInvoiceForPayment(null);
    fetchBillingData();
    toast({
      title: "Payment Success",
      description: "Payment completed successfully!",
    });
  };

  useEffect(() => {
    if (user) {
      fetchBillingData();
      
      // Set up real-time subscription for invoice updates
      const channel = supabase
        .channel('billing-updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'service_charge_invoices',
            filter: `landlord_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Invoice updated:', payload);
            // Refresh billing data when invoice status changes
            fetchBillingData();
            
            // Show toast notification for payment updates
            if (payload.new.status === 'paid' && payload.old.status === 'pending') {
              toast({
                title: "Payment Received!",
                description: `Invoice ${payload.new.invoice_number} has been paid successfully.`,
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, invoicesPage]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      
      // Fetch current subscription
      const { data: subscription, error: subError } = await supabase
        .from('landlord_subscriptions')
        .select(`
          *,
          billing_plan:billing_plans(*)
        `)
        .eq('landlord_id', user?.id)
        .single();

      if (subError) throw subError;

      // Fetch current usage metrics
      const { data: propertiesData } = await supabase
        .from('properties')
        .select('id, country')
        .eq('owner_id', user?.id);

      const { data: unitsData } = await supabase
        .from('units')
        .select('id, property_id')
        .in('property_id', propertiesData?.map(p => p.id) || []);

      // Fetch this month's payments to calculate service charges
      const currentMonth = new Date();
      const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const { data: thisMonthPayments } = await supabase
        .from('payments')
        .select(`
          *,
          tenant:tenants(first_name, last_name),
          lease:leases(
            unit:units(
              unit_number,
              property:properties!units_property_id_fkey(name)
            )
          )
        `)
        .gte('payment_date', firstDay.toISOString().split('T')[0])
        .eq('status', 'completed')
        .in('lease.unit.property_id', propertiesData?.map(p => p.id) || [])
        .order('payment_date', { ascending: false });

      const thisMonthRentCollected = thisMonthPayments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;

      // Calculate service charge based on billing model
      let calculatedServiceCharge = 0;
      if (subscription?.billing_plan) {
        const plan = subscription.billing_plan;
        if (plan.billing_model === 'percentage' && plan.percentage_rate) {
          calculatedServiceCharge = (thisMonthRentCollected * plan.percentage_rate) / 100;
        } else if (plan.billing_model === 'fixed_per_unit' && plan.fixed_amount_per_unit) {
          calculatedServiceCharge = (unitsData?.length || 0) * Number(plan.fixed_amount_per_unit);
        }
      }

        // Fetch service charge invoices with pagination
        const invoicesOffset = (invoicesPage - 1) * invoicesPageSize;
        const { data: serviceInvoices, error: invoicesError, count: invoicesCount } = await supabase
          .from('service_charge_invoices')
          .select('*', { count: 'exact' })
          .eq('landlord_id', user?.id)
          .order('created_at', { ascending: false })
          .range(invoicesOffset, invoicesOffset + invoicesPageSize - 1);

      if (invoicesError) throw invoicesError;

      // Determine country code for payment methods
      const countryCode = propertiesData?.[0]?.country === 'Kenya' ? 'KE' : 'KE'; // Default to KE

      // Fetch approved payment methods
      const { data: paymentMethods, error: pmError } = await supabase
        .from('approved_payment_methods')
        .select('*')
        .eq('country_code', countryCode)
        .eq('is_active', true);

      if (pmError) throw pmError;

      // Fetch payment preferences
      const { data: preferences } = await supabase
        .from('landlord_payment_preferences')
        .select('*')
        .eq('landlord_id', user?.id)
        .single();

        setBillingData({
          current_plan: {
            id: subscription?.billing_plan?.id || '',
            name: subscription?.billing_plan?.name || 'Professional',
            billing_cycle: subscription?.billing_plan?.billing_cycle || 'monthly',
            currency: subscription?.billing_plan?.currency || 'KES',
            next_billing_date: subscription?.next_billing_date,
            features: Array.isArray(subscription?.billing_plan?.features) 
              ? subscription.billing_plan.features.map(f => String(f))
              : ['Property Management', 'Tenant Communication', 'Payment Processing', 'Maintenance Tracking'],
            max_properties: subscription?.billing_plan?.max_properties || 0,
            max_units: subscription?.billing_plan?.max_units || 0,
            sms_credits_included: subscription?.billing_plan?.sms_credits_included || 0,
            billing_model: subscription?.billing_plan?.billing_model || 'percentage',
            percentage_rate: subscription?.billing_plan?.percentage_rate,
            fixed_amount_per_unit: subscription?.billing_plan?.fixed_amount_per_unit,
          },
          sms_credits_balance: subscription?.sms_credits_balance || 100,
          current_usage: {
            properties_count: propertiesData?.length || 0,
            units_count: unitsData?.length || 0,
            this_month_rent_collected: thisMonthRentCollected,
            calculated_service_charge: calculatedServiceCharge,
            sms_credits_used: 0, // Will be calculated from actual SMS usage
            sms_charges: 7.50, // Sample SMS charges for demo (3 messages × 2.50)
            transactions: thisMonthPayments || []
          },
          // Add sample data if no invoices exist
          service_charge_invoices: serviceInvoices && serviceInvoices.length > 0 
            ? serviceInvoices.map(invoice => ({
            id: invoice.id,
            invoice_number: invoice.invoice_number,
            billing_period_start: invoice.billing_period_start,
            billing_period_end: invoice.billing_period_end,
            rent_collected: invoice.rent_collected,
            service_charge_amount: invoice.service_charge_amount,
            sms_charges: invoice.sms_charges,
            whatsapp_charges: (invoice as any).whatsapp_charges || 0,
            other_charges: invoice.other_charges,
            total_amount: invoice.total_amount,
            status: invoice.status,
            due_date: invoice.due_date,
            payment_date: invoice.payment_date,
            currency: invoice.currency
          }))
            : [], // No sample data - use empty array when no invoices exist
          approved_payment_methods: paymentMethods || [],
          payment_preferences: {
            preferred_payment_method: preferences?.preferred_payment_method || 'mpesa',
            mpesa_phone_number: preferences?.mpesa_phone_number,
            auto_payment_enabled: preferences?.auto_payment_enabled || false,
            payment_reminders_enabled: preferences?.payment_reminders_enabled || true
          }
        });

        setTotalInvoices(invoicesCount || 0);

    } catch (error) {
      console.error('Error fetching billing data:', error);
      toast({
        title: "Error",
        description: "Failed to load billing information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency?: string) => {
    return formatAmount(amount, currency);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'overdue':
        return <Badge className="bg-red-100 text-red-800"><AlertTriangle className="h-3 w-3 mr-1" />Overdue</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const generateServiceInvoice = async () => {
    if (!user?.id) return;
    
    setIsGeneratingInvoice(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-service-invoice', {
        body: {
          landlord_id: user.id,
          billing_period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
          billing_period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
        }
      });

      if (error) {
        console.error('Error generating service invoice:', error);
        toast({
          title: "Error",
          description: "Failed to generate service invoice. Please try again.",
          variant: "destructive"
        });
        return;
      }

      if (data?.success) {
        toast({
          title: "Success",
          description: "Service invoice generated successfully!",
          variant: "default"
        });
        
        // Refresh billing data
        fetchBillingData();
      } else {
        toast({
          title: "Info",
          description: data?.message || "Service invoice generation completed with issues.",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Error in generateServiceInvoice:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const generateMonthlyInvoices = async () => {
    if (!user?.id) return;
    
    setIsGeneratingInvoice(true);
    try {
      const { data, error } = await supabase.functions.invoke('automated-monthly-billing', {
        body: {
          source: "manual_trigger",
          landlord_id: user.id
        }
      });

      if (error) {
        console.error('Error generating monthly invoices:', error);
        toast({
          title: "Error",
          description: "Failed to generate monthly invoices. Please try again.",
          variant: "destructive"
        });
        return;
      }

      if (data?.success) {
        toast({
          title: "Success",
          description: `Monthly invoices generated successfully! Processed ${data.processed} landlords.`,
          variant: "default"
        });
        
        // Refresh billing data
        fetchBillingData();
      } else {
        toast({
          title: "Info",
          description: data?.message || "Monthly invoice generation completed with issues.",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('Error in generateMonthlyInvoices:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingInvoice(false);
    }
  };
  const getPlanIcon = (planName: string) => {
    switch (planName?.toLowerCase()) {
      case 'starter':
        return <Zap className="h-6 w-6 text-blue-500" />;
      case 'professional':
        return <Star className="h-6 w-6 text-purple-500" />;
      case 'enterprise':
        return <Crown className="h-6 w-6 text-amber-500" />;
      default:
        return <CreditCard className="h-6 w-6 text-gray-500" />;
    }
  };

  const getPaymentMethodIcon = (type: string) => {
    const IconComponent = getIcon(type);
    return <IconComponent className="h-8 w-8" />;
  };

  const getPaymentMethodLabel = (type: string, provider: string) => {
    const label = getLabel(type);
    return { title: label, description: provider || type };
  };

  const handleInvoicePayment = (invoice: any) => {
    setSelectedInvoiceForPayment(invoice);
    setShowMpesaDialog(true);
  };

  const downloadInvoice = async (invoice: any) => {
    try {
      // Get landlord info for PDF generation
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, phone')
        .eq('id', user?.id)
        .single();

      if (!profile) {
        toast({
          title: "Error",
          description: "Unable to load profile information",
          variant: "destructive",
        });
        return;
      }

      const landlordInfo = {
        name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Landlord',
        email: profile.email || user?.email || '',
        phone: profile.phone
      };

      const { generateServiceChargeInvoicePDF } = await import('@/utils/serviceChargeInvoicePDF');
      await generateServiceChargeInvoicePDF(invoice, landlordInfo);

      toast({
        title: "Invoice Downloaded",
        description: `Invoice ${invoice.invoice_number} has been downloaded`,
      });
    } catch (error) {
      console.error('Error downloading invoice:', error);
      toast({
        title: "Download Failed",
        description: "Unable to download the invoice. Please try again.",
        variant: "destructive",
      });
    }
  };

  const initiatePayment = async (methodType: string, invoiceId?: string) => {
    const amount = billingData?.current_usage.calculated_service_charge || 0;
    
    if (amount <= 0) {
      toast({
        title: "No Payment Due",
        description: "You don't have any outstanding service charges at the moment.",
        variant: "default",
      });
      return;
    }

    if (methodType === 'mpesa') {
      const phoneNumber = billingData?.payment_preferences.mpesa_phone_number;
      if (!phoneNumber) {
        toast({
          title: "M-Pesa Phone Required",
          description: "Please set up your M-Pesa phone number in payment settings.",
          variant: "destructive",
        });
        return;
      }

      try {
        console.log('Initiating M-Pesa payment:', {
          phone: phoneNumber,
          amount: amount,
          invoiceId: invoiceId || 'service-charge'
        });

        // Integrate with existing M-Pesa STK push
        const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
          body: {
            phone: phoneNumber,
            amount: amount,
            accountReference: `ZIRA-SERVICE-${Date.now()}`,
            transactionDesc: 'Service charge payment',
            invoiceId: invoiceId,
            paymentType: 'service-charge'
          }
        });

        console.log('M-Pesa response:', { data, error });

        if (error) {
          console.error('M-Pesa function error:', error);
          throw new Error(error.message || 'Failed to initiate M-Pesa payment');
        }

        if (data?.success) {
          toast({
            title: "M-Pesa Payment Initiated",
            description: `STK push sent to ${phoneNumber}. Please complete payment on your phone.`,
          });
        } else {
          throw new Error(data?.error || 'STK push failed');
        }
      } catch (error) {
        console.error('M-Pesa payment error:', error);
        toast({
          title: "Payment Failed",
          description: error instanceof Error ? error.message : "Failed to initiate M-Pesa payment. Please try again.",
          variant: "destructive",
        });
      }
    } else if (methodType === 'bank_transfer' || methodType === 'bank') {
      // Bank Transfer - Show instructions
      toast({
        title: "Bank Transfer Instructions",
        description: "Bank details will be displayed. Please transfer and submit proof of payment.",
      });
      // TODO: Implement bank transfer dialog with account details and receipt upload
    } else if (methodType === 'cash') {
      // Cash Payment - Record manual payment
      try {
        const { data, error } = await supabase
          .from('payment_transactions')
          .insert({
            landlord_id: user?.id,
            amount: amount,
            payment_method: 'cash',
            status: 'pending_verification',
            transaction_id: `CASH-${Date.now()}`
          });

        if (error) throw error;

        toast({
          title: "Cash Payment Recorded",
          description: "Your cash payment has been recorded and is pending admin verification.",
        });
        fetchBillingData();
      } catch (error) {
        console.error('Error recording cash payment:', error);
        toast({
          title: "Error",
          description: "Failed to record cash payment",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Payment Method",
        description: `${methodType} payment integration coming soon...`,
      });
    }
  };

  const filteredInvoices = billingData?.service_charge_invoices.filter(invoice => 
    filterStatus === 'all' || invoice.status === filterStatus
  ) || [];

  const viewInvoiceDetails = (invoice: any) => {
    setShowInvoiceDetails(invoice.id);
  };

  const selectedInvoiceForModal = showInvoiceDetails 
    ? billingData?.service_charge_invoices.find(inv => inv.id === showInvoiceDetails) || null
    : null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!billingData) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Unable to load billing information. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">

      {/* Current Plan Summary */}
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full" />
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getPlanIcon(billingData.current_plan.name)}
              <div>
                <CardTitle className="text-xl">
                  {billingData.current_plan.name} Plan
                </CardTitle>
                <CardDescription>
                  Property Management Services by Zira Homes
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700">
              Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {billingData.current_plan.billing_model === 'percentage' 
                  ? `${billingData.current_plan.percentage_rate}%`
                  : billingData.current_plan.billing_model === 'fixed_per_unit'
                  ? formatCurrency(billingData.current_plan.fixed_amount_per_unit || 0, billingData.current_plan.currency)
                  : 'Tiered'}
              </div>
              <div className="text-sm text-muted-foreground">
                {billingData.current_plan.billing_model === 'percentage' 
                  ? 'of rent income'
                  : billingData.current_plan.billing_model === 'fixed_per_unit'
                  ? `per unit/${billingData.current_plan.billing_cycle}`
                  : 'pricing model'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {billingData.current_usage.properties_count}
              </div>
              <div className="text-sm text-muted-foreground">
                Properties ({billingData.current_plan.max_properties === 0 ? '∞' : billingData.current_plan.max_properties} limit)
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {billingData.current_usage.units_count}
              </div>
              <div className="text-sm text-muted-foreground">
                Units ({billingData.current_plan.max_units === 0 ? '∞' : billingData.current_plan.max_units} limit)
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {billingData.sms_credits_balance}
              </div>
              <div className="text-sm text-muted-foreground">SMS Credits</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {billingData.current_plan.next_billing_date 
                  ? new Date(billingData.current_plan.next_billing_date).toLocaleDateString()
                  : '-'
                }
              </div>
              <div className="text-sm text-muted-foreground">Next Billing</div>
            </div>
          </div>

          {/* Current Usage & Service Charges */}
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-3">This Month's Activity</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-accent/50 p-3 rounded-lg">
                <div className="text-lg font-semibold">
                  {formatCurrency(billingData.current_usage.this_month_rent_collected, billingData.current_plan.currency)}
                </div>
                <div className="text-sm text-muted-foreground">Rent Collected</div>
              </div>
              <div className="bg-accent/50 p-3 rounded-lg">
                <div className="text-lg font-semibold text-primary">
                  {formatCurrency(billingData.current_usage.calculated_service_charge, billingData.current_plan.currency)}
                </div>
                <div className="text-sm text-muted-foreground">Service Charge</div>
              </div>
              <div className="bg-accent/50 p-3 rounded-lg">
                <div className="text-lg font-semibold text-green-600">
                  {formatCurrency(
                    billingData.current_usage.this_month_rent_collected - billingData.current_usage.calculated_service_charge, 
                    billingData.current_plan.currency
                  )}
                </div>
                <div className="text-sm text-muted-foreground">Your Earnings</div>
              </div>
            </div>
          </div>

          {/* Plan Features */}
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-2">Plan Features</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {billingData.current_plan.features.map((feature, index) => (
                <div key={index} className="flex items-center text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                  {feature}
                </div>
              ))}
            </div>
          </div>

          {/* Plan Management */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Need to change your plan?</h4>
                <p className="text-sm text-muted-foreground">Contact our support team to discuss plan changes</p>
              </div>
              <CreateSupportTicketDialog
                defaultTitle="Plan Change Request"
                defaultCategory="billing"
                defaultDescription={`Hi, I would like to request a change to my billing plan.

Current Plan: ${billingData.current_plan.name}
Current Rate: ${billingData.current_plan.billing_model === 'percentage' 
  ? `${billingData.current_plan.percentage_rate}% of rent income`
  : billingData.current_plan.billing_model === 'fixed_per_unit'
  ? `${formatCurrency(billingData.current_plan.fixed_amount_per_unit || 0, billingData.current_plan.currency)} per unit`
  : 'Tiered pricing'}

Please help me understand available options and guide me through the process.

Thank you!`}
              >
                <Button variant="outline" size="sm">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Request Plan Change
                </Button>
              </CreateSupportTicketDialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Due & Quick Actions */}
      <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-orange-600" />
            Outstanding Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-orange-600">
                  {(() => {
                    // Calculate total outstanding from pending invoices
                    const pendingInvoices = billingData.service_charge_invoices?.filter(inv => inv.status === 'pending') || [];
                    const totalOutstanding = pendingInvoices.reduce((sum, invoice) => sum + invoice.total_amount, 0);
                    return formatCurrency(totalOutstanding);
                  })()}
                </div>
                <p className="text-muted-foreground">Current month service charge due</p>
                <p className="text-sm text-muted-foreground">Due: {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={async () => {
                    const currentInvoice = billingData.service_charge_invoices.find(inv => inv.status === 'pending');
                    if (currentInvoice) {
                      setSelectedInvoiceForPayment(currentInvoice);
                      setShowMpesaDialog(true);
                    } else {
                      // Generate a real service charge invoice first
                      await generateServiceInvoice();
                      // After generating, find the newly created invoice
                      const updatedBillingData = await fetchBillingData();
                      const newPendingInvoice = billingData.service_charge_invoices.find(inv => inv.status === 'pending');
                      if (newPendingInvoice) {
                        setSelectedInvoiceForPayment(newPendingInvoice);
                        setShowMpesaDialog(true);
                      }
                    }
                  }}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <Smartphone className="h-4 w-4 mr-2" />
                  Pay with M-Pesa
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/payment-settings">
                    <Settings className="h-4 w-4 mr-2" />
                    Payment Settings
                  </Link>
                </Button>
              </div>
            </div>

            {/* Cost Breakdown Toggle */}
            <div className="pt-3 border-t">
              <Button 
                variant="ghost" 
                className="w-full justify-between p-0 h-auto"
                onClick={() => setIsBreakdownOpen(!isBreakdownOpen)}
              >
                <span className="text-sm font-medium">View cost breakdown</span>
                {isBreakdownOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
              
              {isBreakdownOpen && (
                <div className="space-y-2 mt-3">
                  <div className="border rounded-lg p-3 bg-background/50">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Service Charge ({billingData.current_plan.percentage_rate || 0}%)</span>
                        <span className="font-medium">
                          {formatCurrency(billingData.current_usage.calculated_service_charge, billingData.current_plan.currency)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground pl-2">
                        Based on rent collected: {formatCurrency(billingData.current_usage.this_month_rent_collected, billingData.current_plan.currency)}
                      </div>
                      
                      {/* SMS Charges - Show real usage */}
                      <div className="flex justify-between items-center pt-1 border-t">
                        <span className="text-sm text-muted-foreground flex items-center">
                          <MessageSquare className="h-4 w-4 mr-1" />
                          SMS Notifications ({smsUsage.data?.current_month_count || 0} messages)
                        </span>
                        <span className="font-medium">
                          {formatCurrency(smsUsage.data?.current_month_cost || 0, billingData.current_plan.currency)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-center pt-2 border-t font-semibold">
                        <span className="text-sm">Total Due</span>
                        <span className="text-orange-600">
                          {formatCurrency(
                            billingData.current_usage.calculated_service_charge + (smsUsage.data?.current_month_cost || 0), 
                            billingData.current_plan.currency
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    <p>• Service charge is calculated as a percentage of successfully collected rent</p>
                    {smsUsage.data?.current_month_count > 0 && (
                      <p>• SMS charges: {smsUsage.data.current_month_count} messages sent this month</p>
                    )}
                    {smsUsage.data?.current_month_count === 0 && (
                      <p>• SMS charges: No messages sent this month</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Methods Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CreditCard className="h-5 w-5 mr-2" />
            Payment Methods
          </CardTitle>
          <CardDescription>
            Your configured payment options
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {billingData.approved_payment_methods.length > 0 ? (
              <>
                {/* Primary Payment Method */}
                {billingData.payment_preferences.preferred_payment_method && (
                  <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center space-x-3">
                      {getPaymentMethodIcon(billingData.payment_preferences.preferred_payment_method)}
                      <div>
                        <p className="font-medium">
                          {getPaymentMethodLabel(
                            billingData.payment_preferences.preferred_payment_method,
                            billingData.approved_payment_methods.find(m => m.payment_method_type === billingData.payment_preferences.preferred_payment_method)?.provider_name || ''
                          ).title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {billingData.payment_preferences.mpesa_phone_number || 'Configure in settings'}
                        </p>
                      </div>
                      <Badge>Primary</Badge>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/landlord/payment-settings">
                        <Settings className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                )}

                {/* Alternative Methods */}
                {billingData.approved_payment_methods.length > 1 && (
                  <div className="grid grid-cols-2 gap-3">
                    {billingData.approved_payment_methods
                      .filter(method => method.payment_method_type !== billingData.payment_preferences.preferred_payment_method)
                      .slice(0, 2)
                      .map(method => (
                        <div key={method.id} className="flex items-center p-3 bg-gray-50 rounded-lg">
                          {getPaymentMethodIcon(method.payment_method_type)}
                          <div className="ml-2">
                            <p className="text-sm font-medium">
                              {getPaymentMethodLabel(method.payment_method_type, method.provider_name).title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {getPaymentMethodLabel(method.payment_method_type, method.provider_name).description}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-6">
                <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground mb-2">No payment methods configured</p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/landlord/payment-settings">
                    <Settings className="h-4 w-4 mr-2" />
                    Configure Payment Methods
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Billing History & Service Charges */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Receipt className="h-5 w-5 mr-2" />
                Billing History & Service Charges
              </CardTitle>
              <CardDescription>
                Your monthly service charge invoices and payment history
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <div className="text-lg font-medium">No billing history available</div>
              <p className="text-muted-foreground">
                Service charge invoices will appear here once generated
              </p>
            </div>
          ) : (
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Rent Collected</TableHead>
                    <TableHead>Charges Breakdown</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell>
                        {new Date(invoice.billing_period_start).toLocaleDateString()} - {' '}
                        {new Date(invoice.billing_period_end).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(invoice.rent_collected, invoice.currency)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">
                            <span className="text-muted-foreground">Service:</span> {formatCurrency(invoice.service_charge_amount, invoice.currency)}
                          </div>
                          {(invoice.sms_charges || 0) > 0 && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">SMS:</span> {formatCurrency(invoice.sms_charges, invoice.currency)}
                            </div>
                          )}
                          {(invoice.other_charges || 0) > 0 && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">Admin:</span> {formatCurrency(invoice.other_charges, invoice.currency)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(invoice.total_amount, invoice.currency)}
                      </TableCell>
                      <TableCell>
                        {new Date(invoice.due_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(invoice.status)}
                      </TableCell>
                       <TableCell>
                         <div className="flex items-center space-x-1">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="hover:bg-blue-50 hover:text-blue-700"
                              onClick={() => viewInvoiceDetails(invoice)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="hover:bg-green-50 hover:text-green-700"
                              onClick={() => downloadInvoice(invoice)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Download
                            </Button>
                            {invoice.status === 'pending' && (
                              <Button 
                                variant="default" 
                                size="sm" 
                                className="bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => handleInvoicePayment(invoice)}
                              >
                                <CreditCard className="h-4 w-4 mr-1" />
                                Pay Now
                              </Button>
                            )}
                            {invoice.status === 'paid' && (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Paid
                              </Badge>
                            )}
                         </div>
                       </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {Math.ceil(totalInvoices / invoicesPageSize) > 1 && (
                <div className="mt-4">
                  <TablePaginator
                    currentPage={invoicesPage}
                    totalPages={Math.ceil(totalInvoices / invoicesPageSize)}
                    pageSize={invoicesPageSize}
                    totalItems={totalInvoices}
                    onPageChange={setInvoicesPage}
                    showPageSizeSelector={false}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

          {/* Detailed Transactions for Reconciliation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Receipt className="h-5 w-5 mr-2" />
                Transaction Details - {format(new Date(), 'MMMM yyyy')}
              </CardTitle>
              <CardDescription>
                All tenant payments that contribute to your service charge calculation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {billingData.current_usage.transactions && billingData.current_usage.transactions.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">
                        {billingData.current_usage.transactions.length}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Transactions</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(billingData.current_usage.this_month_rent_collected)}
                      </div>
                      <div className="text-sm text-muted-foreground">Total Collected</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {formatCurrency(billingData.current_usage.calculated_service_charge)}
                      </div>
                      <div className="text-sm text-muted-foreground">Service Charge Due</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Tenant</TableHead>
                          <TableHead>Property/Unit</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Receipt</TableHead>
                          <TableHead>Service Charge</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {billingData.current_usage.transactions.map((transaction, index) => {
                          const serviceChargeOnThis = (Number(transaction.amount) * (billingData.current_plan?.percentage_rate || 3)) / 100;
                          return (
                            <TableRow key={index}>
                              <TableCell className="font-medium">
                                {format(new Date(transaction.payment_date), 'MMM dd, yyyy')}
                              </TableCell>
                              <TableCell>
                                {transaction.tenant ? 
                                  `${transaction.tenant.first_name || ''} ${transaction.tenant.last_name || ''}`.trim() || 'Unknown'
                                  : 'Unknown'
                                }
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="font-medium">
                                    {transaction.lease?.unit?.property?.name || 'Unknown Property'}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    Unit: {transaction.lease?.unit?.unit_number || 'N/A'}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">
                                {formatCurrency(Number(transaction.amount))}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {transaction.payment_method || 'Cash'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {transaction.transaction_id || transaction.payment_reference || 'N/A'}
                              </TableCell>
                              <TableCell className="font-medium text-orange-600">
                                {formatCurrency(serviceChargeOnThis)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="text-sm text-blue-700 dark:text-blue-300">
                        <p><strong>Reconciliation Note:</strong> These transactions show all tenant payments collected in {format(new Date(), 'MMMM yyyy')} from your properties. Each payment contributes {billingData.current_plan?.percentage_rate || 3}% to your service charge calculation.</p>
                        <p className="mt-1">The service charge invoice will be automatically generated/updated when tenants make payments throughout the month.</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No transactions recorded for {format(new Date(), 'MMMM yyyy')} yet.</p>
                  <p className="text-sm mt-1">Transactions will appear here as tenants make payments.</p>
                </div>
              )}
            </CardContent>
          </Card>

      {/* Service Charge Invoice Modal */}
      {selectedInvoiceForModal && (
        <ServiceChargeInvoiceModal
          isOpen={!!showInvoiceDetails}
          onClose={() => setShowInvoiceDetails(null)}
          invoice={selectedInvoiceForModal}
          landlordInfo={{
            name: `${billingData?.current_plan?.name || 'Property'} Owner`,
            email: user?.email || '',
          }}
        />
      )}

      {/* M-Pesa Payment Dialog */}
      {selectedInvoiceForPayment && (
        <LandlordServiceChargeMpesaDialog
          open={showMpesaDialog}
          onOpenChange={setShowMpesaDialog}
          invoice={selectedInvoiceForPayment}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};
