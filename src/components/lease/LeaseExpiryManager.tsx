import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, 
  AlertTriangle, 
  Clock, 
  Filter,
  Mail,
  MessageSquare,
  Download,
  Eye,
  Search,
  CheckCircle2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatAmount } from "@/utils/currency";
import { format, differenceInDays } from "date-fns";
import { DisabledActionWrapper } from "@/components/feature-access/DisabledActionWrapper";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";
import { LeaseDetailsDialog } from "@/components/lease/LeaseDetailsDialog";

interface LeaseData {
  id: string;
  lease_end_date: string;
  monthly_rent: number;
  property_name: string;
  unit_number: string;
  tenant_name: string;
  tenant_email?: string;
  days_until_expiry: number;
  status: string;
  // Optional metadata used for filtering visibility
  tenant_user_id?: string;
  property_owner_id?: string;
  property_manager_id?: string;
}

interface LeaseExpiryManagerProps {
  timeframe?: number;
  onTimeframeChange?: (days: number) => void;
}

export function LeaseExpiryManager({ 
  timeframe = 90, 
  onTimeframeChange 
}: LeaseExpiryManagerProps) {
  const [leases, setLeases] = useState<LeaseData[]>([]);
  const [filteredLeases, setFilteredLeases] = useState<LeaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe);
  const [selectedLeases, setSelectedLeases] = useState<string[]>([]);
  const { user } = useAuth();

  const timeframes = [
    { days: 30, label: "30 days", urgent: true },
    { days: 60, label: "60 days" },
    { days: 90, label: "90 days" },
    { days: 180, label: "6 months" },
    { days: 365, label: "1 year" }
  ];

  const urgencyLevels = {
    critical: { days: 15, color: "destructive", label: "Critical" },
    urgent: { days: 30, color: "warning", label: "Urgent" },
    attention: { days: 60, color: "orange", label: "Needs Attention" },
    normal: { days: 90, color: "default", label: "Normal" }
  };

  useEffect(() => {
    fetchLeaseData();
  }, [selectedTimeframe]);

  // Ensure the status filter doesn't accidentally hide data after timeframe changes
  useEffect(() => {
    setStatusFilter('all');
  }, [selectedTimeframe]);

  useEffect(() => {
    applyFilters();
  }, [leases, searchTerm, statusFilter]);

  const fetchLeaseData = async () => {
    setLoading(true);
    try {
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + selectedTimeframe * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0];

      // Align with dashboard behavior: when timeframe is 90 days, use RPC defaults (server-defined 90 days)
      const rpcArgs = (selectedTimeframe === 90)
        ? { p_start_date: null, p_end_date: null }
        : { p_start_date: startDate, p_end_date: endDate };

      let leasesData: any[] = [];
      try {
        const rpcRes = await (supabase as any)
          .rpc('get_lease_expiry_report', rpcArgs)
          .maybeSingle();
        const { data, error } = rpcRes;
        if (error) throw error;
        const raw = data as any;
        const reportData = Array.isArray(raw) ? raw[0] : raw;
        leasesData = Array.isArray(reportData?.table) ? reportData.table : [];
        if (!Array.isArray(leasesData) || leasesData.length === 0) {
          const filters = { gte: startDate, lte: endDate } as const;
          // 1) Fetch leases only (no heavy joins)
          const { data: leaseRows, error: leaseErr } = await (supabase as any)
            .from('leases')
            .select('id, lease_end_date, monthly_rent, status, unit_id, tenant_id')
            .gte('lease_end_date', filters.gte)
            .lte('lease_end_date', filters.lte)
            .order('lease_end_date', { ascending: true })
            .limit(500);
          if (!leaseErr) {
            const tenantIds = [...new Set((leaseRows || []).map((l: any) => l.tenant_id).filter(Boolean))];
            const unitIds = [...new Set((leaseRows || []).map((l: any) => l.unit_id).filter(Boolean))];

            // 2) Batch fetch tenants and units (include tenant.user_id)
            const [tenantsRes, unitsRes] = await Promise.all([
              (supabase as any).from('tenants').select('id, user_id, first_name, last_name, email').in('id', tenantIds),
              (supabase as any).from('units').select('id, unit_number, property_id').in('id', unitIds)
            ]);

            const tenantsMap = new Map((tenantsRes?.data || []).map((t: any) => [t.id, t]));
            const unitsData = unitsRes?.data || [];
            const propertyIds = [...new Set(unitsData.map((u: any) => u.property_id).filter(Boolean))];

            // 3) Batch fetch properties (include owner/manager)
            const { data: propsData } = await (supabase as any)
              .from('properties')
              .select('id, name, owner_id, manager_id')
              .in('id', propertyIds);
            const propsMap = new Map((propsData || []).map((p: any) => [p.id, p]));

            // 4) Compose results
            const unitsMap = new Map(unitsData.map((u: any) => [u.id, u]));
            leasesData = (leaseRows || []).map((l: any) => {
              const tenant = tenantsMap.get(l.tenant_id) as any;
              const unit = unitsMap.get(l.unit_id) as any;
              const prop = unit ? propsMap.get(unit.property_id) as any : null;
              return {
                id: l.id,
                property_name: prop?.name || '',
                unit_number: unit?.unit_number || '',
                tenant_name: `${tenant?.first_name || ''} ${tenant?.last_name || ''}`.trim(),
                tenant_email: tenant?.email || '',
                tenant_user_id: tenant?.user_id || undefined,
                lease_end_date: l.lease_end_date,
                monthly_rent: l.monthly_rent,
                status: l.status,
                property_owner_id: prop?.owner_id || undefined,
                property_manager_id: prop?.manager_id || undefined
              };
            });
          }
        }
      } catch (rpcErr) {
        // Client-side fallback: fetch leases within timeframe and join properties/tenants as needed
        try {
          const filters = { gte: startDate, lte: endDate } as const;

          const { data: leaseRows, error: leaseErr } = await (supabase as any)
            .from('leases')
            .select('id, lease_end_date, monthly_rent, status, unit_id, tenant_id')
            .gte('lease_end_date', filters.gte)
            .lte('lease_end_date', filters.lte)
            .order('lease_end_date', { ascending: true })
            .limit(500);
          if (leaseErr) throw leaseErr;

          const tenantIds = [...new Set((leaseRows || []).map((l: any) => l.tenant_id).filter(Boolean))];
          const unitIds = [...new Set((leaseRows || []).map((l: any) => l.unit_id).filter(Boolean))];

          const [tenantsRes, unitsRes] = await Promise.all([
            (supabase as any).from('tenants').select('id, user_id, first_name, last_name, email').in('id', tenantIds),
            (supabase as any).from('units').select('id, unit_number, property_id').in('id', unitIds)
          ]);

          const tenantsMap = new Map((tenantsRes?.data || []).map((t: any) => [t.id, t]));
          const unitsData = unitsRes?.data || [];
          const propertyIds = [...new Set(unitsData.map((u: any) => u.property_id).filter(Boolean))];
          const { data: propsData } = await (supabase as any)
            .from('properties')
            .select('id, name, owner_id, manager_id')
            .in('id', propertyIds);
          const propsMap = new Map((propsData || []).map((p: any) => [p.id, p]));
          const unitsMap = new Map(unitsData.map((u: any) => [u.id, u]));

          leasesData = (leaseRows || []).map((l: any) => {
            const tenant = tenantsMap.get(l.tenant_id) as any;
            const unit = unitsMap.get(l.unit_id) as any;
            const prop = unit ? propsMap.get(unit.property_id) as any : null;
            return {
              id: l.id,
              property_name: prop?.name || '',
              unit_number: unit?.unit_number || '',
              tenant_name: `${tenant?.first_name || ''} ${tenant?.last_name || ''}`.trim(),
              tenant_email: tenant?.email || '',
              tenant_user_id: tenant?.user_id || undefined,
              lease_end_date: l.lease_end_date,
              monthly_rent: l.monthly_rent,
              status: l.status,
              property_owner_id: prop?.owner_id || undefined,
              property_manager_id: prop?.manager_id || undefined
            };
          });
        } catch (srvErr) {
          throw srvErr;
        }
      }

      // If RPC returned rows without IDs, fetch a lightweight list of leases in the same window
      // and map IDs by (property_name, unit_number, lease_end_date)
      if (Array.isArray(leasesData) && leasesData.length > 0 && !leasesData.some((l: any) => l.id)) {
        const filters = { gte: startDate, lte: endDate } as const;
        const { data: leaseList } = await (supabase as any)
          .from('leases')
          .select('id, lease_end_date, units:units!leases_unit_id_fkey(unit_number, properties:properties!units_property_id_fkey(name))')
          .gte('lease_end_date', filters.gte)
          .lte('lease_end_date', filters.lte);

        const makeKey = (p?: string, u?: string, d?: string) => {
          const dd = d ? new Date(d).toISOString().split('T')[0] : '';
          return `${(p || '').trim()}|${(u || '').trim()}|${dd}`;
        };

        const idMap = new Map<string, string>();
        (leaseList || []).forEach((row: any) => {
          const key = makeKey(row?.units?.properties?.name, row?.units?.unit_number, row?.lease_end_date);
          if (row?.id) idMap.set(key, row.id);
        });

        leasesData = leasesData.map((l: any) => {
          const key = makeKey(l.property_name || l.property, l.unit_number || l.unit, l.lease_end_date);
          const found = idMap.get(key);
          return found ? { ...l, id: found } : l;
        });
      }

      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      let normalized = leasesData
        .map((l: any) => {
          const end = l?.lease_end_date ? new Date(l.lease_end_date) : null;
          const computedDays = end ? Math.max(0, differenceInDays(end, startOfToday)) : 0;
          const days = Number.isFinite(Number(l?.days_until_expiry)) ? Number(l.days_until_expiry) : computedDays;
          return {
            id: l.id || `${l.property_name || l.property || ''}-${l.unit_number || l.unit || ''}-${l.lease_end_date || ''}`,
            lease_end_date: l.lease_end_date,
            monthly_rent: Number(l.monthly_rent || 0),
            property_name: l.property_name || l.property || '',
            unit_number: l.unit_number || l.unit || '',
            tenant_name: l.tenant_name || `${l.first_name || ''} ${l.last_name || ''}`.trim(),
            tenant_email: l.tenant_email || l.email || undefined,
            tenant_user_id: (l as any).tenant_user_id || undefined,
            property_owner_id: (l as any).property_owner_id || undefined,
            property_manager_id: (l as any).property_manager_id || undefined,
            days_until_expiry: days,
            status: l.status || 'active'
          } as any as LeaseData;
        })
        .filter((l: any) => l.days_until_expiry >= 0 && l.days_until_expiry <= selectedTimeframe);

      // Restrict to leases visible to the authenticated user: tenant's own leases or properties they own/manage
      if (user) {
        normalized = normalized.filter((l: any) => (
          l.tenant_user_id === user.id ||
          l.property_owner_id === user.id ||
          l.property_manager_id === user.id
        ));
      } else {
        normalized = [];
      }

      normalized.sort((a: LeaseData, b: LeaseData) => a.days_until_expiry - b.days_until_expiry);
      setLeases(normalized);
    } catch (error) {
      console.error('Error fetching lease data:', error);
      setLeases([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...leases];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(lease =>
        lease.tenant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lease.property_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lease.unit_number?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(lease => {
        switch (statusFilter) {
          case "critical":
            return lease.days_until_expiry <= 15;
          case "urgent":
            return lease.days_until_expiry > 15 && lease.days_until_expiry <= 30;
          case "attention":
            return lease.days_until_expiry > 30 && lease.days_until_expiry <= 60;
          case "normal":
            return lease.days_until_expiry > 60 && lease.days_until_expiry <= selectedTimeframe;
          default:
            return true;
        }
      });
    }

    setFilteredLeases(filtered);
  };

  const getUrgencyLevel = (days: number) => {
    if (days <= 15) return urgencyLevels.critical;
    if (days <= 30) return urgencyLevels.urgent;
    if (days <= 60) return urgencyLevels.attention;
    return urgencyLevels.normal;
  };

  const handleTimeframeChange = (days: number) => {
    setSelectedTimeframe(days);
    onTimeframeChange?.(days);
  };

  const handleBulkAction = (action: string) => {
    console.log(`Performing bulk action: ${action} on leases:`, selectedLeases);
    // Implementation would go here for Pro users
  };

  const segmentedLeases = {
    critical: filteredLeases.filter(l => l.days_until_expiry <= 15),
    urgent: filteredLeases.filter(l => l.days_until_expiry > 15 && l.days_until_expiry <= 30),
    attention: filteredLeases.filter(l => l.days_until_expiry > 30 && l.days_until_expiry <= 60),
    normal: filteredLeases.filter(l => l.days_until_expiry > 60)
  };

  return (
    <div className="space-y-6">
      {/* Header with Timeframe Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <span>Lease Expiry Management</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {timeframes.map((tf) => (
                <Button
                  key={tf.days}
                  variant={selectedTimeframe === tf.days ? "default" : "outline"}
                  size="sm"
                  className={tf.urgent ? "border-warning text-warning hover:bg-warning hover:text-warning-foreground" : ""}
                  onClick={() => handleTimeframeChange(tf.days)}
                >
                  {tf.label}
                </Button>
              ))}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by tenant, property, or unit..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Leases</SelectItem>
                <SelectItem value="critical">Critical (≤15 days)</SelectItem>
                <SelectItem value="urgent">Urgent (16-30 days)</SelectItem>
                <SelectItem value="attention">Attention (31-60 days)</SelectItem>
                <SelectItem value="normal">{selectedTimeframe > 60 ? `Normal (61-${selectedTimeframe} days)` : 'Normal (>60 days)'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions - Gated for Pro */}
          {selectedLeases.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4 p-3 bg-muted/20 rounded-lg">
              <span className="text-sm text-muted-foreground">
                {selectedLeases.length} lease{selectedLeases.length !== 1 ? 's' : ''} selected:
              </span>
              <DisabledActionWrapper feature={FEATURES.ADVANCED_REPORTING}>
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('email')}>
                  <Mail className="h-3 w-3 mr-1" />
                  Send Renewal Reminder
                </Button>
              </DisabledActionWrapper>
              <DisabledActionWrapper feature={FEATURES.ADVANCED_REPORTING}>
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('schedule')}>
                  <Clock className="h-3 w-3 mr-1" />
                  Schedule Follow-up
                </Button>
              </DisabledActionWrapper>
              <DisabledActionWrapper feature={FEATURES.ADVANCED_REPORTING}>
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('export')}>
                  <Download className="h-3 w-3 mr-1" />
                  Export Selected
                </Button>
              </DisabledActionWrapper>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Segmented View */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="critical" className="text-destructive">
            Critical ({segmentedLeases.critical.length})
          </TabsTrigger>
          <TabsTrigger value="urgent" className="text-warning">
            Urgent ({segmentedLeases.urgent.length})
          </TabsTrigger>
          <TabsTrigger value="attention" className="text-orange-600">
            Attention ({segmentedLeases.attention.length})
          </TabsTrigger>
          <TabsTrigger value="normal">
            Normal ({segmentedLeases.normal.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(segmentedLeases).map(([key, leases]) => {
              const level = urgencyLevels[key as keyof typeof urgencyLevels];
              return (
                <Card key={key} className={`border-${level.color}/20`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-2xl font-bold">{leases.length}</div>
                        <p className="text-sm text-muted-foreground">{level.label}</p>
                      </div>
                      <Badge variant={level.color as any}>
                        {level.label}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* All Leases List */}
          <Card>
            <CardHeader>
              <CardTitle>All Expiring Leases</CardTitle>
            </CardHeader>
            <CardContent>
              <LeasesList 
                leases={filteredLeases}
                loading={loading}
                selectedLeases={selectedLeases}
                onSelectionChange={setSelectedLeases}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {Object.entries(segmentedLeases).map(([key, leases]) => (
          <TabsContent key={key} value={key}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  {urgencyLevels[key as keyof typeof urgencyLevels].label} Leases
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LeasesList 
                  leases={leases}
                  loading={loading}
                  selectedLeases={selectedLeases}
                  onSelectionChange={setSelectedLeases}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

interface LeasesListProps {
  leases: LeaseData[];
  loading: boolean;
  selectedLeases: string[];
  onSelectionChange: (selected: string[]) => void;
}

function LeasesList({ leases, loading, selectedLeases, onSelectionChange }: LeasesListProps) {
  const handleSelectLease = (leaseId: string) => {
    if (selectedLeases.includes(leaseId)) {
      onSelectionChange(selectedLeases.filter(id => id !== leaseId));
    } else {
      onSelectionChange([...selectedLeases, leaseId]);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-muted/20 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (leases.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No leases found matching your criteria</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {leases.map((lease) => {
        const urgency = getUrgencyLevel(lease.days_until_expiry);
        const isSelected = selectedLeases.includes(lease.id);
        
        return (
          <div
            key={lease.id}
            className={`p-4 border rounded-lg transition-colors cursor-pointer ${
              isSelected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/20'
            }`}
            onClick={() => handleSelectLease(lease.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-2 h-12 rounded ${
                  urgency.color === 'destructive' ? 'bg-destructive' :
                  urgency.color === 'warning' ? 'bg-warning' :
                  urgency.color === 'orange' ? 'bg-orange-500' :
                  'bg-muted'
                }`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{lease.tenant_name}</span>
                    <Badge variant={urgency.color as any} className="text-xs">
                      {lease.days_until_expiry} days
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {lease.property_name} - Unit {lease.unit_number}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expires: {format(new Date(lease.lease_end_date), 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">{formatAmount(lease.monthly_rent)}</div>
                <p className="text-xs text-muted-foreground">monthly rent</p>
                <div className="mt-2 flex justify-end">
                  <LeaseDetailsDialog
                    leaseId={lease.id}
                    trigger={
                      <Button size="sm" variant="outline" onClick={(e) => e.stopPropagation()}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getUrgencyLevel(days: number) {
  if (days <= 15) return { color: "destructive", label: "Critical" };
  if (days <= 30) return { color: "warning", label: "Urgent" };
  if (days <= 60) return { color: "orange", label: "Attention" };
  return { color: "default", label: "Normal" };
}
