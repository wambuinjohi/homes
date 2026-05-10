import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePaginator } from "@/components/ui/table-paginator";
import { Switch } from "@/components/ui/switch";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  Clock, 
  Settings, 
  Bell, 
  UserCheck, 
  UserX,
  DollarSign,
  Mail,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit,
  Save,
  RefreshCw,
  Search,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import EmailTemplateEditor from "@/components/admin/EmailTemplateEditor";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";

interface TrialAnalytics {
  totalTrialUsers: number;
  activeTrials: number;
  expiredTrials: number;
  convertedUsers: number;
  conversionRate: number;
  averageTrialDuration: number;
  gracePeriodUsers: number;
  suspendedUsers: number;
}

interface TrialSettings {
  trial_period_days: number;
  grace_period_days: number;
  auto_reminder_enabled: boolean;
  reminder_days: number[];
  auto_suspension_enabled: boolean;
  conversion_incentive_enabled: boolean;
  // Extended policy fields (read-only in UI)
  cutoff_date_utc?: string;
  pre_cutoff_days?: number;
  post_cutoff_days?: number;
}

interface TrialUser {
  landlord_id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  trial_start_date: string;
  trial_end_date: string;
  days_remaining: number;
  properties_count: number;
  units_count: number;
  tenants_count: number;
}

interface PolicyHistoryEntry {
  changed_at: string;
  changed_by: string | null;
  previous: { trial_period_days: number | null; grace_period_days: number | null };
  next: { trial_period_days: number; grace_period_days: number };
  note?: string;
}

const TrialManagement = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<TrialAnalytics | null>(null);
  const [settings, setSettings] = useState<TrialSettings | null>(null);
  const [trialUsers, setTrialUsers] = useState<TrialUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [savingSettings, setSavingSettings] = useState(false);
  const [policyHistory, setPolicyHistory] = useState<PolicyHistoryEntry[]>([]);
  
  // Filters for trial users
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [daysFilter, setDaysFilter] = useState<string>("all");
  
  // URL-based pagination for trial users
  const { page, pageSize, setPage } = useUrlPageParam({ 
    pageSize: 10, 
    defaultPage: 1 
  });
  // Pagination variables for trial users
  const totalItems = totalUsers || 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchTrialUsers(page, pageSize);
    }
  }, [page, pageSize]);

  // SEO: title, meta description, canonical
  useEffect(() => {
    document.title = "Trial Management | Admin Billing";
    const content = "Manage trial settings, cutoff policy, and analytics.";
    let meta = document.querySelector("meta[name='description']");
    if (meta) meta.setAttribute('content', content);
    else {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      meta.setAttribute('content', content);
      document.head.appendChild(meta);
    }
    let canonical = document.querySelector("link[rel='canonical']");
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', window.location.href);
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchAnalytics(),
        fetchSettings(),
        fetchTrialUsers(page, pageSize)
      ]);
    } catch (error) {
      console.error('Error fetching trial management data:', error);
      toast({
        title: "Error",
        description: "Failed to load trial management data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    const { data: subscriptions } = await supabase
      .from('landlord_subscriptions')
      .select('*');

    if (subscriptions) {
      const now = new Date();
      const trialSubs = subscriptions.filter(s => s.status === 'trial');
      const activeTrials = trialSubs.filter(s => 
        s.trial_end_date && new Date(s.trial_end_date) > now
      );
      const expiredTrials = trialSubs.filter(s => 
        s.trial_end_date && new Date(s.trial_end_date) <= now
      );
      const converted = subscriptions.filter(s => s.status === 'active').length;
      const total = subscriptions.length;

      setAnalytics({
        totalTrialUsers: trialSubs.length,
        activeTrials: activeTrials.length,
        expiredTrials: expiredTrials.length,
        convertedUsers: converted,
        conversionRate: total > 0 ? (converted / total) * 100 : 0,
        averageTrialDuration: 30,
        gracePeriodUsers: expiredTrials.length,
        suspendedUsers: subscriptions.filter(s => s.status === 'suspended').length
      });
    }
  };

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('billing_settings')
      .select('*')
      .eq('setting_key', 'trial_settings')
      .maybeSingle();

    if (data && (data as any).setting_value) {
      const trialSettings = (data as any).setting_value as any;
      setSettings({
        trial_period_days: trialSettings.trial_period_days ?? 30,
        grace_period_days: trialSettings.grace_period_days ?? 7,
        auto_reminder_enabled: true,
        reminder_days: trialSettings.payment_reminder_days ?? [3, 1],
        auto_suspension_enabled: true,
        conversion_incentive_enabled: false,
        cutoff_date_utc: trialSettings.cutoff_date_utc,
        pre_cutoff_days: trialSettings.pre_cutoff_days,
        post_cutoff_days: trialSettings.post_cutoff_days,
      });
      setPolicyHistory(Array.isArray(trialSettings.policy_history) ? trialSettings.policy_history : []);
    } else {
      setSettings({
        trial_period_days: 30,
        grace_period_days: 7,
        auto_reminder_enabled: true,
        reminder_days: [3, 1],
        auto_suspension_enabled: true,
        conversion_incentive_enabled: false,
      });
      setPolicyHistory([]);
    }
  };

  const fetchTrialUsers = async (page = 1, limit = 10) => {
    const offset = (page - 1) * limit;
    
    try {
      // Fetch subscriptions first
      const { data: subscriptions, count, error: subsError } = await supabase
        .from('landlord_subscriptions')
        .select('landlord_id, status, trial_start_date, trial_end_date', { count: 'exact' })
        .in('status', ['trial', 'trial_expired', 'suspended'])
        .order('trial_start_date', { ascending: false })
        .range(offset, offset + limit - 1);

      if (subsError) throw subsError;

      if (!subscriptions || subscriptions.length === 0) {
        setTrialUsers([]);
        setTotalUsers(0);
        return;
      }

      // Filter out users with Admin role
      const landlordIds = subscriptions.map(s => s.landlord_id);
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('user_id', landlordIds)
        .eq('role', 'Admin');

      const adminIds = new Set(adminRoles?.map(r => r.user_id) || []);

      // Filter out admins from subscriptions
      const nonAdminSubscriptions = subscriptions.filter(s => !adminIds.has(s.landlord_id));

      if (nonAdminSubscriptions.length === 0) {
        setTrialUsers([]);
        setTotalUsers(0);
        return;
      }

      // Fetch all profiles for non-admin landlords
      const nonAdminLandlordIds = nonAdminSubscriptions.map(s => s.landlord_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .in('id', nonAdminLandlordIds);

      if (profilesError) throw profilesError;

      // Create a map for quick profile lookup
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Fetch property counts for all non-admin landlords in one query
      const { data: properties, error: propsError } = await supabase
        .from('properties')
        .select('id, owner_id')
        .in('owner_id', nonAdminLandlordIds);

      if (propsError) throw propsError;

      // Count properties per landlord
      const propertyCounts = new Map<string, number>();
      properties?.forEach(p => {
        propertyCounts.set(p.owner_id, (propertyCounts.get(p.owner_id) || 0) + 1);
      });

      // Fetch unit counts for all properties in one query
      const propertyIds = properties?.map(p => p.id) || [];
      const { data: units, error: unitsError } = propertyIds.length > 0
        ? await supabase
            .from('units')
            .select('property_id')
            .in('property_id', propertyIds)
        : { data: [], error: null };

      if (unitsError) throw unitsError;

      // Count units per landlord via properties
      const unitCounts = new Map<string, number>();
      units?.forEach(u => {
        const property = properties?.find(p => p.id === u.property_id);
        if (property) {
          unitCounts.set(property.owner_id, (unitCounts.get(property.owner_id) || 0) + 1);
        }
      });

      // Combine all data (using filtered non-admin subscriptions)
      const usersWithStats = nonAdminSubscriptions.map(sub => {
        const profile = profileMap.get(sub.landlord_id);
        const daysRemaining = sub.trial_end_date 
          ? Math.ceil((new Date(sub.trial_end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        return {
          landlord_id: sub.landlord_id,
          email: profile?.email || 'Unknown',
          first_name: profile?.first_name || 'Unknown',
          last_name: profile?.last_name || 'User',
          status: sub.status,
          trial_start_date: sub.trial_start_date,
          trial_end_date: sub.trial_end_date,
          days_remaining: Math.max(0, daysRemaining),
          properties_count: propertyCounts.get(sub.landlord_id) || 0,
          units_count: unitCounts.get(sub.landlord_id) || 0,
          tenants_count: 0,
        };
      });

      setTrialUsers(usersWithStats);
      setTotalUsers(count || 0);
    } catch (error) {
      console.error('Error fetching trial users:', error);
      setTrialUsers([]);
      setTotalUsers(0);
      toast({
        title: "Error",
        description: "Failed to load trial users",
        variant: "destructive",
      });
    }
  };

  const saveSettings = async () => {
    if (!settings) return;

    setSavingSettings(true);
    try {
      // Load existing to preserve unknown keys and history
      const { data: existing } = await supabase
        .from('billing_settings')
        .select('setting_value')
        .eq('setting_key', 'trial_settings')
        .maybeSingle();

      const existingValue = (existing as any)?.setting_value || {};
      const prevTrial = existingValue.trial_period_days;
      const prevGrace = existingValue.grace_period_days;
      const hasChange = prevTrial !== settings.trial_period_days || prevGrace !== settings.grace_period_days;

      const newHistory: PolicyHistoryEntry[] = Array.isArray(existingValue.policy_history)
        ? [...existingValue.policy_history]
        : [];

      if (hasChange) {
        newHistory.push({
          changed_at: new Date().toISOString(),
          changed_by: user?.id ?? null,
          previous: { trial_period_days: prevTrial ?? null, grace_period_days: prevGrace ?? null },
          next: { trial_period_days: settings.trial_period_days, grace_period_days: settings.grace_period_days },
          note: 'Applies to new landlords only',
        });
      }

      // Validate numeric values before saving
      const validTrialDays = Number.isInteger(settings.trial_period_days) && settings.trial_period_days > 0
        ? settings.trial_period_days 
        : 70;
      
      const validGraceDays = Number.isInteger(settings.grace_period_days) && settings.grace_period_days >= 0
        ? settings.grace_period_days
        : 7;

      const newSettingValue = {
        ...existingValue,
        trial_period_days: validTrialDays,
        grace_period_days: validGraceDays,
        payment_reminder_days: settings.reminder_days,
        auto_invoice_generation: existingValue.auto_invoice_generation ?? true,
        default_sms_credits: existingValue.default_sms_credits ?? 200,
        sms_cost_per_unit: existingValue.sms_cost_per_unit ?? 0.05,
        policy_history: newHistory,
      };

      const { error } = await supabase
        .from('billing_settings')
        .upsert(
          {
            setting_key: 'trial_settings',
            setting_value: newSettingValue,
            description: 'Trial subscription configuration settings',
          },
          { onConflict: 'setting_key' }
        );

      if (error) throw error;

      if (hasChange) {
        setPolicyHistory(newHistory);
      }

      toast({
        title: 'Settings Saved',
        description: 'Trial management settings have been updated successfully.',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'trial':
        return <Badge variant="secondary">Active Trial</Badge>;
      case 'trial_expired':
        return <Badge variant="destructive">Grace Period</Badge>;
      case 'suspended':
        return <Badge variant="destructive">Suspended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Trial Management</h1>
            <p className="text-muted-foreground">
              Manage trial periods, notifications, and conversion optimization
            </p>
          </div>
          <Button onClick={fetchAllData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </div>

        {/* Analytics Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trial Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.totalTrialUsers || 0}</div>
              <p className="text-xs text-muted-foreground">
                {analytics?.activeTrials || 0} active, {analytics?.expiredTrials || 0} expired
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.conversionRate.toFixed(1) || 0}%</div>
              <p className="text-xs text-muted-foreground">
                {analytics?.convertedUsers || 0} converted users
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Grace Period</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.gracePeriodUsers || 0}</div>
              <p className="text-xs text-muted-foreground">
                Users in {settings?.grace_period_days || 7} day grace period
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Suspended</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.suspendedUsers || 0}</div>
              <p className="text-xs text-muted-foreground">
                Accounts suspended after grace period
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="users">Trial Users</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="templates">Email Templates</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Trial Users Overview</CardTitle>
                <CardDescription>
                  Monitor all users in trial, grace period, or suspended status (sorted by newest first)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="Filter by Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="trial">Active Trial</SelectItem>
                      <SelectItem value="trial_expired">Grace Period</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={daysFilter} onValueChange={setDaysFilter}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="Filter by Days" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="expiring_soon">Expiring ≤7 days</SelectItem>
                      <SelectItem value="expiring_month">Expiring ≤30 days</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>

                  {(searchQuery || statusFilter !== "all" || daysFilter !== "all") && (
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        setSearchQuery("");
                        setStatusFilter("all");
                        setDaysFilter("all");
                      }}
                      className="flex items-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      Clear
                    </Button>
                  )}
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Trial Period</TableHead>
                      <TableHead>Days Remaining</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trialUsers
                      .filter(user => {
                        // Search filter
                        const matchesSearch = !searchQuery || 
                          `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          user.email.toLowerCase().includes(searchQuery.toLowerCase());
                        
                        // Status filter
                        const matchesStatus = statusFilter === "all" || user.status === statusFilter;
                        
                        // Days filter
                        let matchesDays = true;
                        if (daysFilter === "expiring_soon") {
                          matchesDays = user.days_remaining > 0 && user.days_remaining <= 7;
                        } else if (daysFilter === "expiring_month") {
                          matchesDays = user.days_remaining > 0 && user.days_remaining <= 30;
                        } else if (daysFilter === "expired") {
                          matchesDays = user.days_remaining <= 0;
                        }
                        
                        return matchesSearch && matchesStatus && matchesDays;
                      })
                      .map((user) => (
                      <TableRow key={user.landlord_id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {user.first_name} {user.last_name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {user.email}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(user.status)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>Start: {format(new Date(user.trial_start_date), 'MMM dd, yyyy')}</div>
                            <div>End: {format(new Date(user.trial_end_date), 'MMM dd, yyyy')}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span className={user.days_remaining <= 3 ? 'text-red-600 font-medium' : ''}>
                              {user.days_remaining} days
                            </span>
                            {user.days_remaining <= 7 && (
                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{user.properties_count} properties</div>
                            <div>{user.units_count} units</div>
                            <div>{user.tenants_count} tenants</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button size="sm" variant="outline">
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {totalPages > 1 && (
                  <TablePaginator
                    currentPage={page}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={totalItems}
                    onPageChange={setPage}
                    showPageSizeSelector={false}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Trial Configuration</CardTitle>
                <CardDescription>
                  Configure trial periods, grace periods, and automation settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <AlertTitle>Policy applies to new landlords only</AlertTitle>
                  <AlertDescription>
                    Updates here affect future signups; existing subscriptions remain unchanged.
                  </AlertDescription>
                </Alert>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="trial-days">Trial Period (Days)</Label>
                    <Input
                      id="trial-days"
                      type="number"
                      min="1"
                      max="365"
                      value={settings?.trial_period_days || 70}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value) && value > 0) {
                          setSettings(prev => prev ? 
                            { ...prev, trial_period_days: value } : null
                          );
                        }
                      }}
                    />
                    <p className="text-sm text-muted-foreground">
                      Default trial duration for new landlords (1-365 days)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="grace-days">Grace Period (Days)</Label>
                    <Input
                      id="grace-days"
                      type="number"
                      min="0"
                      max="90"
                      value={settings?.grace_period_days || 7}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value) && value >= 0) {
                          setSettings(prev => prev ? 
                            { ...prev, grace_period_days: value } : null
                          );
                        }
                      }}
                    />
                    <p className="text-sm text-muted-foreground">
                      Grace period before account suspension (0-90 days)
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Automatic Reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        Send automated trial expiration reminders
                      </p>
                    </div>
                    <Switch
                      checked={settings?.auto_reminder_enabled || false}
                      onCheckedChange={(checked) => setSettings(prev => prev ? 
                        { ...prev, auto_reminder_enabled: checked } : null
                      )}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto Suspension</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically suspend accounts after grace period
                      </p>
                    </div>
                    <Switch
                      checked={settings?.auto_suspension_enabled || false}
                      onCheckedChange={(checked) => setSettings(prev => prev ? 
                        { ...prev, auto_suspension_enabled: checked } : null
                      )}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Conversion Incentives</Label>
                      <p className="text-sm text-muted-foreground">
                        Show special offers to trial users nearing expiration
                      </p>
                    </div>
                    <Switch
                      checked={settings?.conversion_incentive_enabled || false}
                      onCheckedChange={(checked) => setSettings(prev => prev ? 
                        { ...prev, conversion_incentive_enabled: checked } : null
                      )}
                    />
                  </div>
                  </div>

                  {/* Read-only policy cutoff (display only) */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Historical Policy Cutoff</CardTitle>
                      <CardDescription>
                        These values control trial duration based on the cutoff date.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-3">
                      <div>
                        <Label>Cutoff Date (UTC)</Label>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {settings?.cutoff_date_utc ? format(new Date(settings.cutoff_date_utc), 'PPpp') : '—'}
                        </div>
                      </div>
                      <div>
                        <Label>Pre-cutoff Trial Days</Label>
                        <div className="mt-1 text-sm text-muted-foreground">{settings?.pre_cutoff_days ?? '—'}</div>
                      </div>
                      <div>
                        <Label>Post-cutoff Trial Days</Label>
                        <div className="mt-1 text-sm text-muted-foreground">{settings?.post_cutoff_days ?? '—'}</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Policy History</CardTitle>
                      <CardDescription>Audit trail of changes to trial and grace periods.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {policyHistory.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No policy changes recorded yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {policyHistory.slice().reverse().map((entry, idx) => (
                            <div key={idx} className="rounded-md border p-3">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{format(new Date(entry.changed_at), 'PPpp')}</span>
                                <Badge variant="secondary">By {entry.changed_by ? entry.changed_by.slice(0, 8) : 'system'}</Badge>
                              </div>
                              <div className="mt-2 text-sm">
                                <div>
                                  Trial days: <span className="font-medium">{entry.previous?.trial_period_days ?? '—'}</span> → <span className="font-medium">{entry.next.trial_period_days}</span>
                                </div>
                                <div>
                                  Grace days: <span className="font-medium">{entry.previous?.grace_period_days ?? '—'}</span> → <span className="font-medium">{entry.next.grace_period_days}</span>
                                </div>
                                {entry.note && (
                                  <p className="mt-1 text-muted-foreground">{entry.note}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="flex justify-end">
                    <Button onClick={saveSettings} disabled={savingSettings}>
                      {savingSettings ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Settings
                    </Button>
                  </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <EmailTemplateEditor />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Trial Conversion Funnel</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Trial Started</span>
                      <span>{analytics?.totalTrialUsers || 0}</span>
                    </div>
                    <Progress value={100} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Active Trials</span>
                      <span>{analytics?.activeTrials || 0}</span>
                    </div>
                    <Progress 
                      value={analytics?.totalTrialUsers ? 
                        (analytics.activeTrials / analytics.totalTrialUsers) * 100 : 0
                      } 
                      className="h-2" 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Converted</span>
                      <span>{analytics?.convertedUsers || 0}</span>
                    </div>
                    <Progress 
                      value={analytics?.conversionRate || 0} 
                      className="h-2" 
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Trial Health Metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Average Trial Duration</span>
                    <span className="font-medium">{analytics?.averageTrialDuration || 0} days</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Grace Period Usage</span>
                    <span className="font-medium">
                      {analytics?.gracePeriodUsers || 0} users
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Suspension Rate</span>
                    <span className="font-medium">
                      {analytics?.totalTrialUsers ? 
                        ((analytics.suspendedUsers / analytics.totalTrialUsers) * 100).toFixed(1) : 0
                      }%
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default TrialManagement;