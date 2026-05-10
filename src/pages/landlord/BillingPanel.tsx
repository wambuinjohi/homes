import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  CreditCard, 
  DollarSign, 
  Calendar, 
  Clock, 
  AlertTriangle,
  MessageSquare,
  Download,
  ExternalLink,
  CheckCircle,
  XCircle,
  ArrowRight,
  Zap,
  Star,
  Crown,
  Phone
} from "lucide-react";

interface SubscriptionData {
  id: string;
  status: string;
  trial_start_date?: string;
  trial_end_date?: string;
  next_billing_date?: string;
  sms_credits_balance: number;
  billing_plan?: {
    name: string;
    price: number;
    billing_cycle: string;
    features: any;
    max_properties: number;
    max_units: number;
    sms_credits_included: number;
  };
}

interface PaymentTransaction {
  id: string;
  transaction_id: string;
  amount: number;
  status: string;
  processed_at: string;
  created_at: string;
  payment_method: string;
}

interface SMSBundle {
  id: string;
  name: string;
  description: string;
  sms_count: number;
  price: number;
}

const BillingPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [smsBundles, setSmsBundles] = useState<SMSBundle[]>([]);
  const [selectedBundle, setSelectedBundle] = useState<SMSBundle | null>(null);
  const [showSMSPaymentDialog, setShowSMSPaymentDialog] = useState(false);
  const [selectedSMSBundle, setSelectedSMSBundle] = useState<SMSBundle | null>(null);
  const [smsPhoneNumber, setSmsPhoneNumber] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    if (user) {
      fetchBillingData();
    }
  }, [user]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);

      // Fetch subscription data
      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from("landlord_subscriptions")
        .select(`
          *,
          billing_plan:billing_plans(*)
        `)
        .eq("landlord_id", user?.id)
        .single();

      if (subscriptionError && subscriptionError.code !== 'PGRST116') {
        throw subscriptionError;
      }

      // Fetch payment transactions for landlord billing
      const { data: invoicesData, error: invoicesError } = await supabase
        .from("payment_transactions")
        .select("*")
        .eq("landlord_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (invoicesError) {
        console.error("Error fetching payment transactions:", invoicesError);
      }

      // Fetch SMS bundles
      const { data: bundlesData, error: bundlesError } = await supabase
        .from("sms_bundles")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });

      if (bundlesError) throw bundlesError;

      setSubscription(subscriptionData);
      setTransactions(invoicesData || []);
      setSmsBundles(bundlesData || []);

    } catch (error) {
      console.error("Error fetching billing data:", error);
      toast({
        title: "Error",
        description: "Failed to load billing data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getTrialProgress = () => {
    if (!subscription?.trial_start_date || !subscription?.trial_end_date) return 0;
    
    const start = new Date(subscription.trial_start_date);
    const end = new Date(subscription.trial_end_date);
    const now = new Date();
    
    const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const remainingDays = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    
    return Math.max(0, Math.min(100, ((totalDays - remainingDays) / totalDays) * 100));
  };

  const handlePurchaseSMS = (bundle: SMSBundle) => {
    setSelectedSMSBundle(bundle);
    setShowSMSPaymentDialog(true);
  };

  const initiateSMSBundlePayment = async () => {
    if (!smsPhoneNumber || !selectedSMSBundle) return;
    
    setProcessingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('mpesa-stk-push', {
        body: {
          amount: selectedSMSBundle.price,
          phone_number: smsPhoneNumber,
          payment_type: 'sms_bundle',
          metadata: {
            bundle_id: selectedSMSBundle.id,
            bundle_name: selectedSMSBundle.name,
            sms_count: selectedSMSBundle.sms_count,
            landlord_id: user?.id
          }
        }
      });

      if (error) throw error;

      toast({
        title: "Payment Initiated",
        description: "Please check your phone and enter your M-Pesa PIN",
      });

      setShowSMSPaymentDialog(false);
      setSmsPhoneNumber('');
      
      // Refresh billing data after a short delay to allow callback processing
      setTimeout(() => {
        fetchBillingData();
      }, 3000);
    } catch (error: any) {
      console.error("Error initiating SMS bundle payment:", error);
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to initiate payment",
        variant: "destructive",
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleUpgradePlan = () => {
    navigate('/upgrade');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      trial: { 
        variant: "secondary" as const, 
        label: "Free Trial", 
        icon: Clock,
        color: "bg-blue-100 text-blue-800"
      },
      active: { 
        variant: "default" as const, 
        label: "Active", 
        icon: CheckCircle,
        color: "bg-green-100 text-green-800"
      },
      suspended: { 
        variant: "destructive" as const, 
        label: "Suspended", 
        icon: XCircle,
        color: "bg-red-100 text-red-800"
      },
      overdue: { 
        variant: "destructive" as const, 
        label: "Overdue", 
        icon: AlertTriangle,
        color: "bg-orange-100 text-orange-800"
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.trial;
    const IconComponent = config.icon;
    
    return (
      <Badge variant={config.variant} className={`${config.color} flex items-center gap-1`}>
        <IconComponent className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getPlanIcon = (planName: string) => {
    switch (planName?.toLowerCase()) {
      case 'starter':
        return <Zap className="h-5 w-5 text-blue-500" />;
      case 'professional':
        return <Star className="h-5 w-5 text-purple-500" />;
      case 'enterprise':
        return <Crown className="h-5 w-5 text-gold-500" />;
      default:
        return <CreditCard className="h-5 w-5 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">Loading...</div>
      </DashboardLayout>
    );
  }

  const daysRemaining = subscription?.trial_end_date ? getDaysRemaining(subscription.trial_end_date) : 0;
  const isTrialEnding = subscription?.status === 'trial' && daysRemaining <= 3;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Billing & Subscription</h1>
            <p className="text-muted-foreground">
              Manage your subscription, payments, and SMS credits
            </p>
          </div>
        </div>

        {/* Trial Warning */}
        {isTrialEnding && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                Your free trial expires in <strong>{daysRemaining} days</strong>. 
                Upgrade now to continue using Zira Homes.
              </span>
              <Button size="sm" onClick={handleUpgradePlan}>
                Upgrade Now
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Current Plan Card */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full" />
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getPlanIcon(subscription?.billing_plan?.name || '')}
                <div>
                  <CardTitle className="text-xl">
                    {subscription?.billing_plan?.name || 'No Plan'} Plan
                  </CardTitle>
                  <CardDescription>
                    {subscription?.status === 'trial' ? 'Free Trial Period' : 'Active Subscription'}
                  </CardDescription>
                </div>
              </div>
              {getStatusBadge(subscription?.status || 'trial')}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {subscription?.status === 'trial' && subscription.trial_end_date ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Trial Progress</span>
                  <span>{daysRemaining} days remaining</span>
                </div>
                <Progress value={getTrialProgress()} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  Trial ends on {new Date(subscription.trial_end_date).toLocaleDateString()}
                </p>
              </div>
            ) : subscription?.next_billing_date ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Next billing date</span>
                <span className="font-medium">
                  {new Date(subscription.next_billing_date).toLocaleDateString()}
                </span>
              </div>
            ) : null}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {subscription?.billing_plan?.max_properties === -1 ? '∞' : subscription?.billing_plan?.max_properties || 0}
                </div>
                <div className="text-sm text-muted-foreground">Properties</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {subscription?.billing_plan?.max_units === -1 ? '∞' : subscription?.billing_plan?.max_units || 0}
                </div>
                <div className="text-sm text-muted-foreground">Units</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {subscription?.sms_credits_balance || 0}
                </div>
                <div className="text-sm text-muted-foreground">SMS Credits</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  KES {subscription?.billing_plan?.price || 0}
                </div>
                <div className="text-sm text-muted-foreground">
                  /{subscription?.billing_plan?.billing_cycle || 'month'}
                </div>
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <Button onClick={handleUpgradePlan} className="flex-1">
                <ArrowRight className="h-4 w-4 mr-2" />
                {subscription?.status === 'trial' ? 'Upgrade Plan' : 'Change Plan'}
              </Button>
            <Button variant="outline" onClick={() => navigate('/billing')}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Billing Details
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          {/* SMS Credits Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MessageSquare className="h-5 w-5 mr-2" />
                SMS Credits
              </CardTitle>
              <CardDescription>
                Purchase additional SMS credits for tenant communication
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                <div>
                  <div className="text-2xl font-bold">
                    {subscription?.sms_credits_balance || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Available Credits</div>
                </div>
                <Badge variant="outline" className="bg-background">
                  KES {((subscription?.sms_credits_balance || 0) * 2.5).toFixed(2)} value
                </Badge>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Available Bundles</h4>
                {smsBundles.slice(0, 2).map((bundle) => (
                  <div key={bundle.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{bundle.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {bundle.sms_count} SMS credits
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">KES {bundle.price}</div>
                      <Button 
                        size="sm" 
                        onClick={() => handlePurchaseSMS(bundle)}
                        className="mt-1"
                      >
                        Buy Now
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    View All Bundles
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>SMS Credit Bundles</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 md:grid-cols-2">
                    {smsBundles.map((bundle) => (
                      <Card key={bundle.id} className="relative">
                        <CardHeader>
                          <CardTitle className="text-lg">{bundle.name}</CardTitle>
                          <CardDescription>{bundle.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-primary">
                            KES {bundle.price}
                          </div>
                          <div className="text-sm text-muted-foreground mb-4">
                            {bundle.sms_count} SMS credits
                          </div>
                          <div className="text-sm text-muted-foreground mb-4">
                            KES {(bundle.price / bundle.sms_count).toFixed(3)} per SMS
                          </div>
                          <Button 
                            className="w-full"
                            onClick={() => handlePurchaseSMS(bundle)}
                          >
                            Purchase Bundle
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Recent Transactions
              </CardTitle>
              <CardDescription>
                View your billing and payment history
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length > 0 ? (
                <div className="space-y-3">
                  {transactions.slice(0, 5).map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{transaction.transaction_id || 'System Transaction'}</div>
                        <div className="text-sm text-muted-foreground">
                          {transaction.payment_method} • {new Date(transaction.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">KES {transaction.amount}</div>
                        <Badge 
                          variant={transaction.status === 'completed' ? 'default' : transaction.status === 'pending' ? 'secondary' : 'destructive'}
                          className="text-xs"
                        >
                          {transaction.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    View All Transactions
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No transactions yet</p>
                  <p className="text-sm">Your billing history will appear here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Plan Features */}
        {subscription?.billing_plan && (
          <Card>
            <CardHeader>
              <CardTitle>Plan Features</CardTitle>
              <CardDescription>
                What's included in your {subscription.billing_plan.name} plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {subscription.billing_plan.features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* SMS Bundle Payment Dialog */}
      <Dialog open={showSMSPaymentDialog} onOpenChange={setShowSMSPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Purchase SMS Bundle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-accent/50 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-muted-foreground">Bundle:</span>
                <span className="font-medium">{selectedSMSBundle?.name}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-muted-foreground">SMS Credits:</span>
                <span className="font-medium">{selectedSMSBundle?.sms_count}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-bold">
                <span>Total Amount:</span>
                <span>KES {selectedSMSBundle?.price}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="sms-phone">M-Pesa Phone Number</Label>
              <Input
                id="sms-phone"
                placeholder="254712345678"
                value={smsPhoneNumber}
                onChange={(e) => setSmsPhoneNumber(e.target.value)}
                disabled={processingPayment}
              />
              <p className="text-xs text-muted-foreground">
                Enter your M-Pesa registered phone number
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowSMSPaymentDialog(false);
                  setSmsPhoneNumber('');
                }}
                disabled={processingPayment}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={initiateSMSBundlePayment}
                disabled={!smsPhoneNumber || processingPayment}
                className="flex-1"
              >
                <Phone className="h-4 w-4 mr-2" />
                {processingPayment ? 'Processing...' : 'Pay with M-Pesa'}
              </Button>
            </div>

            <Alert>
              <MessageSquare className="h-4 w-4" />
              <AlertDescription className="text-xs">
                You will receive an STK push on your phone. Enter your M-Pesa PIN to complete the payment.
              </AlertDescription>
            </Alert>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default BillingPanel;