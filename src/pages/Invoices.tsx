import { useState, useEffect } from "react";
import { formatAmount } from "@/utils/currency";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Search, Filter, Plus, Eye, Edit, Download, Send, Calendar, DollarSign } from "lucide-react";
import { InvoiceDetailsDialog } from "@/components/invoices/InvoiceDetailsDialog";
import { CreateInvoiceDialog } from "@/components/invoices/CreateInvoiceDialog";
import { BulkInvoiceGenerationDialog } from "@/components/invoices/BulkInvoiceGenerationDialog";
import { useInvoiceActions } from "@/hooks/useInvoiceActions";
import { KpiGrid } from "@/components/kpi/KpiGrid";
import { KpiStatCard } from "@/components/kpi/KpiStatCard";
import { TablePaginator } from "@/components/ui/table-paginator";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";
import { FeatureGate } from "@/components/ui/feature-gate";
import { DisabledActionWrapper } from "@/components/feature-access/DisabledActionWrapper";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";

interface Invoice {
  id: string;
  invoice_number: string;
  lease_id: string;
  tenant_id: string;
  invoice_date: string;
  due_date: string;
  amount: number;
  status: string;
  computed_status: string;
  amount_paid_total: number;
  outstanding_amount: number;
  description: string | null;
  created_at: string;
  leases?: {
    units?: {
      unit_number: string;
      properties?: {
        name: string;
      };
    };
  };
  tenants?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

const Invoices = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const { downloadInvoice, sendInvoice } = useInvoiceActions();
  const { page, pageSize, offset, setPage, setPageSize } = useUrlPageParam({ pageSize: 10 });

  // Fetch invoices using the secure RPC function with pagination
  const fetchInvoices = async () => {
    try {
      console.log("🔍 Starting invoice overview fetch with pagination", { page, pageSize, offset });
      
      // Use secure RPC function instead of direct view access
      const { data, error } = await supabase.rpc('get_invoice_overview', {
        p_limit: pageSize,
        p_offset: offset,
        p_status: filterStatus !== "all" ? filterStatus : null,
        p_search: searchTerm || null
      });

      if (error) {
        console.error('❌ Invoice overview RPC error:', error);
        const rpcMessage = error?.message || error?.details || error?.hint || JSON.stringify(error);
        toast.error(`Invoice overview RPC error: ${rpcMessage}`);
        // Fall back to server-side endpoint that uses service_role
        try {
          const resp = await fetch(`/api/invoices/overview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ p_limit: pageSize, p_offset: offset, p_status: filterStatus !== 'all' ? filterStatus : null, p_search: searchTerm || null })
          });
          const srvData = await resp.json();
          if (!resp.ok) throw srvData;
          // Use server data
          const data = srvData;
          const transformedInvoices = (data || []).map((invoice: any) => ({
            ...invoice,
            tenants: { first_name: invoice.first_name || '', last_name: invoice.last_name || '', email: invoice.email || '' },
            leases: { units: { unit_number: invoice.unit_number || '', properties: { name: invoice.property_name || '' } } }
          }));
          setInvoices(transformedInvoices as Invoice[]);
          setTotalCount((data || []).length);
          setLoading(false);
          return;
        } catch (srvErr) {
          console.error('Server-side invoice overview fallback failed:', srvErr);
          toast.error('Failed to load invoices (server fallback)');
          throw error;
        }
      }

      // Get total count for pagination (we'll need to make a separate call for this)
      const { count } = await supabase.rpc('get_invoice_overview', {
        p_limit: 999999, // Get all for count
        p_offset: 0,
        p_status: filterStatus !== "all" ? filterStatus : null,
        p_search: searchTerm || null
      });

      // Transform data to match expected interface
      const transformedInvoices = (data || []).map((invoice: any) => ({
        ...invoice,
        tenants: {
          first_name: invoice.first_name || '',
          last_name: invoice.last_name || '',
          email: invoice.email || ''
        },
        leases: {
          units: {
            unit_number: invoice.unit_number || '',
            properties: {
              name: invoice.property_name || ''
            }
          }
        }
      }));

      console.log("🔗 Invoice overview loaded:", transformedInvoices.length, "of", (data || []).length);
      setInvoices(transformedInvoices as Invoice[]);
      setTotalCount((data || []).length);
    } catch (error: any) {
      console.error('💥 Error in fetchInvoices:', error);
      const message = error?.message || error?.details || error?.hint || (typeof error === 'string' ? error : JSON.stringify(error));
      toast.error(message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    const loadInvoices = async () => {
      setLoading(true);
      await fetchInvoices();
    };
    loadInvoices();
  }, [page, pageSize, searchTerm, filterStatus]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-success text-success-foreground";
      case "pending":
        return "bg-warning text-warning-foreground";
      case "overdue":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  const totalInvoiced = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const totalPaid = invoices.reduce((sum, invoice) => sum + (invoice.amount_paid_total || 0), 0);
  const totalOutstanding = invoices.reduce((sum, invoice) => sum + (invoice.outstanding_amount || 0), 0);
  const totalOverdue = invoices.filter(i => (i.computed_status || i.status) === "overdue").reduce((sum, invoice) => sum + (invoice.outstanding_amount || 0), 0);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <DashboardLayout>
      <FeatureGate
        feature={FEATURES.INVOICING}
        fallbackTitle="Invoice Management"
        fallbackDescription="Create, send, and track invoices for your tenants with automated billing."
        showUpgradePrompt={true}
      >
        <div className="bg-tint-gray p-6 space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-primary">Invoices</h1>
              <p className="text-muted-foreground">
                Manage tenant invoices and billing
              </p>
            </div>
            <div className="flex gap-3 self-stretch sm:self-auto">
              <DisabledActionWrapper
                feature={FEATURES.ADVANCED_INVOICING}
                fallbackTitle="Bulk Invoicing Required"
                fallbackDescription="Upgrade to generate bulk invoices"
              >
                <BulkInvoiceGenerationDialog onInvoicesGenerated={fetchInvoices} />
              </DisabledActionWrapper>
              <DisabledActionWrapper
                feature={FEATURES.INVOICING}
                fallbackTitle="Invoicing Required"
                fallbackDescription="Upgrade to create invoices"
              >
                <CreateInvoiceDialog onInvoiceCreated={fetchInvoices} />
              </DisabledActionWrapper>
            </div>
          </div>

        {/* KPI Summary */}
        <KpiGrid>
          <KpiStatCard
            title="Total Invoiced"
            value={formatAmount(totalInvoiced)}
            subtitle="All time"
            icon={FileText}
            gradient="card-gradient-blue"
            isLoading={loading}
          />
          <KpiStatCard
            title="Paid"
            value={formatAmount(totalPaid)}
            subtitle="Collected"
            icon={DollarSign}
            gradient="card-gradient-green"
            isLoading={loading}
          />
          <KpiStatCard
            title="Outstanding"
            value={formatAmount(totalOutstanding)}
            subtitle="Total unpaid"
            icon={Calendar}
            gradient="card-gradient-orange"
            isLoading={loading}
          />
          <KpiStatCard
            title="Overdue"
            value={formatAmount(totalOverdue)}
            subtitle="Past due"
            icon={Calendar}
            gradient="card-gradient-navy"
            isLoading={loading}
          />
        </KpiGrid>

        {/* Search and Filters */}
        <Card className="bg-card p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1 w-full">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search invoices by number or tenant..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-border"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[180px] border-border">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Invoices Content */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="bg-card">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[200px]" />
                      <Skeleton className="h-3 w-[150px]" />
                    </div>
                    <Skeleton className="h-8 w-[100px]" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : invoices.length > 0 ? (
          <div className="space-y-4">
            {invoices.map((invoice) => (
              <Card key={invoice.id} className="bg-card hover:shadow-elevated transition-all duration-300 border-border">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    {/* Left: Icon + Info */}
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-accent/10 rounded-lg shrink-0">
                        <FileText className="h-5 w-5 text-accent" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-semibold text-primary leading-tight break-words">
                          {invoice.invoice_number}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {invoice.tenants?.first_name} {invoice.tenants?.last_name} • {invoice.leases?.units?.properties?.name} ({invoice.leases?.units?.unit_number})
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Due: {new Date(invoice.due_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Right: Amount + Status + Actions */}
                    <div className="flex items-end sm:items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                      <div className="text-left sm:text-right">
                        <p className="font-semibold text-lg sm:text-xl text-primary">{formatAmount(invoice.amount)}</p>
                        <p className="text-sm text-muted-foreground">
                          Paid: {formatAmount(invoice.amount_paid_total || 0)} | Outstanding: {formatAmount(invoice.outstanding_amount || 0)}
                        </p>
                        <Badge className={getStatusColor(invoice.computed_status || invoice.status)}>
                          {(invoice.computed_status || invoice.status).charAt(0).toUpperCase() + (invoice.computed_status || invoice.status).slice(1)}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <InvoiceDetailsDialog 
                          invoice={invoice} 
                          mode="view"
                          trigger={
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground h-8 w-8 p-0"
                              aria-label="View invoice"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="border-accent text-accent hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0"
                          onClick={() => downloadInvoice(invoice)}
                          aria-label="Download invoice"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          className="bg-accent hover:bg-accent/90 h-8 w-8 p-0"
                          onClick={() => sendInvoice(invoice)}
                          aria-label="Send invoice"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* Pagination */}
            <TablePaginator
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalCount}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        ) : (
          <Card className="bg-card">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <FileText className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No invoices found</h3>
              <p className="text-muted-foreground text-center mb-6">
                {searchTerm || filterStatus !== "all" 
                  ? "Try adjusting your search or filters"
                  : "Get started by creating your first invoice"
                }
              </p>
              {!searchTerm && filterStatus === "all" && (
                <CreateInvoiceDialog onInvoiceCreated={fetchInvoices} />
              )}
            </CardContent>
          </Card>
        )}
        </div>
      </FeatureGate>
    </DashboardLayout>
  );
};

export default Invoices;
