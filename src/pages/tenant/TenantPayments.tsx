import React, { useState, useEffect, useMemo, lazy, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePaginator } from "@/components/ui/table-paginator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TenantLayout } from "@/components/TenantLayout";
import {
  CreditCard,
  Download,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  Calendar,
  Receipt,
  Smartphone,
  Search,
  Filter,
  FileText,
  Building,
  Home,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { TenantPaymentSettings } from "@/components/tenant/TenantPaymentSettings";
import { BankPaymentGuide } from "@/components/tenant/BankPaymentGuide";
import { MpesaErrorBoundary } from "@/components/mpesa/MpesaErrorBoundary";
import { formatInvoiceNumber, formatPaymentReference, formatReceiptNumber, getInvoiceDescription, linkPaymentToInvoice } from "@/utils/invoiceFormat";
import { fmtCurrency, fmtDate } from "@/lib/format";
import { measureApiCall } from "@/utils/performanceMonitor";
import { useMpesaAvailability } from "@/hooks/useMpesaAvailability";
import { isInvoicePayable, isInvoiceOutstanding, getInvoiceStatusLabel } from "@/utils/invoiceStatusUtils";
import { TenantCreditBalance } from "@/components/tenant/TenantCreditBalance";
import { ApplyCreditDialog } from "@/components/tenant/ApplyCreditDialog";

// Lazy load dialog components for better performance
const MpesaPaymentDialog = lazy(() => import("@/components/tenant/MpesaPaymentDialog").then(module => ({ default: module.MpesaPaymentDialog })));
const TenantInvoiceDetailsDialog = lazy(() => import("@/components/tenant/TenantInvoiceDetailsDialog").then(module => ({ default: module.TenantInvoiceDetailsDialog })));

interface PaymentData {
  invoices: any[];
  payments: any[];
  tenant: any;
  inferredInvoices: any[];
  credits: any[];
  totalCreditBalance: number;
}

interface FilterState {
  search: string;
  status: string;
  dateRange: string;
}

// RPC result interfaces
interface TenantPaymentsRpcResult {
  tenant: any;
  invoices: any[];
  payments: any[];
  credits: any[];
  total_credit_balance: number;
  error?: string;
}

export default function TenantPayments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isChecking, checkAvailability, lastErrorType, lastErrorDetails, lastCheck, lastCheckTimestamp } = useMpesaAvailability();
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [mpesaDialogOpen, setMpesaDialogOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "all",
    dateRange: "all"
  });
  
  // Pagination states
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    if (user) {
      fetchPaymentData();
    }
  }, [user]);

  // Realtime subscription for invoice updates
  useEffect(() => {
    if (!user || !paymentData?.tenant?.id) return;
    
    console.log('📡 Setting up realtime subscription for invoice updates...');
    
    const channel = supabase
      .channel('invoice-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'invoices',
        filter: `tenant_id=eq.${paymentData.tenant.id}`
      }, (payload) => {
        console.log('📡 Invoice updated via realtime, refreshing data...', payload);
        fetchPaymentData();
      })
      .subscribe();
    
    return () => {
      console.log('🔌 Unsubscribing from invoice updates');
      supabase.removeChannel(channel);
    };
  }, [user, paymentData?.tenant?.id]);

  const fetchPaymentData = async () => {
    try {
      const result = await measureApiCall('tenant-payments-fetch', async () => {
        console.log("🔍 Fetching optimized tenant payment data using RPC for user:", user?.id);
        
        // Use optimized RPC function for better performance
        const { data: rpcResult, error: rpcError } = await supabase
          .rpc('get_tenant_payments_data', {
            p_user_id: user?.id,
            p_limit: 100
          });

        if (rpcError) {
          console.error("❌ Error calling tenant payments RPC:", rpcError);
          throw rpcError;
        }

        const typedResult = rpcResult as unknown as TenantPaymentsRpcResult | null;

        if (!typedResult || typedResult.error) {
          console.log("❌ No tenant found or RPC error:", typedResult?.error);
          setPaymentData({
            invoices: [],
            payments: [],
            tenant: null,
            inferredInvoices: [],
            credits: [],
            totalCreditBalance: 0,
          });
          return;
        }

        console.log("✅ RPC result received:", {
          tenant: typedResult.tenant?.id,
          invoices: typedResult.invoices?.length || 0,
          payments: typedResult.payments?.length || 0
        });

        // Transform invoices to match expected structure with owner_id, landlord info, and tenant info for PDF generation
        const invoices = (typedResult.invoices || []).map(invoice => ({
          ...invoice,
          lease_id: invoice.lease_id, // Preserve for landlord lookup
          // Include outstanding_amount and amount_paid from RPC
          outstanding_amount: Number(invoice.outstanding_amount) || 0,
          amount_paid: Number(invoice.amount_paid) || 0,
          leases: {
            units: {
              unit_number: invoice.unit_number,
              properties: {
                name: invoice.property_name,
                owner_id: invoice.owner_id // Include for PDF landlord billing data
              }
            }
          },
          // Include landlord info from RPC for tenant PDF generation (bypasses RLS)
          landlordInfo: {
            firstName: invoice.landlord_first_name,
            lastName: invoice.landlord_last_name,
            email: invoice.landlord_email,
            phone: invoice.landlord_phone
          },
          // Include tenant info from RPC for PDF Bill To section
          tenantInfo: {
            firstName: invoice.tenant_first_name,
            lastName: invoice.tenant_last_name,
            email: invoice.tenant_email,
            phone: invoice.tenant_phone
          }
        }));

        return { 
          tenant: typedResult.tenant, 
          invoices, 
          payments: typedResult.payments || [],
          credits: typedResult.credits || [],
          totalCreditBalance: Number(typedResult.total_credit_balance) || 0
        };
      });

      if (!result) return;

      const { tenant, invoices, payments, credits, totalCreditBalance } = result;

      // Link payments to invoices and create enhanced payment data
      const enhancedPayments = payments.map(payment => {
        const linkResult = linkPaymentToInvoice(payment, invoices);
        
        // If payment has invoice_id but no linked invoice found, create an inferred one
        let linkedInvoice = linkResult.linkedInvoice;
        let linkQuality = linkResult.linkQuality;
        let linkReason = linkResult.linkReason;
        
        if (payment.invoice_id && !linkedInvoice) {
          // Create inferred invoice from payment data when invoice exists but isn't accessible
          linkedInvoice = {
            id: payment.invoice_id,
            invoice_number: formatInvoiceNumber(payment.payment_reference || payment.transaction_id),
            amount: payment.amount,
            status: 'paid',
            invoice_date: payment.payment_date,
            due_date: payment.payment_date,
            description: getInvoiceDescription({ isInferred: true, sourcePayment: payment }),
            isInferred: true,
            tenants: null,
            leases: null
          };
          linkQuality = 'exact';
          linkReason = 'Inferred from payment data (invoice exists but not accessible)';
        }
        
        return {
          ...payment,
          linkedInvoice,
          linkQuality,
          linkReason,
          formattedReference: formatPaymentReference(payment.payment_reference || payment.transaction_id)
        };
      });

      // Create inferred invoices only for payments with no accessible invoice
      const inferredInvoices = enhancedPayments
        .filter(payment => !payment.linkedInvoice && payment.linkQuality === 'none')
        .map(payment => ({
          id: `inferred-${payment.id}`,
          invoice_number: formatInvoiceNumber(payment.payment_reference || payment.transaction_id),
          amount: payment.amount,
          status: 'paid',
          invoice_date: payment.payment_date,
          due_date: payment.payment_date,
          description: getInvoiceDescription({ isInferred: true, sourcePayment: payment }),
          isInferred: true,
          sourcePayment: payment
        }));

      setPaymentData({
        invoices,
        payments: enhancedPayments,
        tenant,
        inferredInvoices,
        credits: credits || [],
        totalCreditBalance: totalCreditBalance || 0,
      });
    } catch (error) {
      console.error("❌ Error fetching payment data:", error);
      toast({
        title: "Error",
        description: "Failed to load payment data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async (invoice: any) => {
    try {
      console.log('Starting invoice download from payments page...');
      toast({
        title: "Generating Invoice",
        description: "Please wait while we prepare your invoice for download...",
      });
      
      const { PDFTemplateService } = await import('@/utils/pdfTemplateService');
      const { UnifiedPDFRenderer } = await import('@/utils/unifiedPDFRenderer');
      const { getInvoiceBillingData } = await import('@/utils/invoiceBillingHelper');
      
      // Fetch actual landlord billing data
      const billingData = await getInvoiceBillingData(invoice);

      // Get template and branding from the unified service
      const { template, branding: brandingData } = await PDFTemplateService.getTemplateAndBranding(
        'invoice',
        'Admin'
      );
      
      const renderer = new UnifiedPDFRenderer();
      
      // Calculate payment breakdown for partially paid invoices
      const amountPaid = invoice.amount_paid || (invoice.outstanding_amount !== undefined 
        ? invoice.amount - invoice.outstanding_amount 
        : 0);
      const outstandingAmount = invoice.outstanding_amount ?? invoice.amount;

      const documentData = {
        type: 'invoice' as const,
        title: `Invoice ${invoice.invoice_number}`,
        content: {
          invoiceNumber: invoice.invoice_number,
          dueDate: new Date(invoice.due_date),
          items: [
            {
              description: invoice.description || 'Monthly Rent',
              amount: invoice.amount,
              quantity: 1
            }
          ],
          total: invoice.amount,
          // Payment breakdown for partially paid invoices
          amountPaid: amountPaid,
          outstandingAmount: outstandingAmount,
          recipient: {
            name: billingData.billTo.name,
            address: billingData.billTo.address
          },
          notes: 'Thank you for your prompt payment.'
        }
      };

      await renderer.generateDocument(documentData, brandingData, billingData, null, template);
      toast({
        title: "Download Ready",
        description: `Invoice ${invoice.invoice_number} downloaded successfully!`,
      });
    } catch (error) {
      console.error('Error downloading invoice:', error);
      toast({
        title: "Error",
        description: "Failed to generate invoice. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadReceipt = async (payment: any) => {
    try {
      console.log('Starting receipt download...');
      toast({
        title: "Generating Receipt",
        description: "Please wait while we prepare your receipt for download...",
      });
      
      const { PDFTemplateService } = await import('@/utils/pdfTemplateService');
      const { UnifiedPDFRenderer } = await import('@/utils/unifiedPDFRenderer');
      const { getInvoiceBillingData } = await import('@/utils/invoiceBillingHelper');
      
      // Build invoice-like object from payment for billing lookup
      // Include landlordInfo from linked invoice or find from matching invoice
      const matchingInvoice = payment.invoice_id 
        ? paymentData?.invoices?.find((inv: any) => inv.id === payment.invoice_id)
        : payment.linkedInvoice;
      
      const invoiceLike = {
        lease_id: payment.lease_id,
        tenants: paymentData?.tenant ? {
          first_name: paymentData.tenant.first_name,
          last_name: paymentData.tenant.last_name
        } : null,
        leases: payment.linkedInvoice?.leases || matchingInvoice?.leases,
        // Include landlord info for PDF Bill From section
        landlordInfo: payment.linkedInvoice?.landlordInfo || matchingInvoice?.landlordInfo
      };
      
      // Fetch actual landlord billing data
      const billingData = await getInvoiceBillingData(invoiceLike);

      // Get template and branding from the unified service
      const { template, branding: brandingData } = await PDFTemplateService.getTemplateAndBranding(
        'receipt',
        'Admin'
      );
      
      const renderer = new UnifiedPDFRenderer();
      
      const documentData = {
        type: 'invoice' as const,
        title: `Receipt ${formatReceiptNumber(payment.payment_reference || payment.transaction_id)}`,
        content: {
          invoiceNumber: formatReceiptNumber(payment.payment_reference || payment.transaction_id),
          dueDate: new Date(payment.payment_date),
          items: [
            {
              description: 'Payment Received',
              amount: payment.amount,
              quantity: 1
            }
          ],
          total: payment.amount,
          recipient: {
            name: billingData.billTo.name,
            address: billingData.billTo.address
          },
          notes: `Full Transaction Reference: ${payment.payment_reference || payment.transaction_id || 'N/A'}`
        }
      };

      await renderer.generateDocument(documentData, brandingData, billingData, null, template);
      toast({
        title: "Receipt Ready",
        description: `Receipt for payment of ${fmtCurrency(payment.amount)} downloaded successfully!`,
      });
    } catch (error) {
      console.error('Error downloading receipt:', error);
      toast({
        title: "Error",
        description: "Failed to generate receipt. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleMpesaPayment = async (invoice: any) => {
    console.log('💳 [M-Pesa Payment] Button clicked for invoice:', {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      amount: invoice.amount,
      tenant_id: invoice.tenant_id
    });
    
    // Check M-Pesa availability before opening the dialog
    const isAvailable = await checkAvailability(invoice.id);
    
    console.log('💳 [M-Pesa Payment] Availability check result:', {
      isAvailable,
      lastErrorType,
      lastErrorDetails,
      lastCheck
    });
    
    // Debug bypass flag
    const debugBypass = import.meta.env.VITE_MPESA_DEBUG_BYPASS_CHECK === 'true';
    
    if (isAvailable || debugBypass) {
      if (debugBypass && !isAvailable) {
        console.warn('⚠️ [M-Pesa Payment] Debug bypass enabled - opening dialog despite availability check failure');
        toast({
          title: "Debug Mode Active",
          description: "M-Pesa dialog opened in diagnostic mode. Check console for details.",
          variant: "default",
        });
      }
      
      console.log('✅ [M-Pesa Payment] Opening payment dialog');
      setSelectedInvoice(invoice);
      setMpesaDialogOpen(true);
    } else {
      console.error('❌ [M-Pesa Payment] Cannot open dialog - availability check failed');
      
      // Show detailed error message based on diagnostics
      let errorTitle = "M-Pesa Payment Unavailable";
      let errorMessage = "M-Pesa payments are not available for this invoice.";
      
      if (lastErrorType) {
        switch (lastErrorType) {
          case 'config_check_failed':
            errorTitle = "Configuration Issue";
            errorMessage = lastErrorDetails?.includes('RLS') || lastErrorDetails?.includes('permission')
              ? "Unable to verify M-Pesa configuration due to permission restrictions. Please try logging out and back in."
              : "No active M-Pesa configuration found for this property. Please contact your landlord.";
            break;
          case 'landlord_not_found':
            errorTitle = "Property Configuration Issue";
            errorMessage = "Property owner information is missing. Please contact support.";
            break;
          case 'network_error':
            errorTitle = "Network Error";
            errorMessage = "Please check your internet connection and try again.";
            break;
          default:
            errorMessage = lastErrorDetails || "Please contact your landlord to enable M-Pesa payments.";
        }
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
        duration: 7000,
      });
      
      // Debug UI - show detailed diagnostics
      if (import.meta.env.VITE_MPESA_DEBUG_UI === 'true' && lastCheck) {
        console.table({
          'Invoice ID': lastCheck.invoiceId,
          'Lease ID': lastCheck.leaseId || 'N/A',
          'Unit ID': lastCheck.unitId || 'N/A',
          'Property ID': lastCheck.propertyId || 'N/A',
          'Landlord ID': lastCheck.landlordId || 'N/A',
          'Has Custom Config': lastCheck.hasCustomConfig ? 'Yes' : 'No',
          'Uses Platform Default': lastCheck.usesPlatformDefault ? 'Yes' : 'No',
          'Failed At Step': lastCheck.step || 'Unknown'
        });
      }
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "partially_paid":
        return <Clock className="h-4 w-4 text-blue-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "overdue":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800 border-green-200";
      case "partially_paid":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "overdue":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Memoized calculations for better performance
  const pendingInvoices = useMemo(() => {
    return paymentData?.invoices.filter(invoice => isInvoiceOutstanding(invoice.status)) || [];
  }, [paymentData?.invoices]);

  const totalOutstanding = useMemo(() => {
    // Use outstanding_amount if available, otherwise fall back to full amount
    return pendingInvoices.reduce((total, invoice) => 
      total + (invoice.outstanding_amount ?? invoice.amount ?? 0), 0);
  }, [pendingInvoices]);

  const filteredInvoices = useMemo(() => {
    if (!paymentData) return [];
    
    const allInvoices = [...paymentData.invoices, ...(paymentData.inferredInvoices || [])];
    const { search, status } = filters;
    
    return allInvoices
      .filter(invoice => {
        const matchesSearch = !search || 
          formatInvoiceNumber(invoice.invoice_number).toLowerCase().includes(search.toLowerCase()) ||
          getInvoiceDescription(invoice).toLowerCase().includes(search.toLowerCase()) ||
          (invoice.leases?.units?.properties?.name || '').toLowerCase().includes(search.toLowerCase());
        
        const matchesStatus = status === 'all' || invoice.status === status;
        
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        // Status priority: overdue first, then partially_paid, pending, paid last
        const statusPriority: Record<string, number> = {
          'overdue': 1,
          'partially_paid': 2,
          'pending': 3,
          'paid': 4
        };
        
        const priorityA = statusPriority[a.status] || 5;
        const priorityB = statusPriority[b.status] || 5;
        
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        
        // Within same status, sort by due_date ascending (oldest due first = most urgent)
        const dateA = new Date(a.due_date || a.invoice_date).getTime();
        const dateB = new Date(b.due_date || b.invoice_date).getTime();
        return dateA - dateB;
      });
  }, [paymentData, filters]);

  const paginatedInvoices = useMemo(() => {
    const startIndex = (invoicesPage - 1) * pageSize;
    return filteredInvoices.slice(startIndex, startIndex + pageSize);
  }, [filteredInvoices, invoicesPage, pageSize]);

  const filteredPayments = useMemo(() => {
    if (!paymentData?.payments) return [];
    
    const { search } = filters;
    return paymentData.payments
      .filter(payment => {
        const matchesSearch = !search || 
          payment.formattedReference?.toLowerCase().includes(search.toLowerCase()) ||
          (payment.linkedInvoice?.invoice_number || '').toLowerCase().includes(search.toLowerCase());
        
        return matchesSearch;
      })
      .sort((a, b) => {
        // Sort by payment_date descending (most recent first)
        const dateA = new Date(a.payment_date).getTime();
        const dateB = new Date(b.payment_date).getTime();
        return dateB - dateA;
      });
  }, [paymentData?.payments, filters]);

  const paginatedPayments = useMemo(() => {
    const startIndex = (paymentsPage - 1) * pageSize;
    return filteredPayments.slice(startIndex, startIndex + pageSize);
  }, [filteredPayments, paymentsPage, pageSize]);

  const groupPaymentsByMonth = (payments: any[]) => {
    const grouped: { [key: string]: any[] } = {};
    payments.forEach(payment => {
      const month = format(new Date(payment.payment_date), 'MMMM yyyy');
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push(payment);
    });
    return Object.entries(grouped).sort(([a], [b]) => new Date(b + ' 1').getTime() - new Date(a + ' 1').getTime());
  };

  const groupInvoicesByMonth = (invoices: any[]) => {
    const grouped: { [key: string]: any[] } = {};
    invoices.forEach(invoice => {
      const month = format(new Date(invoice.invoice_date), 'MMMM yyyy');
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push(invoice);
    });
    return Object.entries(grouped).sort(([a], [b]) => new Date(b + ' 1').getTime() - new Date(a + ' 1').getTime());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!paymentData) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <p className="text-muted-foreground">No payment information found.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Please check your browser console for debugging information.
          </p>
        </div>
      </div>
    );
  }

  // Use memoized values
  const { invoices = [], payments = [], tenant, inferredInvoices = [], credits = [], totalCreditBalance = 0 } = paymentData || {};
  const allInvoices = [...invoices, ...inferredInvoices];

  return (
    <TenantLayout>
      <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
            <CreditCard className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Payments & Invoices</h1>
            <p className="text-muted-foreground">Manage your rent payments and view invoice history</p>
          </div>
        </div>
      </div>

      {/* Payment Instructions Guide */}
      <div className="mb-6">
        <BankPaymentGuide variant="collapsible" defaultOpen={false} />
      </div>

      {/* Outstanding Balance Alert */}
      {totalOutstanding > 0 && (
        <Card className="mb-8 border-l-4 border-l-red-500">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-red-600 mb-1">Outstanding Balance</h3>
                <p className="text-3xl font-bold text-red-600">{fmtCurrency(totalOutstanding)}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {pendingInvoices.length} unpaid invoice(s)
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="lg" 
                  className="bg-green-600 hover:bg-green-700"
                  disabled={isChecking}
                  onClick={() => {
                    if (pendingInvoices.length > 0) {
                      handleMpesaPayment(pendingInvoices[0]);
                    }
                  }}
                >
                  <Smartphone className="h-4 w-4 mr-2" />
                  {isChecking ? 'Checking...' : 'Pay with M-Pesa'}
                </Button>
                {totalCreditBalance > 0 && (
                  <ApplyCreditDialog
                    availableCredit={totalCreditBalance}
                    credits={credits}
                    pendingInvoices={pendingInvoices}
                    onSuccess={fetchPaymentData}
                    trigger={
                      <Button size="lg" variant="outline" className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950">
                        <Wallet className="h-4 w-4 mr-2" />
                        Apply Credit
                      </Button>
                    }
                  />
                )}
                <Button
                  size="lg"
                  variant="outline"
                  disabled={isChecking}
                  onClick={() => {
                    if (pendingInvoices.length > 0) {
                      checkAvailability(pendingInvoices[0].id);
                      toast({
                        title: "Refreshing payment options...",
                        description: "Checking for updated M-Pesa configuration",
                      });
                    }
                  }}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
              {lastCheckTimestamp && lastErrorType && (
                <div className="text-xs text-muted-foreground mt-2">
                  Last checked: {new Date(lastCheckTimestamp).toLocaleTimeString()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Credit Balance Display */}
      {totalCreditBalance > 0 && (
        <div className="mb-6">
          <TenantCreditBalance 
            credits={credits} 
            totalBalance={totalCreditBalance} 
            variant="inline" 
          />
        </div>
      )}

      {/* Payment Summary Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 mb-8">
        <Card className="card-payment-total">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/90 font-medium">Total Paid</p>
                <p className="text-2xl font-bold text-white">
                  {fmtCurrency(payments
                    .filter(p => p.status === "completed")
                    .reduce((total, p) => total + (p.amount || 0), 0))}
                </p>
              </div>
              <div className="icon-bg-white">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-payment-pending">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/90 font-medium">Pending Payments</p>
                <p className="text-2xl font-bold text-white">
                  {fmtCurrency(invoices
                    .filter(i => i.status === "pending" || i.status === "unpaid")
                    .reduce((total, i) => total + (i.amount || 0), 0))}
                </p>
              </div>
              <div className="icon-bg-white">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-payment-overdue">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/90 font-medium">Overdue Amount</p>
                <p className="text-2xl font-bold text-white">
                  {fmtCurrency(invoices
                    .filter(i => i.status === "overdue")
                    .reduce((total, i) => total + (i.amount || 0), 0))}
                </p>
              </div>
              <div className="icon-bg-white">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="invoices" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Invoices ({allInvoices.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Payment History ({payments.length})
          </TabsTrigger>
        </TabsList>

        {/* Search and Filters */}
        <Card className="bg-muted/20 border-muted">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search invoices, payments, or properties..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <TabsContent value="invoices">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Your Invoices
                <Badge variant="secondary" className="ml-2">
                  {filteredInvoices.length} found
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredInvoices.length === 0 ? (
                <div className="text-center py-12">
                  <div className="p-6 rounded-xl bg-muted/30 inline-block mb-4">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {filters.search || filters.status !== 'all' ? 'No matching invoices' : 'No invoices yet'}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {filters.search || filters.status !== 'all' 
                      ? 'Try adjusting your search or filters' 
                      : 'Your invoices will appear here once they are generated'
                    }
                  </p>
                  {(filters.search || filters.status !== 'all') && (
                    <Button 
                      variant="outline" 
                      onClick={() => setFilters({ search: "", status: "all", dateRange: "all" })}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow>
                        <TableHead className="font-semibold">Invoice Details</TableHead>
                        <TableHead className="font-semibold">Property & Unit</TableHead>
                        <TableHead className="font-semibold">Amount</TableHead>
                        <TableHead className="font-semibold">Due Date</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                     <TableBody>
                       {paginatedInvoices.map((invoice) => (
                        <TableRow key={invoice.id} className="hover:bg-muted/20 transition-colors">
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-semibold text-primary">
                                {formatInvoiceNumber(invoice.invoice_number)}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {getInvoiceDescription(invoice)}
                              </div>
                              {invoice.isInferred && (
                                <Badge variant="outline" className="text-xs">
                                  Inferred from Payment
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-md bg-muted">
                                <Building className="h-3 w-3 text-muted-foreground" />
                              </div>
                              <div>
                                <div className="font-medium text-sm">
                                  {invoice.leases?.units?.properties?.name || invoice.sourcePayment?.property_name || 'Property'}
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Home className="h-3 w-3" />
                                  Unit {invoice.leases?.units?.unit_number || invoice.sourcePayment?.unit_number || 'N/A'}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-bold text-lg text-foreground">
                              {fmtCurrency(invoice.amount || 0)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {fmtDate(invoice.due_date)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(invoice.status)}>
                              {getStatusIcon(invoice.status)}
                              <span className="ml-1 capitalize">{invoice.status}</span>
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {!invoice.isInferred && (
                                <TenantInvoiceDetailsDialog 
                                  invoice={invoice}
                                  onPayNow={handleMpesaPayment}
                                  trigger={
                                    <Button variant="outline" size="sm">
                                      <Eye className="h-3 w-3 mr-1" />
                                      View
                                    </Button>
                                  }
                                />
                              )}
                              {!invoice.isInferred && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownloadInvoice(invoice)}
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  PDF
                                </Button>
                              )}
                              {isInvoicePayable(invoice.status) && (
                                <>
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                    disabled={isChecking}
                                    onClick={() => handleMpesaPayment(invoice)}
                                  >
                                    <Smartphone className="h-3 w-3 mr-1" />
                                    {isChecking ? 'Checking...' : 'Pay'}
                                  </Button>
                                  {totalCreditBalance > 0 && (
                                    <ApplyCreditDialog
                                      availableCredit={totalCreditBalance}
                                      credits={credits}
                                      pendingInvoices={pendingInvoices}
                                      preSelectedInvoice={invoice}
                                      onSuccess={fetchPaymentData}
                                      trigger={
                                        <Button size="sm" variant="outline" className="border-green-600 text-green-600">
                                          <Wallet className="h-3 w-3 mr-1" />
                                          Credit
                                        </Button>
                                      }
                                    />
                                  )}
                                </>
                              )}
                              {invoice.isInferred && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownloadReceipt(invoice.sourcePayment)}
                                >
                                  <Receipt className="h-3 w-3 mr-1" />
                                  Receipt
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                     </TableBody>
                   </Table>
                   
                   <div className="mt-4">
                     <TablePaginator
                       currentPage={invoicesPage}
                       totalPages={Math.ceil(filteredInvoices.length / pageSize)}
                       pageSize={pageSize}
                       totalItems={filteredInvoices.length}
                       onPageChange={setInvoicesPage}
                       onPageSizeChange={() => {}} // Fixed page size for now
                       showPageSizeSelector={false}
                     />
                   </div>
                 </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Payment History
                <Badge variant="secondary" className="ml-2">
                  {filteredPayments.length} found
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredPayments.length === 0 ? (
                <div className="text-center py-12">
                  <div className="p-6 rounded-xl bg-muted/30 inline-block mb-4">
                    <Receipt className="h-12 w-12 text-muted-foreground mx-auto" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {filters.search ? 'No matching payments' : 'No payment history yet'}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {filters.search 
                      ? 'Try adjusting your search terms' 
                      : 'Your completed payments will appear here'
                    }
                  </p>
                  {filters.search && (
                    <Button 
                      variant="outline" 
                      onClick={() => setFilters(prev => ({ ...prev, search: "" }))}
                    >
                      Clear Search
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow>
                        <TableHead className="font-semibold">Payment Details</TableHead>
                        <TableHead className="font-semibold">Linked Invoice</TableHead>
                        <TableHead className="font-semibold">Payment Method</TableHead>
                        <TableHead className="font-semibold">Amount</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                     <TableBody>
                       {paginatedPayments.map((payment) => (
                        <TableRow key={payment.id} className="hover:bg-muted/20 transition-colors">
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-semibold text-primary">
                                {formatPaymentReference(payment.payment_reference || payment.transaction_id)}
                              </div>
                              <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {fmtDate(payment.payment_date)}
                              </div>
                            </div>
                          </TableCell>
                           <TableCell>
                             <div className="space-y-1">
                               {payment.linkedInvoice ? (
                                 <div>
                                   <div className="font-medium text-sm text-primary">
                                     {formatInvoiceNumber(payment.linkedInvoice.invoice_number)}
                                   </div>
                                    <div className="text-xs text-muted-foreground">
                                      {payment.linkQuality === 'exact' && payment.linkedInvoice?.isInferred && 'Inferred (restricted)'}
                                      {payment.linkQuality === 'exact' && !payment.linkedInvoice?.isInferred && 'Exact match'}
                                      {payment.linkQuality === 'probable' && 'Probable match'}
                                      {payment.linkQuality === 'fuzzy' && 'Amount match'}
                                    </div>
                                 </div>
                               ) : (
                                 <div className="text-sm text-muted-foreground">
                                   No linked invoice
                                   <div className="text-xs">
                                     {payment.linkReason || 'Payment processed independently'}
                                   </div>
                                 </div>
                               )}
                             </div>
                           </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-md bg-green-100">
                                <Smartphone className="h-3 w-3 text-green-600" />
                              </div>
                              <span className="text-sm font-medium">
                                {payment.payment_method || 'M-Pesa'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-bold text-lg text-green-600">
                              {fmtCurrency(payment.amount || 0)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Completed
                            </Badge>
                          </TableCell>
                           <TableCell>
                             <div className="flex gap-1">
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => handleDownloadReceipt(payment)}
                                 className="border-primary/20 text-primary hover:bg-primary/10"
                               >
                                 <Receipt className="h-3 w-3 mr-1" />
                                 Receipt
                               </Button>
                               {payment.linkedInvoice && (
                                  <TenantInvoiceDetailsDialog 
                                    invoice={payment.linkedInvoice}
                                    onPayNow={handleMpesaPayment}
                                    trigger={
                                     <Button variant="ghost" size="sm">
                                       <Eye className="h-3 w-3 mr-1" />
                                       View Invoice
                                     </Button>
                                   }
                                 />
                               )}
                             </div>
                           </TableCell>
                        </TableRow>
                      ))}
                     </TableBody>
                   </Table>
                   
                   <div className="mt-4">
                     <TablePaginator
                       currentPage={paymentsPage}
                       totalPages={Math.ceil(filteredPayments.length / pageSize)}
                       pageSize={pageSize}
                       totalItems={filteredPayments.length}
                       onPageChange={setPaymentsPage}
                       onPageSizeChange={() => {}} // Fixed page size for now
                       showPageSizeSelector={false}
                     />
                   </div>
                 </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

            {selectedInvoice && (
              <Suspense fallback={<div className="flex items-center justify-center p-4"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
                <MpesaErrorBoundary onRetry={() => setMpesaDialogOpen(false)}>
                  <MpesaPaymentDialog
                    open={mpesaDialogOpen}
                    onOpenChange={setMpesaDialogOpen}
                    invoice={selectedInvoice}
                    onPaymentInitiated={() => {
                      setMpesaDialogOpen(false);
                      setSelectedInvoice(null);
                      fetchPaymentData();
                    }}
                  />
                </MpesaErrorBoundary>
              </Suspense>
            )}
        </div>
      </TenantLayout>
    );
  }
