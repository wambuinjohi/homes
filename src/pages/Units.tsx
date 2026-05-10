import { useState, useEffect } from "react";
import { formatAmount } from "@/utils/currency";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/context/RoleContext";
import { AddUnitDialog } from "@/components/units/AddUnitDialog";
import { UnitDetailsDialog } from "@/components/units/UnitDetailsDialog";
import { BulkUploadDropdown } from "@/components/bulk-upload/BulkUploadDropdown";
import { Building2, MapPin, Home, Search, Filter, Edit, Eye, LayoutGrid, List } from "lucide-react";
import { KpiGrid } from "@/components/kpi/KpiGrid";
import { KpiStatCard } from "@/components/kpi/KpiStatCard";
import { FeatureGate } from "@/components/ui/feature-gate";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";
import { TablePaginator } from "@/components/ui/table-paginator";
import { GettingStartedCard } from "@/components/onboarding/GettingStartedCard";
import { useGettingStarted } from "@/hooks/useGettingStarted";

interface Unit {
  id: string;
  unit_number: string;
  unit_type: string;
  property_id: string;
  properties: {
    name: string;
    address: string;
  };
  bedrooms: number;
  bathrooms: number;
  square_feet: number | null;
  rent_amount: number;
  security_deposit: number | null;
  status: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface Property {
  id: string;
  name: string;
  property_type: string;
}

const Units = () => {
  const { user } = useAuth();
  const { isSubUser, landlordId } = useRole();
  const targetId = (isSubUser && landlordId) ? landlordId : (user?.id as string);
  const [units, setUnits] = useState<Unit[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProperty, setFilterProperty] = useState("all");
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const { page, pageSize, offset, setPage, setPageSize } = useUrlPageParam({ pageSize: 12 });
  const { currentStep, dismissStep } = useGettingStarted();

  const fetchUnits = async () => {
    try {
      console.log("🔍 Starting units fetch for user:", user?.id);
      
      if (!user?.id) {
        console.log("❌ No authenticated user");
        return;
      }

      // Get properties first for filtering
      const { data: propertiesData, error: propertiesError } = await supabase
        .from("properties")
        .select("id, name, address, owner_id, manager_id")
        .or(`owner_id.eq.${targetId},manager_id.eq.${targetId}`);

      if (propertiesError) {
        console.error("❌ Properties query error:", propertiesError);
        throw propertiesError;
      }

      const propertyMap = new Map(propertiesData?.map(p => [p.id, p]) || []);
      const propertyIds = propertiesData?.map(p => p.id) || [];

      if (propertyIds.length === 0) {
        setUnits([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      // Build units query with filters and pagination
      let query = supabase
        .from("units")
        .select("*", { count: 'exact' })
        .in("property_id", propertyIds);

      // Apply search filter
      if (searchTerm) {
        query = query.or(`unit_number.ilike.%${searchTerm}%`);
      }

      // Apply status filter
      if (filterStatus !== "all") {
        query = query.eq('status', filterStatus);
      }

      // Apply property filter
      if (filterProperty !== "all") {
        query = query.eq('property_id', filterProperty);
      }

      // Apply pagination and ordering
      const { data: unitsData, error: unitsError, count } = await query
        .range(offset, offset + pageSize - 1)
        .order("unit_number");

      if (unitsError) {
        console.error("❌ Units query error:", unitsError);
        throw unitsError;
      }

      console.log("🏠 Units retrieved:", unitsData?.length || 0);
      setTotalCount(count || 0);

      // Join units with properties manually
      const joinedUnits = unitsData?.map(unit => ({
        ...unit,
        properties: propertyMap.get(unit.property_id)
      })) || [];

      console.log("🔗 Joined units:", joinedUnits.length);
      
      // Sync unit statuses to ensure they're up to date with current leases
      for (const unit of joinedUnits) {
        try {
          const { error: syncError } = await supabase.rpc('sync_unit_status', {
            p_unit_id: unit.id
          });
          if (syncError) {
            console.warn(`Failed to sync status for unit ${unit.unit_number}:`, syncError);
          }
        } catch (syncError) {
          console.warn(`Failed to sync status for unit ${unit.unit_number}:`, syncError);
        }
      }

      // Refetch units after sync to get updated statuses
      const { data: updatedUnitsData, error: refetchError } = await supabase
        .from("units")
        .select("*")
        .order("unit_number");

      if (!refetchError && updatedUnitsData) {
        const updatedJoinedUnits = updatedUnitsData?.filter(unit => {
          return propertyMap.has(unit.property_id);
        }).map(unit => ({
          ...unit,
          properties: propertyMap.get(unit.property_id)
        })) || [];
        
        setUnits(updatedJoinedUnits);
      } else {
        setUnits(joinedUnits);
      }
    } catch (error) {
      console.error("💥 Error in fetchUnits:", error);
      toast.error(`Failed to fetch units: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, property_type")
        .or(`owner_id.eq.${targetId},manager_id.eq.${targetId}`)
        .order("name");

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error("Error fetching properties:", error);
    }
  };

  useEffect(() => {
    fetchUnits();
    fetchProperties();
  }, [page, pageSize, searchTerm, filterStatus, filterProperty]);

  // No client-side filtering needed since we're doing server-side pagination
  const filteredUnits = units;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "occupied":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "vacant":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "maintenance":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  return (
    <DashboardLayout>
      <div className="bg-tint-gray p-6 space-y-8">
        {/* Getting Started Card */}
        {currentStep === "add_units" && units.length === 0 && (
          <GettingStartedCard
            stepId="add_units"
            title="Create your first unit"
            description="Units are the individual rental spaces within your properties. Add units to start managing rentals and tenants."
            icon={LayoutGrid}
            actionLabel="Add Unit"
            onAction={() => {
              const addButton = document.querySelector('.flex.items-center.gap-3 button:last-child') as HTMLButtonElement;
              addButton?.click();
            }}
            onDismiss={() => dismissStep("add_units")}
            currentStep={2}
            totalSteps={4}
          />
        )}
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary">Units</h1>
            <p className="text-muted-foreground">
              Manage individual property units
            </p>
          </div>
          <div className="flex items-center gap-3">
            <BulkUploadDropdown type="units" onSuccess={fetchUnits} />
            <AddUnitDialog onUnitAdded={fetchUnits} />
          </div>
        </div>

        {/* KPI Summary */}
        <KpiGrid>
          <KpiStatCard
            title="Total Units"
            value={units.length}
            subtitle="Active units"
            icon={Home}
            gradient="card-gradient-blue"
            isLoading={loading}
          />
          <KpiStatCard
            title="Occupied"
            value={units.filter(u => u.status === "occupied").length}
            subtitle="Currently rented"
            icon={Home}
            gradient="card-gradient-green"
            isLoading={loading}
          />
          <KpiStatCard
            title="Vacant"
            value={units.filter(u => u.status === "vacant").length}
            subtitle="Available units"
            icon={Home}
            gradient="card-gradient-orange"
            isLoading={loading}
          />
          <KpiStatCard
            title="Occupancy Rate"
            value={`${units.length > 0 ? Math.round((units.filter(u => u.status === "occupied").length / units.length) * 100) : 0}%`}
            subtitle="Current rate"
            icon={Building2}
            gradient="card-gradient-navy"
            isLoading={loading}
          />
        </KpiGrid>

        {/* Search, Filters & View Toggle */}
        <Card className="bg-card p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search units or properties..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-border"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px] border-border">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="vacant">Vacant</SelectItem>
                  <SelectItem value="occupied">Occupied</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterProperty} onValueChange={setFilterProperty}>
                <SelectTrigger className="w-[200px] border-border">
                  <Building2 className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by property" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* View Toggle */}
            <div className="flex items-center space-x-2 bg-secondary rounded-lg p-1">
              <Button
                variant={viewMode === "kanban" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("kanban")}
                className="h-8"
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                Kanban
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="h-8"
              >
                <List className="h-4 w-4 mr-1" />
                Table
              </Button>
            </div>
          </div>
        </Card>

        {/* Units Content */}
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="bg-card">
                <CardHeader>
                  <Skeleton className="h-4 w-[250px]" />
                  <Skeleton className="h-4 w-[200px]" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[150px]" />
                    <Skeleton className="h-4 w-[100px]" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredUnits.length > 0 ? (
          viewMode === "kanban" ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredUnits.map((unit) => (
                <Card key={unit.id} className="bg-card hover:shadow-elevated transition-all duration-300 border-border">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-accent/10 rounded-lg">
                          <Home className="h-4 w-4 text-accent" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-semibold text-primary">
                            Unit {unit.unit_number}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Building2 className="h-3 w-3" />
                            {unit.properties?.name}
                          </p>
                        </div>
                      </div>
                      <Badge className={`${unit.status === 'occupied' ? 'bg-success text-success-foreground' : 
                        unit.status === 'vacant' ? 'bg-accent text-accent-foreground' : 
                        'bg-warning text-warning-foreground'}`}>
                        {unit.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Type:</span>
                        <p className="font-medium">{unit.unit_type}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Beds/Baths:</span>
                        <p className="font-medium">{unit.bedrooms}/{unit.bathrooms}</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-border">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Monthly Rent:</span>
                        <span className="font-semibold text-lg text-primary">{formatAmount(unit.rent_amount)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-3">
                      <UnitDetailsDialog 
                        unit={unit} 
                        mode="view"
                        trigger={
                          <Button variant="outline" size="sm" className="flex-1 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        }
                      />
                      <UnitDetailsDialog 
                        unit={unit} 
                        mode="edit"
                        trigger={
                          <Button size="sm" className="flex-1 bg-accent hover:bg-accent/90">
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="text-primary">All Units</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredUnits.map((unit, index) => (
                    <div 
                      key={unit.id} 
                      className={`p-4 rounded-lg border border-border ${
                        index % 2 === 0 ? 'bg-tint-gray' : 'bg-card'
                      } hover:bg-accent/5 transition-colors`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-accent/10 rounded-lg">
                            <Home className="h-4 w-4 text-accent" />
                          </div>
                          <div>
                            <h3 className="font-medium text-primary">Unit {unit.unit_number}</h3>
                            <p className="text-sm text-muted-foreground">{unit.properties?.name} • {unit.unit_type}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-semibold text-primary">{formatAmount(unit.rent_amount)}</p>
                            <p className="text-sm text-muted-foreground">{unit.bedrooms}BR/{unit.bathrooms}BA</p>
                          </div>
                          <Badge className={`${unit.status === 'occupied' ? 'bg-success text-success-foreground' : 
                            unit.status === 'vacant' ? 'bg-accent text-accent-foreground' : 
                            'bg-warning text-warning-foreground'}`}>
                            {unit.status}
                          </Badge>
                           <div className="flex gap-2">
                             <UnitDetailsDialog 
                               unit={unit} 
                               mode="view"
                               trigger={
                                 <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                                   <Eye className="h-4 w-4" />
                                 </Button>
                               }
                             />
                             <UnitDetailsDialog 
                               unit={unit} 
                               mode="edit"
                               trigger={
                                 <Button size="sm" className="bg-accent hover:bg-accent/90">
                                   <Edit className="h-4 w-4" />
                                 </Button>
                               }
                             />
                           </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        ) : (
          <Card className="bg-card">
            <CardContent className="text-center py-12">
              <Home className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-foreground">No units found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm || filterStatus !== "all" || filterProperty !== "all"
                  ? "Try adjusting your search or filters"
                  : "Get started by adding your first unit."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {filteredUnits.length > 0 && (
          <TablePaginator
            currentPage={page}
            totalPages={Math.ceil(totalCount / pageSize)}
            pageSize={pageSize}
            totalItems={totalCount}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>
    </DashboardLayout>
  );
};

export default Units;