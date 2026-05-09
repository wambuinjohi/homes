import React, { useState, useEffect } from "react";
import { formatAmount } from "@/utils/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Activity, 
  AlertTriangle, 
  Clock, 
  Users, 
  Bell,
  Home,
  CreditCard,
  Wrench,
  UserCheck,
  FileText,
  ArrowRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";

interface ActivityItem {
  type: string;
  icon: any;
  title: string;
  description: string;
  amount?: string;
  time: string;
  color: string;
  bgColor: string;
}

interface AlertItem {
  type: string;
  icon: any;
  title: string;
  description: string;
  time: string;
  priority: 'high' | 'medium' | 'low';
  color: string;
  bgColor: string;
  borderColor: string;
}

export function RecentActivityAlerts() {
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [urgentAlerts, setUrgentAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivityData();
  }, []);

  const fetchActivityData = async () => {
    try {
      // Fetch recent payments
      const { data: payments } = await supabase
        .from('payments')
        .select(`
          id,
          amount,
          payment_date,
          tenants!payments_tenant_id_fkey (first_name, last_name),
          leases!payments_lease_id_fkey (units!leases_unit_id_fkey (unit_number))
        `)
        .eq('status', 'completed')
        .order('payment_date', { ascending: false })
        .limit(2);

      // Fetch recent maintenance requests
      const { data: maintenance } = await supabase
        .from('maintenance_requests')
        .select(`
          id,
          title,
          status,
          completed_date,
          unit_id,
          tenants (first_name, last_name)
        `)
        .eq('status', 'completed')
        .order('completed_date', { ascending: false })
        .limit(2);

      // Fetch recent leases
      const { data: leases } = await supabase
        .from('leases')
        .select(`
          id,
          lease_start_date,
          tenants!leases_tenant_id_fkey (first_name, last_name),
          units!leases_unit_id_fkey (unit_number)
        `)
        .order('lease_start_date', { ascending: false })
        .limit(1);

      // Transform payments to activities
      const paymentActivities: ActivityItem[] = payments?.map(payment => ({
        type: "payment",
        icon: CreditCard,
        title: "Payment Received",
        description: `${payment.tenants?.first_name} ${payment.tenants?.last_name} - Unit ${payment.leases?.units?.unit_number}`,
        amount: formatAmount(payment.amount || 0),
        time: formatDistanceToNow(new Date(payment.payment_date), { addSuffix: true }),
        color: "text-green-600",
        bgColor: "bg-green-50"
      })) || [];

      // Transform maintenance to activities
      const maintenanceActivities: ActivityItem[] = maintenance?.map(request => ({
        type: "maintenance",
        icon: Wrench,
        title: "Maintenance Completed",
        description: `${request.title} - Unit ${request.unit_id || 'N/A'}`,
        time: formatDistanceToNow(new Date(request.completed_date || request.title), { addSuffix: true }),
        color: "text-blue-600",
        bgColor: "bg-blue-50"
      })) || [];

      // Transform leases to activities
      const leaseActivities: ActivityItem[] = leases?.map(lease => ({
        type: "lease",
        icon: FileText,
        title: "Lease Signed",
        description: `${lease.tenants?.first_name} ${lease.tenants?.last_name} - Unit ${lease.units?.unit_number}`,
        time: formatDistanceToNow(new Date(lease.lease_start_date), { addSuffix: true }),
        color: "text-purple-600",
        bgColor: "bg-purple-50"
      })) || [];

      // Combine and sort activities
      const allActivities = [...paymentActivities, ...maintenanceActivities, ...leaseActivities]
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

      setRecentActivities(allActivities.slice(0, 3));

      // Fetch urgent alerts
      await fetchUrgentAlerts();

    } catch (error) {
      console.error('Error fetching activity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUrgentAlerts = async () => {
    try {
      // Get pending maintenance requests with high priority
      const { data: urgentMaintenance } = await supabase
        .from('maintenance_requests')
        .select(`
          id,
          title,
          priority,
          submitted_date,
          unit_id
        `)
        .eq('status', 'pending')
        .eq('priority', 'high')
        .order('submitted_date', { ascending: false })
        .limit(1);

      // Get overdue invoices
      const { data: overdueInvoices } = await supabase
        .from('invoices')
        .select('id, due_date')
        .eq('status', 'pending')
        .lt('due_date', new Date().toISOString().split('T')[0])
        .limit(1);

      const alerts: AlertItem[] = [];

      // Add urgent maintenance alerts
      if (urgentMaintenance?.length) {
        const request = urgentMaintenance[0];
        alerts.push({
          type: "urgent",
          icon: AlertTriangle,
          title: "Urgent Maintenance",
          description: `Unit ${request.unit_id}: ${request.title}`,
          time: formatDistanceToNow(new Date(request.submitted_date), { addSuffix: true }),
          priority: "high",
          color: "text-red-600",
          bgColor: "bg-red-50",
          borderColor: "border-red-500"
        });
      }

      // Add overdue payment alerts
      if (overdueInvoices?.length) {
        alerts.push({
          type: "payment",
          icon: Clock,
          title: "Payment Overdue",
          description: `${overdueInvoices.length} invoice${overdueInvoices.length > 1 ? 's have' : ' has'} overdue payments`,
          time: formatDistanceToNow(new Date(overdueInvoices[0].due_date), { addSuffix: true }),
          priority: "medium",
          color: "text-orange-600",
          bgColor: "bg-orange-50",
          borderColor: "border-orange-500"
        });
      }

      setUrgentAlerts(alerts);
    } catch (error) {
      console.error('Error fetching urgent alerts:', error);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              <CardTitle>Recent Activity & Alerts</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            <CardTitle>Recent Activity & Alerts</CardTitle>
          </div>
          {urgentAlerts.filter(alert => alert.priority === "high").length > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {urgentAlerts.filter(alert => alert.priority === "high").length}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Urgent Alerts Section */}
        {urgentAlerts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-red-500" />
              <h3 className="font-semibold text-sm text-red-600">Urgent Alerts</h3>
            </div>
            
            <div className="space-y-2">
              {urgentAlerts.slice(0, 1).map((alert, index) => (
              <div 
                key={index}
                className={`p-3 ${alert.bgColor} rounded-lg border-l-4 ${alert.borderColor} hover:shadow-sm transition-shadow cursor-pointer`}
              >
                <div className="flex items-start gap-3">
                  <alert.icon className={`w-4 h-4 mt-0.5 ${alert.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className={`text-sm font-medium ${alert.color}`}>{alert.title}</p>
                      <span className="text-xs text-muted-foreground">{alert.time}</span>
                    </div>
                    <p className={`text-xs ${alert.color.replace('600', '700')}`}>
                      {alert.description}
                    </p>
                  </div>
                </div>
              </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <h3 className="font-semibold text-sm">Recent Activity</h3>
            </div>
            <Button variant="ghost" size="sm" className="text-xs">
              View All
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
          
          <div className="space-y-2">
            {recentActivities.length > 0 ? (
              recentActivities.slice(0, 3).map((activity, index) => (
                <div 
                  key={index}
                  className={`flex items-start gap-3 p-2 ${activity.bgColor} rounded-lg hover:shadow-sm transition-shadow cursor-pointer`}
                >
                  <activity.icon className={`w-4 h-4 mt-1 ${activity.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{activity.title}</p>
                      {activity.amount && (
                        <span className={`text-sm font-bold ${activity.color}`}>
                          {activity.amount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{activity.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}