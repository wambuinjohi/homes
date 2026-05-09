import React, { useState } from 'react';
import { formatAmount } from '@/utils/currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { TrialCountdown } from './TrialCountdown';
import { useToast } from '@/hooks/use-toast';
import { TablePaginator } from '@/components/ui/table-paginator';
import { Search, Filter, Eye, Settings, Crown } from 'lucide-react';
import { SubscriptionDetailsDialog } from './SubscriptionDetailsDialog';

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
  };
  profiles?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface PropertyStakeholderSubscriptionsProps {
  subscriptions: PropertyStakeholderSubscription[];
  billingPlans: any[];
  onAssignPlan: (landlordId: string, planId: string) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
}

export const PropertyStakeholderSubscriptions: React.FC<PropertyStakeholderSubscriptionsProps> = ({
  subscriptions,
  billingPlans,
  onAssignPlan,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}) => {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<{
    landlordId: string;
    planId: string;
    stakeholderName: string;
    currentPlan: any;
    newPlan: any;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<PropertyStakeholderSubscription | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const formatCurrency = (amount: number, currency?: string) => {
    return formatAmount(amount, currency);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'Landlord':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'Manager':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'Agent':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const handlePlanChange = (landlordId: string, planId: string, subscription: PropertyStakeholderSubscription) => {
    const newPlan = billingPlans.find(plan => plan.id === planId);
    const currentPlan = subscription.billing_plan;
    const stakeholderName = `${subscription.profiles?.first_name || ''} ${subscription.profiles?.last_name || ''}`.trim();
    
    // Early validation - prevent selecting same plan
    if (currentPlan?.id === planId) {
      toast({
        title: "Same Plan Selected",
        description: "This stakeholder is already on the selected plan.",
        variant: "destructive",
      });
      return;
    }
    
    setPendingChange({
      landlordId,
      planId,
      stakeholderName: stakeholderName || subscription.profiles?.email || 'Unknown User',
      currentPlan,
      newPlan
    });
    setConfirmOpen(true);
  };

  const handleConfirmChange = async () => {
    if (!pendingChange) return;
    
    setIsProcessing(true);
    try {
      await onAssignPlan(pendingChange.landlordId, pendingChange.planId);
      toast({
        title: "Plan Changed Successfully",
        description: `${pendingChange.stakeholderName} has been assigned to ${pendingChange.newPlan?.name || 'the selected plan'}.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to change the subscription plan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setConfirmOpen(false);
      setPendingChange(null);
    }
  };

  const handleCancelChange = () => {
    setConfirmOpen(false);
    setPendingChange(null);
  };

  const handleViewDetails = (subscription: PropertyStakeholderSubscription) => {
    setSelectedSubscription(subscription);
    setDetailsDialogOpen(true);
  };

  // Filtering logic
  const filteredSubscriptions = subscriptions.filter(subscription => {
    const matchesSearch = !searchTerm || 
      subscription.profiles?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subscription.profiles?.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subscription.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || subscription.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Client-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);
  const totalItems = filteredSubscriptions.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedSubscriptions = filteredSubscriptions.slice(startIndex, startIndex + pageSize);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-primary flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Property Stakeholder Subscriptions
            </CardTitle>
            <p className="text-muted-foreground text-sm mt-1">
              Manage subscriptions for all property owners, landlords, managers, and agents
            </p>
          </div>
        </div>
        
        <div className="flex gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 border-border bg-card"
            />
          </div>
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-[180px] border-border bg-card">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trial_expired">Trial Expired</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-primary">Stakeholder</TableHead>
                <TableHead className="text-primary">Role</TableHead>
                <TableHead className="text-primary">Properties</TableHead>
                <TableHead className="text-primary">Units</TableHead>
                <TableHead className="text-primary">Tenants</TableHead>
                <TableHead className="text-primary">Plan</TableHead>
                <TableHead className="text-primary">Status</TableHead>
                <TableHead className="text-primary">Trial Progress</TableHead>
                <TableHead className="text-primary">SMS Credits</TableHead>
                <TableHead className="text-primary">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedSubscriptions.map((subscription) => (
                <TableRow key={subscription.id} className="border-border">
                  <TableCell>
                    <div>
                      <div className="font-medium text-primary">
                        {subscription.profiles?.first_name} {subscription.profiles?.last_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {subscription.profiles?.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getRoleBadgeColor(subscription.role)}>
                      {subscription.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Badge variant={subscription.property_count === 0 ? "secondary" : "default"}>
                        {subscription.property_count || 0}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Badge variant={subscription.unit_count === 0 ? "secondary" : "default"}>
                        {subscription.unit_count || 0}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Badge variant={subscription.tenant_count === 0 ? "secondary" : "default"}>
                        {subscription.tenant_count || 0}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-primary">
                        {subscription.billing_plan?.name || "No Plan"}
                      </div>
                      {subscription.billing_plan && (
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(subscription.billing_plan.price, subscription.billing_plan.currency)} / {subscription.billing_plan.billing_cycle}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <TrialCountdown 
                      daysRemaining={subscription.daysRemaining}
                      status={subscription.status}
                    />
                  </TableCell>
                   <TableCell>
                     {subscription.status === 'trial' && subscription.trial_start_date && subscription.trial_end_date && (
                       <div className="space-y-1">
                         {(() => {
                           const totalTrialDays = Math.ceil(
                             (new Date(subscription.trial_end_date).getTime() - new Date(subscription.trial_start_date).getTime()) / (1000 * 60 * 60 * 24)
                           );
                           const progressPercentage = Math.max(5, Math.min(100, ((totalTrialDays - subscription.daysRemaining) / totalTrialDays) * 100));
                           
                           return (
                             <>
                               <div className="w-full bg-muted rounded-full h-2">
                                 <div 
                                   className={`h-2 rounded-full transition-all ${
                                     subscription.daysRemaining <= 3 
                                       ? 'bg-destructive' 
                                       : subscription.daysRemaining <= 7 
                                       ? 'bg-orange-500' 
                                       : 'bg-primary'
                                   }`}
                                   style={{ 
                                     width: `${progressPercentage}%` 
                                   }}
                                 />
                               </div>
                               <div className="text-xs text-muted-foreground">
                                 {subscription.daysRemaining} of {totalTrialDays} days
                               </div>
                             </>
                           );
                         })()}
                       </div>
                     )}
                   </TableCell>
                  <TableCell>
                    <span className="font-medium text-primary">
                      {subscription.sms_credits_balance.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-border"
                        onClick={() => handleViewDetails(subscription)}
                        title="View subscription details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Select 
                        value={subscription.billing_plan?.id || ""} 
                        onValueChange={(planId) => handlePlanChange(subscription.landlord_id, planId, subscription)}
                      >
                        <SelectTrigger className="w-32 h-8 border-border bg-card">
                          <SelectValue placeholder="Change Plan" />
                        </SelectTrigger>
                        <SelectContent>
                          {billingPlans.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {paginatedSubscriptions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No stakeholder subscriptions found matching your criteria.
          </div>
        )}
        
        <div className="mt-4">
          <TablePaginator
            currentPage={currentPage}
            totalPages={Math.ceil(Math.max(totalItems, 1) / pageSize)}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            showPageSizeSelector={true}
          />
        </div>
      </CardContent>

      {selectedSubscription && (
        <SubscriptionDetailsDialog
          subscription={selectedSubscription}
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
        />
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-4xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold text-primary">
              Confirm Subscription Plan Change
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Review the plan change details for <span className="font-medium text-primary">{pendingChange?.stakeholderName}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Current Plan */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-muted rounded-full"></div>
                <h3 className="font-medium text-muted-foreground">Current Plan</h3>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 border border-border">
                {pendingChange?.currentPlan ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-primary">{pendingChange.currentPlan.name}</h4>
                      {pendingChange.currentPlan.is_custom && (
                        <Badge variant="secondary" className="text-xs">Custom</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mb-3">
                      {pendingChange.currentPlan.is_custom ? (
                        "Custom pricing available"
                      ) : pendingChange.currentPlan.billing_model === 'percentage' ? (
                        `${pendingChange.currentPlan.percentage_rate}% commission`
                      ) : (
                        `${formatCurrency(pendingChange.currentPlan.price, pendingChange.currentPlan.currency)} / ${pendingChange.currentPlan.billing_cycle}`
                      )}
                    </div>
                    {pendingChange.currentPlan.features && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Features</div>
                        <div className="space-y-1">
                          {pendingChange.currentPlan.features.slice(0, 4).map((feature: string, index: number) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <div className="w-1 h-1 bg-primary rounded-full"></div>
                              <span className="text-muted-foreground">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4">
                    <div className="text-muted-foreground">No current plan</div>
                    <div className="text-xs text-muted-foreground mt-1">Free tier or trial</div>
                  </div>
                )}
              </div>
            </div>

            {/* New Plan */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <h3 className="font-medium text-primary">New Plan</h3>
              </div>
              <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                {pendingChange?.newPlan && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-primary">{pendingChange.newPlan.name}</h4>
                      {pendingChange.newPlan.is_custom && (
                        <Badge variant="default" className="text-xs">Custom</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mb-3">
                      {pendingChange.newPlan.is_custom ? (
                        "Custom pricing available"
                      ) : pendingChange.newPlan.billing_model === 'percentage' ? (
                        `${pendingChange.newPlan.percentage_rate}% commission`
                      ) : (
                        `${formatCurrency(pendingChange.newPlan.price, pendingChange.newPlan.currency)} / ${pendingChange.newPlan.billing_cycle}`
                      )}
                    </div>
                    {pendingChange.newPlan.features && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-primary uppercase tracking-wide">Features</div>
                        <div className="space-y-1">
                          {pendingChange.newPlan.features.slice(0, 4).map((feature: string, index: number) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <div className="w-1 h-1 bg-primary rounded-full"></div>
                              <span className="text-foreground">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Plan Limits */}
                    {(pendingChange.newPlan.property_limit || pendingChange.newPlan.unit_limit || pendingChange.newPlan.tenant_limit) && (
                      <div className="mt-3 pt-3 border-t border-primary/20">
                        <div className="text-xs font-medium text-primary uppercase tracking-wide mb-1">Limits</div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {pendingChange.newPlan.property_limit && (
                            <div className="text-center">
                              <div className="font-medium text-foreground">{pendingChange.newPlan.property_limit}</div>
                              <div className="text-muted-foreground">Properties</div>
                            </div>
                          )}
                          {pendingChange.newPlan.unit_limit && (
                            <div className="text-center">
                              <div className="font-medium text-foreground">{pendingChange.newPlan.unit_limit}</div>
                              <div className="text-muted-foreground">Units</div>
                            </div>
                          )}
                          {pendingChange.newPlan.tenant_limit && (
                            <div className="text-center">
                              <div className="font-medium text-foreground">{pendingChange.newPlan.tenant_limit}</div>
                              <div className="text-muted-foreground">Tenants</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Impact Notice */}
          <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
            <div className="flex gap-2">
              <Settings className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <div className="font-medium text-orange-800 dark:text-orange-200">Billing Impact</div>
                <div className="text-orange-700 dark:text-orange-300">
                  This change will take effect immediately and update the stakeholder's billing cycle and features.
                  {pendingChange?.newPlan?.is_custom && " Custom pricing requires separate billing arrangement."}
                </div>
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelChange} disabled={isProcessing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmChange} 
              disabled={isProcessing}
              className="bg-primary hover:bg-primary/90"
            >
              {isProcessing ? "Updating Plan..." : "Confirm Plan Change"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};