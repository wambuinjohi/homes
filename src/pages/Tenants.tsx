import { useState, useEffect } from "react";
import { formatAmount, getCurrencySymbol } from "@/utils/currency";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AddTenantDialog } from "@/components/tenants/AddTenantDialog";
import { TenantDetailsDialog } from "@/components/tenants/TenantDetailsDialog";
import { ResendCredentialsDialog } from "@/components/tenants/ResendCredentialsDialog";
import { BulkUploadDropdown } from "@/components/bulk-upload/BulkUploadDropdown";
import { Users, Phone, Mail, Search, Filter, Edit, Eye, Briefcase, LayoutGrid, List, Building2, MapPin, MoreVertical, Send } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { usePermissions } from "@/hooks/usePermissions";
import { KpiGrid } from "@/components/kpi/KpiGrid";
import { KpiStatCard } from "@/components/kpi/KpiStatCard";
import { TablePaginator } from "@/components/ui/table-paginator";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";
import { checkBackendReady } from "@/utils/backendHealth";
import { useRole } from "@/context/RoleContext";
import { InteractiveTour } from "@/components/onboarding/InteractiveTour";
import { GettingStartedCard } from "@/components/onboarding/GettingStartedCard";
import { useGettingStarted } from "@/hooks/useGettingStarted";

interface Tenant {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  employment_status: string | null;
  employer_name: string | null;
  monthly_income: number | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  previous_address: string | null;
  created_at: string;
  property_name?: string;
  unit_number?: string;
  rent_amount?: number;
}

interface Property {
  id: string;
  name: string;
  property_type: string;
}

const Tenants = () => {
  const { toast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEmployment, setFilterEmployment] = useState("all");
  const [filterProperty, setFilterProperty] = useState("all");
  const [filterBedrooms, setFilterBedrooms] = useState("all");
  const [filterRentRange, setFilterRentRange] = useState("all");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { page, pageSize, offset, setPage, setPageSize } = useUrlPageParam({ pageSize: 10 });
  const [backendReady, setBackendReady] = useState<boolean>(true);
  const [backendReason, setBackendReason] = useState<string>("");
  const { isSubUser, landlordId } = useRole();
  const { currentStep, dismissStep } = useGettingStarted();
  const { hasPermission } = usePermissions();

  useEffect(() => {
    (async () => {
      const health = await checkBackendReady();
      setBackendReady(health.ok);
      setBackendReason(health.reason || "");
      if (health.ok) {
        fetchTenants();
        fetchProperties();
      } else {
        setLoading(false);
      }
    })();
  }, [page, pageSize, searchTerm, filterEmployment, filterProperty]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      console.log("🔍 Fetching tenants via RPC for consistent landlord view", { page, pageSize, offset });

      // Use RPC which enforces the same permission logic as dashboard
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_landlord_tenants_summary', {
        p_search: searchTerm || '',
        p_employment_filter: filterEmployment || 'all',
        p_property_filter: filterProperty || 'all',
        p_limit: pageSize,
        p_offset: offset
      });

      if (rpcError || !rpcData) {
        const details = rpcError?.message || (rpcError ? JSON.stringify(rpcError) : 'No data from RPC');
        console.error('RPC error fetching tenants summary:', details);

        // Fallback: strictly scope to current landlord's portfolio (owner or manager)
        const { data: auth } = await supabase.auth.getUser();
        const uid = (isSubUser && landlordId) ? landlordId : auth?.user?.id;
        if (!uid) throw new Error('Not authenticated');

        // 1) Get properties owned/managed by this user
        const { data: ownedProps, error: propsErr } = await (supabase as any)
          .from('properties')
          .select('id, name')
          .or(`owner_id.eq.${uid},manager_id.eq.${uid}`);
        if (propsErr) throw propsErr;
        const propertyIds = (ownedProps || []).map((p: any) => p.id);
        const propertyById: Record<string, any> = (ownedProps || []).reduce((acc: any, p: any) => { acc[p.id] = p; return acc; }, {});

        if (!propertyIds.length) {
          setTenants([]);
          setTotalCount(0);
          return;
        }

        // 2) Get units within those properties
        const { data: units, error: unitsErr } = await supabase
          .from('units')
          .select('id, unit_number, property_id')
          .in('property_id', propertyIds);
        if (unitsErr) throw unitsErr;
        const unitById: Record<string, any> = (units || []).reduce((acc: any, u: any) => { acc[u.id] = u; return acc; }, {});
        const unitIds = (units || []).map((u: any) => u.id);

        if (!unitIds.length) {
          setTenants([]);
          setTotalCount(0);
          return;
        }

        // 3) Get active leases for those units
        const { data: leases, error: leasesErr } = await supabase
          .from('leases')
          .select('tenant_id, unit_id, monthly_rent, status')
          .in('unit_id', unitIds)
          .neq('status', 'terminated');
        if (leasesErr) throw leasesErr;

        const tenantIds = Array.from(new Set((leases || []).map((l: any) => l.tenant_id).filter(Boolean)));

        if (!tenantIds.length) {
          setTenants([]);
          setTotalCount(0);
          return;
        }

        // 4) Fetch tenants with pagination and exact count
        const { data: tenantRows, error: tError, count } = await supabase
          .from('tenants')
          .select('id, first_name, last_name, email, phone, employment_status, employer_name, monthly_income, emergency_contact_name, emergency_contact_phone, previous_address, created_at', { count: 'exact' })
          .in('id', tenantIds)
          .order('created_at', { ascending: false })
          .range(offset, offset + pageSize - 1);

        if (tError) throw tError;

        // 5) Map tenants to their unit/property/rent where possible (choose first active lease per tenant)
        const leaseByTenant: Record<string, any> = {};
        (leases || []).forEach((l: any) => {
          if (!leaseByTenant[l.tenant_id]) leaseByTenant[l.tenant_id] = l; // keep first (most recent selection could be improved)
        });

        const transformedFallback = (tenantRows || []).map((t: any) => {
          const l = leaseByTenant[t.id];
          const unit = l ? unitById[l.unit_id] : null;
          const prop = unit ? propertyById[unit.property_id] : null;
          return {
            id: t.id,
            first_name: t.first_name,
            last_name: t.last_name,
            email: t.email,
            phone: t.phone,
            employment_status: t.employment_status,
            employer_name: t.employer_name,
            monthly_income: t.monthly_income,
            emergency_contact_name: t.emergency_contact_name,
            emergency_contact_phone: t.emergency_contact_phone,
            previous_address: t.previous_address,
            created_at: t.created_at,
            property_name: prop?.name,
            unit_number: unit?.unit_number,
            rent_amount: l?.monthly_rent,
          };
        });

        setTenants(transformedFallback as Tenant[]);
        setTotalCount(count || transformedFallback.length || 0);
        return;
      }

      const tenantsArray = (rpcData && (rpcData as any).tenants) ? JSON.parse(JSON.stringify((rpcData as any).tenants)) : [];
      const total = (rpcData && (rpcData as any).total_count) ? Number((rpcData as any).total_count) : 0;

      // Normalize items to expected fields
      const transformedTenants = (tenantsArray || []).map((t: any) => ({
        id: t.id,
        first_name: t.first_name,
        last_name: t.last_name,
        email: t.email,
        phone: t.phone,
        employment_status: t.employment_status,
        employer_name: t.employer_name,
        monthly_income: t.monthly_income,
        emergency_contact_name: t.emergency_contact_name,
        emergency_contact_phone: t.emergency_contact_phone,
        previous_address: t.previous_address,
        created_at: t.created_at,
        property_name: t.property_name,
        unit_number: t.unit_number,
        rent_amount: t.rent_amount
      }));

      // Deduplicate by id to avoid duplicate keys in React lists
      const uniqueTenants = Array.from(new Map((transformedTenants || []).map((t: any) => [t.id, t])).values());

      console.log("✅ Tenants (RPC) loaded:", uniqueTenants.length, "of", total);

      setTenants(uniqueTenants as Tenant[]);
      setTotalCount(total);

      // Audit: log that tenants were fetched (list access) and user activity. Non-blocking.
      try {
        await supabase.rpc('log_sensitive_data_access', {
          _table_name: 'tenants',
          _operation: 'list'
        });
      } catch (e) {
        console.warn('Audit log (data access) failed', e);
      }
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id;
        if (uid) {
          await supabase.rpc('log_user_activity', {
            _user_id: uid,
            _action: 'view_tenants',
            _entity_type: 'tenant',
            _entity_id: null as any,
            _details: {
              page,
              pageSize,
              search: searchTerm || null,
              employmentFilter: filterEmployment || null,
              propertyFilter: filterProperty || null
            } as any
          } as any);
        }
      } catch (e) {
        console.warn('Audit log (user activity) failed', e);
      }
    } catch (error) {
      const details = (error as any)?.message || JSON.stringify(error);
      console.error('Error fetching tenants via RPC:', details, error);
      toast({
        title: "Error",
        description: `Failed to load tenants: ${details}`,
        variant: "destructive",
      });
      setTenants([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = (isSubUser && landlordId) ? landlordId : auth?.user?.id;
      if (!uid) throw new Error('Not authenticated');

      const { data, error } = await (supabase as any)
        .from('properties')
        .select('id, name, property_type, owner_id, manager_id')
        .or(`owner_id.eq.${uid},manager_id.eq.${uid}`)
        .order('name');

      if (error) throw error;
      setProperties((data || []).map(p => ({ id: p.id, name: p.name, property_type: p.property_type })));
    } catch (error) {
      console.error('Error fetching properties:', error);
      setProperties([]);
    }
  };

  // Apply client-side filters for complex filters (property, bedrooms, rent range)
  const filteredTenants = tenants.filter((tenant) => {
    const matchesProperty = filterProperty === "all" || tenant.property_name === filterProperty;
    
    const matchesBedrooms = filterBedrooms === "all" || 
      (filterBedrooms === "4" && true) ||
      filterBedrooms === "1";
    
    let matchesRent = true;
    if (filterRentRange !== "all" && tenant.rent_amount) {
      const rentAmount = tenant.rent_amount;
      switch (filterRentRange) {
        case "0-20000":
          matchesRent = rentAmount <= 20000;
          break;
        case "20000-40000":
          matchesRent = rentAmount > 20000 && rentAmount <= 40000;
          break;
        case "40000-60000":
          matchesRent = rentAmount > 40000 && rentAmount <= 60000;
          break;
        case "60000+":
          matchesRent = rentAmount > 60000;
          break;
      }
    }
    
    return matchesProperty && matchesBedrooms && matchesRent;
  });

  const getEmploymentStatusColor = (status: string | null) => {
    switch (status) {
      case "employed":
        return "bg-success text-success-foreground";
      case "self_employed":
        return "bg-warning text-warning-foreground";
      case "unemployed":
        return "bg-destructive text-destructive-foreground";
      case "student":
        return "bg-info text-info-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="bg-tint-gray p-6 space-y-8">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="bg-card">
                <CardContent className="p-6">
                  <Skeleton className="h-4 w-3/4 mb-4" />
                  <Skeleton className="h-3 w-1/2 mb-2" />
                  <Skeleton className="h-3 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="bg-tint-gray p-6 space-y-8">
        <div className="space-y-6">
            {/* Getting Started Card */}
            {currentStep === "add_tenants" && tenants.length === 0 && (
              <GettingStartedCard
                stepId="add_tenants"
                title="Add your first tenant"
                description="Start managing your tenants by adding their information. You can link them to units and generate invoices."
                icon={Users}
                actionLabel="Add Tenant"
                onAction={() => {
                  const addButton = document.querySelector('[data-tour="add-tenant-btn"] button') as HTMLButtonElement;
                  addButton?.click();
                }}
                onDismiss={() => dismissStep("add_tenants")}
                currentStep={3}
                totalSteps={4}
              />
            )}
            
            {/* Tour Prompt */}
            <InteractiveTour tourId="add_tenant_tour" showPrompt={tenants.length === 0} />
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" data-tour="tenants-header">
              <div>
                <h1 className="text-3xl font-bold text-primary">Tenants</h1>
                <p className="text-muted-foreground">
                  Manage tenant profiles and rental information
                </p>
              </div>
              <div className="flex items-center gap-3 self-stretch sm:self-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                >
                  {viewMode === 'grid' ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
                </Button>
                <BulkUploadDropdown type="tenants" onSuccess={fetchTenants} />
                <div data-tour="add-tenant-btn">
                  <AddTenantDialog onTenantAdded={fetchTenants} />
                </div>
              </div>
            </div>

            {!backendReady && (
              <Card className="bg-card border-destructive">
                <CardContent className="pt-6">
                  <p className="text-destructive">Backend is not available. Tenant data cannot be loaded. {backendReason && `( ${backendReason} )`}</p>
                </CardContent>
              </Card>
            )}

            {/* Filters */}
            <Card className="bg-card">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search tenants by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={filterEmployment} onValueChange={setFilterEmployment}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Employment Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Employment</SelectItem>
                      <SelectItem value="employed">Employed</SelectItem>
                      <SelectItem value="self_employed">Self Employed</SelectItem>
                      <SelectItem value="unemployed">Unemployed</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={filterProperty} onValueChange={setFilterProperty}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Property Name" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Properties</SelectItem>
                      {properties.map(property => (
                        <SelectItem key={property.id} value={property.name}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={filterBedrooms} onValueChange={setFilterBedrooms}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Bedrooms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Bedrooms</SelectItem>
                      <SelectItem value="1">1 Bedroom</SelectItem>
                      <SelectItem value="2">2 Bedrooms</SelectItem>
                      <SelectItem value="3">3 Bedrooms</SelectItem>
                      <SelectItem value="4">4+ Bedrooms</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={filterRentRange} onValueChange={setFilterRentRange}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Monthly Rent" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Rent</SelectItem>
                      <SelectItem value="0-20000">{getCurrencySymbol()} 0 - 20,000</SelectItem>
                      <SelectItem value="20000-40000">{getCurrencySymbol()} 20,000 - 40,000</SelectItem>
                      <SelectItem value="40000-60000">{getCurrencySymbol()} 40,000 - 60,000</SelectItem>
                      <SelectItem value="60000+">{getCurrencySymbol()} 60,000+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Statistics Cards */}
            <KpiGrid>
              <KpiStatCard
                title="Total Tenants"
                value={totalCount}
                subtitle="Total in system"
                icon={Users}
                gradient="card-gradient-blue"
              />
              <KpiStatCard
                title="Employed"
                value={tenants.filter(t => t.employment_status === 'employed').length}
                subtitle="Full-time employed"
                icon={Briefcase}
                gradient="card-gradient-green"
              />
              <KpiStatCard
                title="Average Income"
                value={tenants.length > 0 ? formatAmount(Math.round(tenants.reduce((sum, t) => sum + (t.monthly_income || 0), 0) / tenants.length)) : formatAmount(0)}
                subtitle="Monthly income"
                icon={Mail}
                gradient="card-gradient-orange"
              />
              <KpiStatCard
                title="Contact Rate"
                value={`${tenants.length ? Math.round((tenants.filter(t => t.phone).length / tenants.length) * 100) : 0}%`}
                subtitle="Have phone numbers"
                icon={Phone}
                gradient="card-gradient-purple"
              />
            </KpiGrid>

            {/* Tenants List */}
            <div className={viewMode === 'grid' ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
              {filteredTenants.map((tenant) => (
                <Card key={tenant.id} className="bg-card hover:shadow-lg transition-all duration-300 group">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-semibold text-lg">
                          {tenant.first_name.charAt(0)}{tenant.last_name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-primary group-hover:text-primary-dark transition-colors">
                            {tenant.first_name} {tenant.last_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">{tenant.email}</p>
                        </div>
                      </div>
                      <Badge className={getEmploymentStatusColor(tenant.employment_status)}>
                        {tenant.employment_status?.replace('_', ' ') || 'Unknown'}
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Phone:</span>
                          <p className="font-medium truncate">{tenant.phone || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Unit:</span>
                          <p className="font-medium">{tenant.unit_number || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-border space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Property:</span>
                          <span className="font-medium text-sm text-primary">
                            {tenant.property_name || 'Not Assigned'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Monthly Rent:</span>
                          <span className="font-semibold text-sm">
                            {tenant.rent_amount ? formatAmount(tenant.rent_amount) : 'N/A'}
                          </span>
                        </div>
                        {tenant.monthly_income && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Income:</span>
                            <span className="font-medium text-sm">
                              {formatAmount(tenant.monthly_income)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <TenantDetailsDialog tenant={tenant} mode="view" />
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="flex-1">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <TenantDetailsDialog 
                            tenant={tenant} 
                            mode="edit" 
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Tenant
                              </DropdownMenuItem>
                            }
                          />
                          {hasPermission('manage_tenants') && (
                            <>
                              <DropdownMenuSeparator />
                              <ResendCredentialsDialog 
                                tenant={{
                                  id: tenant.id,
                                  email: tenant.email,
                                  first_name: tenant.first_name,
                                  last_name: tenant.last_name,
                                  phone: tenant.phone || ''
                                }}
                              >
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                  <Send className="h-4 w-4 mr-2" />
                                  Resend Login
                                </DropdownMenuItem>
                              </ResendCredentialsDialog>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <TablePaginator
                currentPage={page}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={totalCount}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            )}

            {filteredTenants.length === 0 && (
              <Card className="bg-card">
                <CardContent className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No tenants found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm || filterEmployment !== "all" || filterProperty !== "all"
                      ? "Try adjusting your filters to see more tenants."
                      : "Get started by adding your first tenant."}
                  </p>
                  {!searchTerm && filterEmployment === "all" && filterProperty === "all" && (
                    <AddTenantDialog onTenantAdded={fetchTenants} />
                  )}
                </CardContent>
              </Card>
            )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Tenants;
