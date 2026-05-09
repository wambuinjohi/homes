import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  AlertCircle, 
  Search, 
  RefreshCw, 
  CheckCircle,
  Clock,
  Phone,
  User,
  Receipt,
  DollarSign,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { PaymentAllocationDialog } from "@/components/landlord/PaymentAllocationDialog";
import { PaymentProviderBadge } from "@/components/landlord/PaymentProviderBadge";
import { 
  fetchUnmatchedPayments, 
  UnifiedUnmatchedPayment, 
  PaymentSource 
} from "@/utils/unmatchedPaymentsQuery";

export default function UnmatchedPayments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<UnifiedUnmatchedPayment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sourceFilter, setSourceFilter] = useState<PaymentSource>('all');
  const [selectedPayment, setSelectedPayment] = useState<UnifiedUnmatchedPayment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadUnmatchedPayments();
  }, [user, sourceFilter]);

  const loadUnmatchedPayments = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const data = await fetchUnmatchedPayments(user.id, sourceFilter);
      setPayments(data);
    } catch (error) {
      console.error('Error loading unmatched payments:', error);
      toast({
        title: "Error",
        description: "Failed to load unmatched payments",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAllocate = (payment: UnifiedUnmatchedPayment) => {
    setSelectedPayment(payment);
    setDialogOpen(true);
  };

  const handleAllocationSuccess = () => {
    setDialogOpen(false);
    setSelectedPayment(null);
    loadUnmatchedPayments();
    toast({
      title: "Payment Allocated",
      description: "The payment has been successfully allocated to the invoice."
    });
  };

  const filteredPayments = payments.filter(payment => {
    const searchLower = searchTerm.toLowerCase();
    return (
      payment.customer_name?.toLowerCase().includes(searchLower) ||
      payment.customer_mobile?.includes(searchTerm) ||
      payment.reference?.toLowerCase().includes(searchLower) ||
      payment.transaction_reference.toLowerCase().includes(searchLower) ||
      payment.amount.toString().includes(searchTerm)
    );
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Count payments by source
  const getCounts = () => {
    const all = payments.length;
    const jenga = payments.filter(p => p.source === 'jenga_pay').length;
    const kcb = payments.filter(p => p.source === 'kcb_buni' || p.source === 'bank').length;
    const mpesa = payments.filter(p => p.source === 'mpesa').length;
    return { all, jenga, kcb, mpesa };
  };

  const counts = getCounts();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Unmatched Payments</h1>
          <p className="text-muted-foreground">
            Payments received via M-Pesa, Equity Bank, KCB, or other banks that need manual allocation
          </p>
        </div>

        {/* Info Alert */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>How Payment Matching Works</AlertTitle>
          <AlertDescription>
            Payments are matched automatically when tenants use the correct account format. 
            If the format is incorrect or there are multiple pending invoices, payments appear here for manual allocation.
          </AlertDescription>
        </Alert>

        {/* Source Filter Tabs */}
        <Tabs value={sourceFilter} onValueChange={(v) => setSourceFilter(v as PaymentSource)}>
          <TabsList>
            <TabsTrigger value="all" className="gap-2">
              All
              {counts.all > 0 && <Badge variant="secondary" className="ml-1">{counts.all}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="mpesa" className="gap-2">
              M-Pesa
              {counts.mpesa > 0 && <Badge variant="secondary" className="ml-1">{counts.mpesa}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="jenga_pay" className="gap-2">
              Equity Bank
              {counts.jenga > 0 && <Badge variant="secondary" className="ml-1">{counts.jenga}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="kcb_buni" className="gap-2">
              KCB
              {counts.kcb > 0 && <Badge variant="secondary" className="ml-1">{counts.kcb}</Badge>}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search and Refresh */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" onClick={loadUnmatchedPayments} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Payments List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Pending Allocations
              {filteredPayments.length > 0 && (
                <Badge variant="secondary">{filteredPayments.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Click "Allocate" to assign a payment to a specific invoice
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-lg font-medium">All payments matched!</p>
                <p className="text-muted-foreground">
                  {payments.length === 0 
                    ? "No unmatched payments to allocate" 
                    : "No payments match your search"}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPayments.map((payment) => (
                  <div 
                    key={`${payment.sourceTable}-${payment.id}`} 
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <PaymentProviderBadge 
                            source={payment.source} 
                            bankCode={payment.bank_code}
                          />
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <DollarSign className="h-3 w-3 mr-1" />
                            {formatCurrency(payment.amount)}
                          </Badge>
                          <Badge variant="secondary">
                            <Clock className="h-3 w-3 mr-1" />
                            {format(new Date(payment.created_at), 'dd MMM yyyy HH:mm')}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{payment.customer_name || 'Unknown'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span>{payment.customer_mobile || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Receipt className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono text-xs">{payment.reference || 'No Ref'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono text-xs truncate">{payment.transaction_reference}</span>
                          </div>
                        </div>
                      </div>
                      
                      <Button onClick={() => handleAllocate(payment)}>
                        Allocate
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Allocation Dialog */}
      <PaymentAllocationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        payment={selectedPayment}
        onSuccess={handleAllocationSuccess}
      />
    </DashboardLayout>
  );
}
