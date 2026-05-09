import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenantLeases } from "@/hooks/useTenantLeases";
import { useTenantDashboardData } from "@/hooks/tenant/useTenantDashboardData";
import { useRealtimeDashboard } from "@/hooks/useRealtimeDashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { TenantLayout } from "@/components/TenantLayout";
import { LeaseSelector } from "@/components/tenant/LeaseSelector";
import {
  Home,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Calendar,
  Bell,
  Wrench,
  Users,
  TrendingUp,
  MapPin,
  Phone,
  Mail,
  Shield,
  AlertCircle,
  Building2,
} from "lucide-react";
import { format, differenceInDays, isAfter } from "date-fns";
import { TenantQuickActions } from "@/components/tenant/TenantQuickActions";
import { BankPaymentGuide } from "@/components/tenant/BankPaymentGuide";
import { useTenantContacts } from "@/hooks/useTenantContacts";
import { useNavigate } from "react-router-dom";
import { isInvoicePayable, getInvoiceCardClass } from "@/utils/invoiceStatusUtils";

export default function TenantDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { contacts, loading: contactsLoading, error: contactsError } = useTenantContacts();
  const { leases, loading: leasesLoading, hasMultipleLeases, hasMultipleProperties, getActiveLease } = useTenantLeases();
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);

  // Get the lease to display data for
  const activeLease = selectedLeaseId 
    ? leases.find(l => l.id === selectedLeaseId) 
    : getActiveLease();

  // Use React Query hook for data fetching with caching - pass the activeLease for consistent data
  const { data: tenantData, isLoading: dashboardLoading, refetch } = useTenantDashboardData(activeLease?.id);

  // Set up realtime updates for instant dashboard refresh
  useRealtimeDashboard({
    onPaymentUpdate: () => {
      console.log('Payment updated - refreshing dashboard');
      refetch();
    },
    onInvoiceUpdate: () => {
      console.log('Invoice updated - refreshing dashboard');
      refetch();
    },
  });

  useEffect(() => {
    // Set initial selected lease when leases load
    if (leases.length > 0 && !selectedLeaseId) {
      setSelectedLeaseId(getActiveLease()?.id || leases[0].id);
    }
  }, [leases, selectedLeaseId, getActiveLease]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-500";
      case "pending":
        return "bg-yellow-500";
      case "overdue":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle className="h-4 w-4" />;
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "overdue":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  // Show loading state while leases or dashboard data is loading
  if (leasesLoading || (leases.length > 0 && dashboardLoading)) {
    return (
      <TenantLayout>
        <div className="container mx-auto p-2 sm:p-4 max-w-6xl space-y-4 sm:space-y-6">
          {/* Loading skeletons for progressive rendering */}
          <div className="mb-4 sm:mb-6 space-y-2">
            <Skeleton className="h-8 w-64" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
          
          <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-2 sm:p-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </TenantLayout>
    );
  }

  // Show empty state if no leases after loading is complete
  if (!leasesLoading && leases.length === 0) {
    return (
      <TenantLayout>
        <div className="container mx-auto p-6">
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Tenant Dashboard</h1>
              <p className="text-muted-foreground">
                You are logged in as: <strong>{user?.email}</strong>
              </p>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No tenant profile found for this account. This dashboard is only accessible to tenant users. 
                If you believe this is an error, please contact your property manager.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </TenantLayout>
    );
  }

  if (!tenantData || !activeLease) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Tenant Dashboard</h1>
            <p className="text-muted-foreground">
              You are logged in as: <strong>{user?.email}</strong>
            </p>
          </div>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No tenant profile found for this account. This dashboard is only accessible to tenant users. 
              If you believe this is an error, please contact your property manager.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const { tenant, lease, property, unit, currentInvoice, recentPayments, maintenanceRequests, announcements } = tenantData;

  // Show a message if tenant exists but no active lease
  if (tenant && !lease) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Welcome, {tenant.first_name}!
            </h1>
            <p className="text-muted-foreground">
              Your tenant account is set up, but you don't have an active lease yet.
            </p>
          </div>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No active lease found. Please contact your property manager to set up your lease agreement.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Calculate days until lease end and rent due
  const daysUntilLeaseEnd = lease?.lease_end_date ? 
    differenceInDays(new Date(lease.lease_end_date), new Date()) : null;
  
  const daysUntilRentDue = currentInvoice?.due_date ? 
    differenceInDays(
      new Date(new Date(currentInvoice.due_date).setHours(0, 0, 0, 0)),
      new Date(new Date().setHours(0, 0, 0, 0))
    ) : null;

  const isRentOverdue = currentInvoice && isAfter(new Date(), new Date(currentInvoice.due_date));

  return (
    <TenantLayout>
      <div className="container mx-auto p-2 sm:p-4 max-w-6xl space-y-4 sm:space-y-6">
        {/* Welcome Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2">
            Welcome back, {tenant.first_name}!
          </h1>
          <div className="flex flex-col gap-2 text-sm sm:text-base text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{property?.name} - Unit {unit?.unit_number}</span>
            </div>
            <div className="flex items-center gap-1">
              <Shield className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Lease until {lease?.lease_end_date ? format(new Date(lease.lease_end_date), "MMM yyyy") : "N/A"}</span>
            </div>
            {hasMultipleLeases() && (
              <div className="flex items-center gap-1">
                <Building2 className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">
                  {hasMultipleProperties() ? 
                    `${leases.length} units across multiple properties` : 
                    `${leases.length} units total`
                  }
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Multi-lease Selector */}
        {hasMultipleLeases() && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Your Properties
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LeaseSelector 
                leases={leases}
                selectedLeaseId={selectedLeaseId || activeLease?.id}
                onLeaseSelect={setSelectedLeaseId}
                showAsCards={false}
              />
            </CardContent>
          </Card>
        )}

        {/* Important Alerts */}
        <div className="space-y-4">
          {/* Rent Overdue Alert */}
          {isRentOverdue && (
            <Alert variant="destructive" className="border-red-300 bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="font-medium">
                Your rent payment of KES {currentInvoice.amount?.toLocaleString()} is overdue! 
                Please pay immediately to avoid late fees.
                <Button 
                  size="sm" 
                  className="ml-3"
                  onClick={() => navigate("/tenant/payments")}
                >
                  Pay Now
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Lease Renewal Alert */}
          {daysUntilLeaseEnd && daysUntilLeaseEnd <= 60 && daysUntilLeaseEnd > 0 && (
            <Alert className="border-yellow-300 bg-yellow-50">
              <Calendar className="h-4 w-4" />
              <AlertDescription>
                Your lease expires in {daysUntilLeaseEnd} days. Please contact your property manager about renewal options.
              </AlertDescription>
            </Alert>
          )}

          {/* Upcoming Rent Due */}
          {!isRentOverdue && daysUntilRentDue && daysUntilRentDue <= 7 && daysUntilRentDue > 0 && (
            <Alert className="border-blue-300 bg-blue-50">
              <CreditCard className="h-4 w-4" />
              <AlertDescription>
                Rent payment of KES {currentInvoice.amount?.toLocaleString()} is due in {daysUntilRentDue} days.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Quick Actions */}
        <TenantQuickActions 
          currentInvoice={currentInvoice}
        />

        {/* Payment Instructions */}
        <BankPaymentGuide variant="collapsible" defaultOpen={false} />

        {/* Main Content Grid */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-1">
          {/* Current Rent Status */}
          {currentInvoice && (
            <Card className={getInvoiceCardClass(currentInvoice.status)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="icon-bg-white">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  Current Rent Payment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-white/90">Amount Due</p>
                    <p className="text-2xl font-bold text-white">
                      KES {currentInvoice.amount?.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-white/90">Due Date</p>
                    <p className="text-lg font-medium text-white">
                      {format(new Date(currentInvoice.due_date), "MMM dd, yyyy")}
                {daysUntilRentDue !== null && (
                  <span className={`ml-2 text-sm ${daysUntilRentDue <= 3 ? 'text-white/90' : 'text-white/75'}`}>
                    ({
                      daysUntilRentDue > 1 
                        ? `${daysUntilRentDue} days left`
                        : daysUntilRentDue === 1 
                          ? 'Due tomorrow'
                          : 'Due today'
                    })
                  </span>
                )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                  <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                    {getStatusIcon(currentInvoice.status)}
                    {currentInvoice.status.toUpperCase()}
                  </Badge>
                  {isInvoicePayable(currentInvoice.status) && (
                    <Button 
                      size="sm" 
                      variant="secondary"
                      className="ml-2 bg-white text-primary hover:bg-white/90"
                      onClick={() => navigate("/tenant/payments")}
                    >
                      Pay Now
                    </Button>
                  )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Key Information Cards */}
        <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4">
          <Card className="min-w-0 card-gradient-green">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white/90 truncate">Monthly Rent</p>
                  <p className="text-sm sm:text-lg font-bold truncate text-white">KES {lease?.monthly_rent?.toLocaleString()}</p>
                </div>
                <div className="icon-bg-white flex-shrink-0 ml-1">
                  <DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 card-gradient-purple">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white/90 truncate">Security Deposit</p>
                  <p className="text-sm sm:text-lg font-bold truncate text-white">KES {lease?.security_deposit?.toLocaleString() || "0"}</p>
                </div>
                <div className="icon-bg-white flex-shrink-0 ml-1">
                  <Shield className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 card-gradient-orange">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white/90 truncate">Open Requests</p>
                  <p className="text-sm sm:text-lg font-bold text-white">{maintenanceRequests.filter(r => r.status !== 'completed' && r.status !== 'resolved').length}</p>
                </div>
                <div className="icon-bg-white flex-shrink-0 ml-1">
                  <Wrench className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 card-gradient-navy">
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white/90 truncate">Unit Size</p>
                  <p className="text-sm sm:text-lg font-bold truncate text-white">{unit?.square_feet ? `${unit.square_feet} sq ft` : "N/A"}</p>
                </div>
                <div className="icon-bg-white flex-shrink-0 ml-1">
                  <Home className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity Grid */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Recent Payments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Payment History
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate("/tenant/payments")}
              >
                View All
              </Button>
            </CardHeader>
            <CardContent>
              {recentPayments.length > 0 ? (
                <div className="space-y-3">
                  {recentPayments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                      <div>
                        <p className="font-medium">KES {payment.amount?.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(payment.payment_date), "MMM dd, yyyy")}
                          {payment.payment_method && ` • ${payment.payment_method}`}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Paid
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No payment history available.</p>
              )}
            </CardContent>
          </Card>

          {/* Maintenance Requests */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Maintenance
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate("/tenant/maintenance")}
              >
                New Request
              </Button>
            </CardHeader>
            <CardContent>
              {maintenanceRequests.length > 0 ? (
                <div className="space-y-3">
                  {maintenanceRequests.slice(0, 3).map((request) => (
                    <div key={request.id} className="py-2 border-b last:border-b-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm">{request.title}</p>
                        <Badge 
                          variant="outline"
                          className={
                            request.status === 'completed' ? 'text-green-600 border-green-600' :
                            request.status === 'in_progress' ? 'text-blue-600 border-blue-600' :
                            'text-yellow-600 border-yellow-600'
                          }
                        >
                          {request.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {request.category} • {format(new Date(request.submitted_date), "MMM dd")}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground text-sm mb-2">No maintenance requests</p>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => navigate("/tenant/maintenance")}
                  >
                    Submit Request
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Important Announcements */}
        {announcements.length > 0 && (
          <Card className="card-gradient-navy">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="icon-bg-white">
                  <Bell className="h-5 w-5" />
                </div>
                Important Announcements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {announcements.map((announcement) => (
                  <div 
                    key={announcement.id} 
                    className="p-3 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-sm text-white">{announcement.title}</h4>
                      <div className="flex items-center gap-2">
                        {announcement.is_urgent && (
                          <Badge className="text-xs bg-red-500/80 text-white border-red-400/50">Urgent</Badge>
                        )}
                        <span className="text-xs text-white/90">
                          {format(new Date(announcement.created_at), "MMM dd")}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-white/90">{announcement.message}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact Information - Moved to Bottom */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contact Information
            </CardTitle>
            <CardDescription>
              Get in touch with your property management team
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {contactsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : contactsError ? (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{contactsError}</span>
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact, index) => (
                  <div key={index} className="p-3 rounded-lg border bg-muted/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{contact.name}</span>
                      <Badge variant={contact.isPlatformSupport ? "secondary" : "outline"}>
                        {contact.role}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3" />
                        <span>{contact.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        <span>{contact.email}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => navigate("/tenant/messages")}
              >
                <Mail className="h-4 w-4 mr-2" />
                Send Message
              </Button>
            </div>
          </CardContent>
        </Card>
    </div>
    </TenantLayout>
  );
}