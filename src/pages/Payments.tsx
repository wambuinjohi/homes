import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatAmount, getGlobalCurrencySync } from "@/utils/currency";
import { Search, Filter, DollarSign, Calendar } from "lucide-react";
import { format } from "date-fns";
import { KpiGrid } from "@/components/kpi/KpiGrid";
import { KpiStatCard } from "@/components/kpi/KpiStatCard";
import { RecordPaymentDialog } from "@/components/payments/RecordPaymentDialog";
import { TestPaymentButton } from "@/components/payments/TestPaymentButton";
import { TablePaginator } from "@/components/ui/table-paginator";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";
import { FeatureGate } from "@/components/ui/feature-gate";
import { DisabledActionWrapper } from "@/components/feature-access/DisabledActionWrapper";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";

interface Payment {
  id: string;
  tenant_id: string;
  lease_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  payment_type: string;
  status: string;
  notes?: string;
  tenants: {
    first_name: string;
    last_name: string;
  };
  leases: {
    units: {
      unit_number: string;
      properties: {
        name: string;
      };
    };
  };
}


const Payments = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [tenants, setTenants] = useState<any[]>([]);
  const [leases, setLeases] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("last_12_months");
  const { toast } = useToast();
  const { page, pageSize, offset, setPage, setPageSize } = useUrlPageParam({ pageSize: 10 });

  const fetchPayments = async () => {
    try {
      console.log("🔍 Starting payments fetch with pagination", { page, pageSize, offset });
      
      // Build query with filters
      let query = supabase
        .from("payments")
        .select("*", { count: 'exact' });

      // Apply search filter (will be done after joining due to complexity)
      // Apply status filter
      if (statusFilter !== "all") {
        query = query.eq('status', statusFilter);
      }

      // Apply period filter
      const { start: periodStart, end: periodEnd } = getPeriodDates(periodFilter);
      query = query.gte('payment_date', periodStart.toISOString().split('T')[0])
               .lte('payment_date', periodEnd.toISOString().split('T')[0]);

      // Add pagination and ordering
      const { data: paymentsData, error: paymentsError, count } = await query
        .range(offset, offset + pageSize - 1)
        .order("payment_date", { ascending: false });

      if (paymentsError) {
        console.error("❌ Payments query error:", paymentsError);
        throw paymentsError;
      }

      // Get related data separately
      const [tenantsResult, leasesResult, unitsResult, propertiesResult] = await Promise.all([
        supabase.from("tenants").select("id, first_name, last_name"),
        supabase.from("leases").select("id, unit_id"),
        supabase.from("units").select("id, unit_number, property_id"),
        supabase.from("properties").select("id, name")
      ]);

      if (tenantsResult.error) throw tenantsResult.error;
      if (leasesResult.error) throw leasesResult.error;
      if (unitsResult.error) throw unitsResult.error;
      if (propertiesResult.error) throw propertiesResult.error;

      // Create lookup maps
      const tenantMap = new Map(tenantsResult.data?.map(t => [t.id, t]) || []);
      const leaseMap = new Map(leasesResult.data?.map(l => [l.id, l]) || []);
      const unitMap = new Map(unitsResult.data?.map(u => [u.id, u]) || []);
      const propertyMap = new Map(propertiesResult.data?.map(p => [p.id, p]) || []);

      // Join data manually
      let joinedPayments = paymentsData?.map(payment => {
        const tenant = tenantMap.get(payment.tenant_id);
        const lease = leaseMap.get(payment.lease_id);
        const unit = lease ? unitMap.get(lease.unit_id) : null;
        const property = unit ? propertyMap.get(unit.property_id) : null;
        
        return {
          ...payment,
          tenants: tenant || { first_name: '', last_name: '' },
          leases: {
            units: {
              unit_number: unit?.unit_number || '',
              properties: {
                name: property?.name || ''
              }
            }
          }
        };
      }) || [];

      // Apply search filter after joining
      if (searchTerm) {
        joinedPayments = joinedPayments.filter(payment =>
          payment.tenants.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          payment.tenants.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          payment.leases.units.properties.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      console.log("🔗 Joined payments:", joinedPayments.length, "of", count);
      setPayments(joinedPayments);
      setTotalCount(count || 0);
    } catch (error) {
      console.error("💥 Error in fetchPayments:", error);
      toast({
        title: "Error", 
        description: "Failed to load payments. Please check your permissions.",
        variant: "destructive",
      });
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantsAndLeases = async () => {
    try {
      // Get tenants and leases separately
      const [tenantsResult, leasesResult, unitsResult, propertiesResult] = await Promise.all([
        supabase.from("tenants").select("id, first_name, last_name"),
        supabase.from("leases").select("id, tenant_id, monthly_rent, unit_id"),
        supabase.from("units").select("id, unit_number, property_id"),
        supabase.from("properties").select("id, name")
      ]);

      if (tenantsResult.error) throw tenantsResult.error;
      if (leasesResult.error) throw leasesResult.error;
      if (unitsResult.error) throw unitsResult.error;
      if (propertiesResult.error) throw propertiesResult.error;

      // Create lookup maps
      const unitMap = new Map(unitsResult.data?.map(u => [u.id, u]) || []);
      const propertyMap = new Map(propertiesResult.data?.map(p => [p.id, p]) || []);

      // Join leases with units and properties
      const joinedLeases = leasesResult.data?.map(lease => {
        const unit = unitMap.get(lease.unit_id);
        const property = unit ? propertyMap.get(unit.property_id) : null;
        
        return {
          ...lease,
          units: {
            unit_number: unit?.unit_number || '',
            properties: {
              name: property?.name || ''
            }
          }
        };
      }) || [];

      setTenants(tenantsResult.data || []);
      setLeases(joinedLeases);

      // Audit: record tenants list access from Payments context. Non-blocking.
      try {
        await supabase.rpc('log_sensitive_data_access', {
          _table_name: 'tenants',
          _operation: 'list'
        });
      } catch (e) {
        console.warn('Audit log (data access) failed', e);
      }
    } catch (error) {
      console.error("Error fetching tenants and leases:", error);
    }
  };

  const fetchInvoices = async () => {
    try {
      // Fetch invoices with pending, overdue, or partially_paid status
      const { data: invoicesData, error: invoicesError } = await supabase
        .from("invoices")
        .select("id, invoice_number, tenant_id, lease_id, amount, status, due_date")
        .in('status', ['pending', 'overdue', 'partially_paid']);
      
      if (invoicesError) throw invoicesError;
      if (!invoicesData || invoicesData.length === 0) {
        setInvoices([]);
        return;
      }

      // Fetch related data separately (leases, units, properties)
      const leaseIds = [...new Set(invoicesData.map(inv => inv.lease_id).filter(Boolean))];
      const [leasesResult, unitsResult, propertiesResult] = await Promise.all([
        supabase.from("leases").select("id, unit_id").in('id', leaseIds),
        supabase.from("units").select("id, unit_number, property_id"),
        supabase.from("properties").select("id, name")
      ]);

      // Create lookup maps
      const leaseMap = new Map(leasesResult.data?.map(l => [l.id, l]) || []);
      const unitMap = new Map(unitsResult.data?.map(u => [u.id, u]) || []);
      const propertyMap = new Map(propertiesResult.data?.map(p => [p.id, p]) || []);

      // Fetch allocations for calculating outstanding amounts
      const invoiceIds = invoicesData.map(inv => inv.id);
      const { data: allocationsData } = await supabase
        .from('payment_allocations')
        .select('invoice_id, amount')
        .in('invoice_id', invoiceIds);

      // Calculate allocated amounts per invoice
      const allocationMap = new Map<string, number>();
      allocationsData?.forEach(alloc => {
        const current = allocationMap.get(alloc.invoice_id) || 0;
        allocationMap.set(alloc.invoice_id, current + Number(alloc.amount));
      });

      // Join data and calculate outstanding amounts
      const invoicesWithData = invoicesData.map(inv => {
        const lease = leaseMap.get(inv.lease_id);
        const unit = lease ? unitMap.get(lease.unit_id) : null;
        const property = unit ? propertyMap.get(unit.property_id) : null;
        const allocatedAmount = allocationMap.get(inv.id) || 0;
        
        return {
          ...inv,
          outstanding_amount: Number(inv.amount) - allocatedAmount,
          leases: {
            units: {
              unit_number: unit?.unit_number || '',
              properties: {
                name: property?.name || ''
              }
            }
          }
        };
      }).filter(inv => inv.outstanding_amount > 0);

      setInvoices(invoicesWithData);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      setInvoices([]);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchTenantsAndLeases();
    fetchInvoices();
  }, [page, pageSize, searchTerm, statusFilter, periodFilter]);


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600">Completed</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPeriodDates = (period: string) => {
    const now = new Date();
    const today = new Date();
    
    switch (period) {
      case 'current_month':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: today
        };
      case 'last_12_months':
        return {
          start: new Date(now.getFullYear() - 1, now.getMonth(), 1),
          end: today
        };
      case 'ytd':
        return {
          start: new Date(now.getFullYear(), 0, 1),
          end: today
        };
      default:
        return {
          start: new Date(now.getFullYear() - 1, now.getMonth(), 1),
          end: today
        };
    }
  };

  const { start: periodStart, end: periodEnd } = getPeriodDates(periodFilter);

  // Payments are already filtered on the server side
  const totalPages = Math.ceil(totalCount / pageSize);

  const getFilteredPaymentsByPeriod = (filterPeriod?: string) => {
    const period = filterPeriod || periodFilter;
    const { start, end } = getPeriodDates(period);
    
    return payments.filter(p => {
      const paymentDate = new Date(p.payment_date);
      return p.status === 'completed' && 
             paymentDate >= start && 
             paymentDate <= end;
    });
  };

  const totalRevenue = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, payment) => sum + payment.amount, 0);

  const periodRevenue = getFilteredPaymentsByPeriod().reduce((sum, payment) => sum + payment.amount, 0);
  const currentMonthRevenue = getFilteredPaymentsByPeriod('current_month').reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <DashboardLayout>
      <FeatureGate
        feature={FEATURES.MANAGE_PAYMENTS}
        fallbackTitle="Payment Management"
        fallbackDescription="Record and track rent payments with automated reconciliation."
        showUpgradePrompt={true}
      >
        <div className="bg-tint-gray p-6 space-y-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-primary">Payments</h1>
              <p className="text-muted-foreground">
                Track rent payments and financial transactions
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <DisabledActionWrapper
                feature={FEATURES.MANAGE_PAYMENTS}
                fallbackTitle="Payment Management Required"
                fallbackDescription="Upgrade to record payments"
              >
                <RecordPaymentDialog
                  tenants={tenants}
                  leases={leases}
                  invoices={invoices}
                  onPaymentRecorded={() => { fetchPayments(); fetchInvoices(); }}
                />
              </DisabledActionWrapper>
              <TestPaymentButton tenantNameQuery="David" onPaymentRecorded={fetchPayments} />
            </div>
          </div>

        {/* Period Filter & KPI Summary */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="period-filter" className="text-sm font-medium">Period:</Label>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger id="period-filter" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current_month">Current Month</SelectItem>
                <SelectItem value="last_12_months">Last 12 Months</SelectItem>
                <SelectItem value="ytd">Year to Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <KpiGrid className="lg:grid-cols-4">
          <KpiStatCard
            title="Total Revenue (All Time)"
            value={formatAmount(totalRevenue)}
            subtitle="All completed payments"
            icon={DollarSign}
            gradient="card-gradient-green"
            isLoading={loading}
          />
          <KpiStatCard
            title={periodFilter === 'current_month' ? 'This Month' : 
                   periodFilter === 'ytd' ? 'Year to Date' : 'Last 12 Months'}
            value={formatAmount(periodRevenue)}
            subtitle="Period revenue"
            icon={Calendar}
            gradient="card-gradient-blue"
            isLoading={loading}
          />
          <KpiStatCard
            title="This Month"
            value={formatAmount(currentMonthRevenue)}
            subtitle="Current month revenue"
            icon={Calendar}
            gradient="card-gradient-orange"
            isLoading={loading}
          />
          <KpiStatCard
            title="Total Payments"
            value={payments.length}
            subtitle="Payment records"
            icon={DollarSign}
            gradient="card-gradient-navy"
            isLoading={loading}
          />
        </KpiGrid>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search payments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-primary">Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No payments found
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <h3 className="font-medium">
                          {payment.tenants.first_name} {payment.tenants.last_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {payment.leases.units.properties.name} - Unit {payment.leases.units.unit_number}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {payment.payment_type} • {payment.payment_method}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="font-medium">{formatAmount(payment.amount)}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(payment.payment_date), 'MMM dd, yyyy')}
                        </div>
                      </div>
                      {getStatusBadge(payment.status)}
                    </div>
                    </div>
                  ))}
                </div>
                
                {/* Pagination */}
                <TablePaginator
                  currentPage={page}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  totalItems={totalCount}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </>
            )}
          </CardContent>
        </Card>
        </div>
      </FeatureGate>
    </DashboardLayout>
  );
};

export default Payments;
