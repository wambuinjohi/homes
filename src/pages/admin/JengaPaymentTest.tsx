import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Building2, 
  Send, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Clock,
  RefreshCw,
  ArrowLeft
} from "lucide-react";
import { Link } from "react-router-dom";

interface IPNCallback {
  id: string;
  transaction_reference: string;
  amount: number;
  status: string;
  customer_name: string;
  customer_mobile: string;
  payment_mode: string;
  created_at: string;
  processed: boolean;
}

export default function JengaPaymentTest() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [callbacks, setCallbacks] = useState<IPNCallback[]>([]);
  const [testData, setTestData] = useState({
    amount: '1000',
    phoneNumber: '+254712345678',
    billNumber: 'TEST001',
    customerName: 'Test Customer'
  });
  const [stats, setStats] = useState({
    total: 0,
    successful: 0,
    pending: 0,
    failed: 0
  });

  useEffect(() => {
    loadCallbacks();
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('jenga_ipn_callbacks')
        .select('status, processed', { count: 'exact' });

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        successful: data?.filter(c => c.status === 'SUCCESS').length || 0,
        pending: data?.filter(c => !c.processed).length || 0,
        failed: data?.filter(c => c.status !== 'SUCCESS' && c.processed).length || 0
      };

      setStats(stats);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadCallbacks = async () => {
    try {
      const { data, error } = await supabase
        .from('jenga_ipn_callbacks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setCallbacks(data || []);
    } catch (error) {
      console.error('Error loading callbacks:', error);
      toast({
        title: "Error",
        description: "Failed to load IPN callbacks",
        variant: "destructive"
      });
    }
  };

  const simulateIPNCallback = async () => {
    setLoading(true);
    try {
      // Simulate Jenga IPN callback
      const ipnPayload = {
        callbackType: "IPN",
        customer: {
          name: testData.customerName,
          mobileNumber: testData.phoneNumber,
          reference: testData.billNumber
        },
        transaction: {
          date: new Date().toISOString(),
          reference: `JGN${Date.now()}`,
          paymentMode: "CARD",
          amount: parseFloat(testData.amount),
          billNumber: testData.billNumber,
          servedBy: "EQ",
          additionalInfo: "CARD",
          orderAmount: parseFloat(testData.amount),
          serviceCharge: parseFloat(testData.amount) * 0.035,
          status: "SUCCESS",
          remarks: "SUCCESS"
        },
        bank: {
          reference: `BNK${Date.now()}`,
          transactionType: "C",
          account: "null"
        }
      };

      // Call our edge function
      const { data, error } = await supabase.functions.invoke('jenga-ipn-callback', {
        body: ipnPayload
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Test IPN callback processed successfully"
      });

      // Reload callbacks
      await loadCallbacks();
      await loadStats();
    } catch (error) {
      console.error('Error simulating payment:', error);
      toast({
        title: "Error",
        description: "Failed to simulate payment",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string, processed: boolean) => {
    if (!processed) {
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    }

    if (status === 'SUCCESS') {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
          <CheckCircle className="h-3 w-3 mr-1" />
          Success
        </Badge>
      );
    }

    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 mr-1" />
        Failed
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link to="/admin/payment-config">
              <Button variant="ghost" size="sm" className="mb-2">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Payment Config
              </Button>
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8 text-green-600" />
              Jenga PAY Test Console
            </h1>
            <p className="text-muted-foreground mt-1">
              Test Equity Bank Jenga PAY integration and monitor IPN callbacks
            </p>
          </div>
          <Button variant="outline" onClick={() => { loadCallbacks(); loadStats(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Callbacks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Successful</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.successful}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="test" className="space-y-4">
          <TabsList>
            <TabsTrigger value="test">Test Payment</TabsTrigger>
            <TabsTrigger value="callbacks">IPN Callbacks</TabsTrigger>
          </TabsList>

          {/* Test Payment Tab */}
          <TabsContent value="test" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Simulate Jenga PAY Transaction</CardTitle>
                <CardDescription>
                  Test the IPN callback handler by simulating a payment from Equity Bank
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount (KES)</Label>
                    <Input
                      id="amount"
                      type="number"
                      value={testData.amount}
                      onChange={(e) => setTestData({ ...testData, amount: e.target.value })}
                      placeholder="1000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Customer Phone</Label>
                    <Input
                      id="phone"
                      value={testData.phoneNumber}
                      onChange={(e) => setTestData({ ...testData, phoneNumber: e.target.value })}
                      placeholder="+254712345678"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bill">Bill Number</Label>
                    <Input
                      id="bill"
                      value={testData.billNumber}
                      onChange={(e) => setTestData({ ...testData, billNumber: e.target.value })}
                      placeholder="TEST001"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customer">Customer Name</Label>
                    <Input
                      id="customer"
                      value={testData.customerName}
                      onChange={(e) => setTestData({ ...testData, customerName: e.target.value })}
                      placeholder="Test Customer"
                    />
                  </div>
                </div>

                <Button
                  onClick={simulateIPNCallback}
                  disabled={loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Simulating Payment...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Simulate IPN Callback
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Callbacks Tab */}
          <TabsContent value="callbacks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent IPN Callbacks</CardTitle>
                <CardDescription>
                  View all Jenga PAY instant payment notifications received
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {callbacks.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No IPN callbacks received yet</p>
                      <p className="text-sm mt-2">Test a payment to see callbacks here</p>
                    </div>
                  ) : (
                    callbacks.map((callback) => (
                      <div
                        key={callback.id}
                        className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-medium">
                                {callback.transaction_reference}
                              </span>
                              {getStatusBadge(callback.status, callback.processed)}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {callback.customer_name} • {callback.customer_mobile}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(callback.created_at).toLocaleString()} • {callback.payment_mode}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-green-600">
                              KES {callback.amount.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
