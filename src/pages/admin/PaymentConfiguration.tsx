import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TablePaginator } from "@/components/ui/table-paginator";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";
import { toast } from "sonner";
import { CreditCard, Plus, Settings, Trash2, ExternalLink, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface PaymentMethod {
  id: string;
  payment_method_type: string;
  provider_name: string;
  is_active: boolean;
  country_code: string;
  created_at: string;
}

const PaymentConfiguration = () => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [totalMethods, setTotalMethods] = useState(0);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newMethod, setNewMethod] = useState({
    payment_method_type: '',
    provider_name: '',
    country_code: 'KE',
    is_active: true
  });
  const { page, pageSize, offset, setPage, setPageSize } = useUrlPageParam({ defaultPage: 1, pageSize: 10 });

  useEffect(() => {
    loadPaymentMethods();
  }, [page, pageSize]);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      
      // Get total count
      const { count } = await supabase
        .from('approved_payment_methods')
        .select('*', { count: 'exact', head: true });

      setTotalMethods(count || 0);

      // Get paginated data
      const { data, error } = await supabase
        .from('approved_payment_methods')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;
      setPaymentMethods(data || []);
    } catch (error) {
      console.error('Error loading payment methods:', error);
      toast.error("Failed to load payment methods.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMethod = async () => {
    try {
      const { error } = await supabase
        .from('approved_payment_methods')
        .insert([newMethod]);

      if (error) throw error;

      toast.success("Payment method created successfully.");
      setCreateDialogOpen(false);
      setNewMethod({
        payment_method_type: '',
        provider_name: '',
        country_code: 'KE',
        is_active: true
      });
      loadPaymentMethods();
    } catch (error) {
      console.error('Error creating payment method:', error);
      toast.error("Failed to create payment method.");
    }
  };

  const toggleMethodStatus = async (methodId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('approved_payment_methods')
        .update({ is_active: !currentStatus })
        .eq('id', methodId);

      if (error) throw error;

      toast.success("Payment method status updated.");
      loadPaymentMethods();
    } catch (error) {
      console.error('Error updating payment method:', error);
      toast.error("Failed to update payment method.");
    }
  };

  const deleteMethod = async (methodId: string) => {
    try {
      const { error } = await supabase
        .from('approved_payment_methods')
        .delete()
        .eq('id', methodId);

      if (error) throw error;

      toast.success("Payment method deleted successfully.");
      loadPaymentMethods();
    } catch (error) {
      console.error('Error deleting payment method:', error);
      toast.error("Failed to delete payment method.");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-3 sm:p-4 lg:p-6">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="bg-tint-gray p-3 sm:p-4 lg:p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-primary">Payment Configuration</h1>
            <p className="text-muted-foreground">
              Manage payment methods and platform-wide payment settings
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/jenga-payment-test">
              <Button variant="outline">
                <CreditCard className="h-4 w-4 mr-2" />
                Jenga PAY Test
              </Button>
            </Link>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Payment Method
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Payment Method</DialogTitle>
                </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="provider_name">Provider Name</Label>
                  <Input
                    id="provider_name"
                    value={newMethod.provider_name}
                    onChange={(e) => setNewMethod({ ...newMethod, provider_name: e.target.value })}
                    placeholder="e.g., Safaricom M-Pesa"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment_method_type">Payment Type</Label>
                  <Select
                    value={newMethod.payment_method_type}
                    onValueChange={(value) => setNewMethod({ ...newMethod, payment_method_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mpesa">M-Pesa</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="card">Credit/Debit Card</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="crypto">Cryptocurrency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country_code">Country</Label>
                  <Select
                    value={newMethod.country_code}
                    onValueChange={(value) => setNewMethod({ ...newMethod, country_code: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KE">Kenya (KE)</SelectItem>
                      <SelectItem value="UG">Uganda (UG)</SelectItem>
                      <SelectItem value="TZ">Tanzania (TZ)</SelectItem>
                      <SelectItem value="US">United States (US)</SelectItem>
                      <SelectItem value="GB">United Kingdom (GB)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={newMethod.is_active}
                    onCheckedChange={(checked) => setNewMethod({ ...newMethod, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateMethod}>
                    Create Method
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Platform Payment Configurations */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Platform M-Pesa Configuration */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <CardTitle>Platform M-Pesa</CardTitle>
                </div>
                <Badge variant="default">Active</Badge>
              </div>
              <CardDescription>
                Default M-Pesa credentials for tenant payments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-background rounded-lg border">
                  <p className="text-xs text-muted-foreground">Shortcode</p>
                  <p className="text-lg font-mono font-bold">4155923</p>
                </div>
                <div className="p-3 bg-background rounded-lg border">
                  <p className="text-xs text-muted-foreground">Environment</p>
                  <Badge variant="outline">Production</Badge>
                </div>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/admin/platform-payment-config" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Manage Config
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Jenga PAY Configuration */}
          <Card className="border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  <CardTitle>Jenga PAY (Equity Bank)</CardTitle>
                </div>
                <Badge variant="default" className="bg-blue-600">Active</Badge>
              </div>
              <CardDescription>
                Equity Bank payments via Paybill 247247
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-background rounded-lg border">
                  <p className="text-xs text-muted-foreground">Paybill Number</p>
                  <p className="text-lg font-mono font-bold">247247</p>
                </div>
                <div className="p-3 bg-background rounded-lg border">
                  <p className="text-xs text-muted-foreground">Integration</p>
                  <Badge variant="outline">IPN Callbacks</Badge>
                </div>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/admin/jenga-payment-test" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Test & Monitor
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Methods Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Methods
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentMethods.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4">
                      No payment methods found. Create your first payment method.
                    </TableCell>
                  </TableRow>
                ) : (
                  paymentMethods.map((method) => (
                    <TableRow key={method.id}>
                      <TableCell className="font-medium">{method.provider_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {method.payment_method_type.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>{method.country_code}</TableCell>
                      <TableCell>
                        <Badge variant={method.is_active ? "default" : "secondary"}>
                          {method.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(method.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleMethodStatus(method.id, method.is_active)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteMethod(method.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            
            {/* Pagination */}
            <div className="mt-4">
              <TablePaginator
                currentPage={page}
                totalPages={Math.ceil(totalMethods / pageSize)}
                pageSize={pageSize}
                totalItems={totalMethods}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                showPageSizeSelector={true}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PaymentConfiguration;