import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatAmount } from '@/utils/currency';
import { Calendar, CreditCard, MessageSquare, Settings, TrendingUp, Building } from 'lucide-react';
import { format } from 'date-fns';

interface SubscriptionDetailsDialogProps {
  subscription: {
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
      features?: string[];
    };
    profiles?: {
      first_name: string;
      last_name: string;
      email: string;
    };
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlanChange?: (planId: string) => void;
}

export const SubscriptionDetailsDialog: React.FC<SubscriptionDetailsDialogProps> = ({
  subscription,
  open,
  onOpenChange,
}) => {
  const stakeholderName = `${subscription.profiles?.first_name || ''} ${subscription.profiles?.last_name || ''}`.trim() || 'Unknown User';
  
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      trial: { label: 'Trial', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
      active: { label: 'Active', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
      trial_expired: { label: 'Trial Expired', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
      suspended: { label: 'Suspended', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
    };
    return variants[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  };

  const statusInfo = getStatusBadge(subscription.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold text-primary">{stakeholderName}</DialogTitle>
              <DialogDescription className="text-muted-foreground mt-1">
                {subscription.profiles?.email}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Badge className={statusInfo.className}>
                {statusInfo.label}
              </Badge>
              <Badge variant="outline" className="border-primary text-primary">
                {subscription.role}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="plan">Plan Details</TabsTrigger>
            <TabsTrigger value="usage">Usage Stats</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Current Plan Card */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Current Plan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {subscription.billing_plan ? (
                    <div>
                      <div className="text-2xl font-bold text-primary mb-1">
                        {subscription.billing_plan.name}
                      </div>
                      <div className="text-muted-foreground">
                        {formatAmount(subscription.billing_plan.price, subscription.billing_plan.currency)} / {subscription.billing_plan.billing_cycle}
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">No plan assigned</div>
                  )}
                </CardContent>
              </Card>

              {/* SMS Credits Card */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    SMS Credits
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary mb-1">
                    {subscription.sms_credits_balance.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Available credits
                  </div>
                </CardContent>
              </Card>

              {/* Trial Info Card */}
              {subscription.status === 'trial' && subscription.trial_end_date && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Trial Period
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary mb-1">
                      {subscription.daysRemaining} days
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Ends {format(new Date(subscription.trial_end_date), 'MMM dd, yyyy')}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Next Billing Card */}
              {subscription.next_billing_date && (
                <Card className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Next Billing
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-semibold text-primary">
                      {format(new Date(subscription.next_billing_date), 'MMM dd, yyyy')}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="plan" className="space-y-4 mt-4">
            {subscription.billing_plan ? (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-xl text-primary">{subscription.billing_plan.name}</CardTitle>
                  <div className="text-2xl font-bold text-primary mt-2">
                    {formatAmount(subscription.billing_plan.price, subscription.billing_plan.currency)}
                    <span className="text-sm text-muted-foreground ml-2">/ {subscription.billing_plan.billing_cycle}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  {subscription.billing_plan.features && subscription.billing_plan.features.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-primary mb-3">Plan Features</h4>
                      <div className="space-y-2">
                        {subscription.billing_plan.features.map((feature, index) => (
                          <div key={index} className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-primary rounded-full mt-2" />
                            <span className="text-muted-foreground">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No billing plan assigned</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="usage" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 gap-4">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Account Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Subscription Status</span>
                      <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Account Type</span>
                      <span className="font-medium text-primary">{subscription.role}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">SMS Credits Balance</span>
                      <span className="font-medium text-primary">{subscription.sms_credits_balance.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Portfolio Stats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Properties</span>
                      <span className="font-medium text-primary text-xl">{subscription.property_count || 0}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Units</span>
                      <span className="font-medium text-primary text-xl">{subscription.unit_count || 0}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Active Tenants</span>
                      <span className="font-medium text-primary text-xl">{subscription.tenant_count || 0}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Occupancy Rate</span>
                      <span className="font-medium text-primary text-xl">
                        {subscription.unit_count && subscription.unit_count > 0 
                          ? `${Math.round((subscription.tenant_count || 0) / subscription.unit_count * 100)}%`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
