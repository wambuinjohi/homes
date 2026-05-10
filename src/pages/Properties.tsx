import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, MapPin, Users, Eye, Edit, Search, Filter, Plus, LayoutGrid, List } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PropertyUnitsWizard } from "@/components/properties/PropertyUnitsWizard";
import { PropertyDetailsDialog } from "@/components/properties/PropertyDetailsDialog";
import { BulkUploadDropdown } from "@/components/bulk-upload/BulkUploadDropdown";
import { KpiGrid } from "@/components/kpi/KpiGrid";
import { KpiStatCard } from "@/components/kpi/KpiStatCard";
import { FeatureGate } from "@/components/ui/feature-gate";
import { ContextualUpgradePrompt } from "@/components/feature-access/ContextualUpgradePrompt";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";
import { TablePaginator } from "@/components/ui/table-paginator";
import { InteractiveTour } from "@/components/onboarding/InteractiveTour";
import { GettingStartedCard } from "@/components/onboarding/GettingStartedCard";
import { useGettingStarted } from "@/hooks/useGettingStarted";

interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  property_type: string;
  total_units: number;
  description?: string;
  amenities?: string[];
  created_at: string;
  updated_at: string;
}

const Properties = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [isMobile, setIsMobile] = useState(false);
  const { page, pageSize, offset, setPage, setPageSize } = useUrlPageParam({ pageSize: 12 });
  const { currentStep, dismissStep } = useGettingStarted();

  useEffect(() => {
    fetchProperties();
    
    // Check if mobile on mount and resize
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [page, pageSize, searchTerm, filterType]);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from("properties" as any)
        .select("*", { count: 'exact' });

      // Apply search filter
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`);
      }

      // Apply type filter
      if (filterType !== "all") {
        query = query.eq('property_type', filterType);
      }

      // Apply pagination
      const { data, error, count } = await query
        .range(offset, offset + pageSize - 1)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProperties((data as unknown as Property[]) || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error("Error fetching properties:", error);
      toast.error("Failed to fetch properties");
    } finally {
      setLoading(false);
    }
  };

  // No client-side filtering needed since we're doing server-side pagination
  const filteredProperties = properties;

  const propertyTypes = ["residential", "commercial", "mixed"];

  const getPropertyTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      apartment: "bg-blue-100 text-blue-800",
      house: "bg-green-100 text-green-800",
      condo: "bg-purple-100 text-purple-800",
      commercial: "bg-orange-100 text-orange-800",
      townhouse: "bg-indigo-100 text-indigo-800",
    };
    return colors[type.toLowerCase()] || "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Properties</h1>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-48 bg-gray-200 rounded-t-lg"></div>
                <CardContent className="p-4">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded mb-4"></div>
                  <div className="flex gap-2">
                    <div className="h-6 w-16 bg-gray-200 rounded"></div>
                    <div className="h-6 w-20 bg-gray-200 rounded"></div>
                  </div>
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
      <div className="bg-tint-gray p-3 sm:p-4 lg:p-6 space-y-6 sm:space-y-8">
        {/* Getting Started Card */}
        {currentStep === "add_property" && properties.length === 0 && (
          <GettingStartedCard
            stepId="add_property"
            title="Let's add your first property"
            description="Start by adding a property to manage your real estate portfolio. This is the foundation of your property management system."
            icon={Building2}
            actionLabel="Add Property"
            onAction={() => {
              const addButton = document.querySelector('[data-tour="add-property-btn"] button') as HTMLButtonElement;
              addButton?.click();
            }}
            onDismiss={() => dismissStep("add_property")}
            currentStep={1}
            totalSteps={4}
          />
        )}
        
        {/* Tour Prompt */}
        <InteractiveTour tourId="add_property_tour" showPrompt={properties.length === 0} />
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" data-tour="properties-header">
          <div>
            <h1 className="text-3xl font-bold text-primary">Properties</h1>
            <p className="text-muted-foreground">
              Manage your property portfolio
            </p>
          </div>
          <div className="flex items-center gap-3 self-stretch sm:self-auto">
            <div data-tour="bulk-upload-btn">
              <BulkUploadDropdown type="properties" onSuccess={fetchProperties} />
            </div>
            <div data-tour="add-property-btn">
              <PropertyUnitsWizard onPropertyAdded={fetchProperties} />
            </div>
          </div>
        </div>

        {/* KPI Summary */}
        <KpiGrid>
          <KpiStatCard
            title="Total Properties"
            value={properties.length}
            subtitle="Active properties"
            icon={Building2}
            gradient="card-gradient-blue"
          />
          <KpiStatCard
            title="Total Units"
            value={properties.reduce((sum, p) => sum + (p.total_units || 0), 0)}
            subtitle="All units"
            icon={Users}
            gradient="card-gradient-green"
          />
          <KpiStatCard
            title="Property Types"
            value={propertyTypes.length}
            subtitle="Unique types"
            icon={MapPin}
            gradient="card-gradient-orange"
          />
          <KpiStatCard
            title="Added This Month"
            value={properties.filter(p => new Date(p.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length}
            subtitle="Recent additions"
            icon={Plus}
            gradient="card-gradient-navy"
          />
        </KpiGrid>

        {/* Search, Filters & View Toggle */}
        <Card className="bg-card p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1" data-tour="search-filter">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search properties by name, address, or city..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-border"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-[180px] border-border">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* View Toggle */}
            <div className="flex items-center space-x-2 bg-secondary rounded-lg p-1" data-tour="view-toggle">
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
        {/* Upgrade Prompt for Property Limits */}
        {properties.length > 0 && properties.length >= 5 && (
          <ContextualUpgradePrompt
            feature={FEATURES.PROPERTIES_MAX}
            title="Expand Your Property Portfolio"
            description="You're managing several properties! Upgrade to add unlimited properties and unlock advanced management features."
            benefits={[
              "Unlimited property additions",
              "Advanced reporting and analytics",
              "Bulk operations and CSV imports",
              "Priority customer support"
            ]}
            variant="banner"
          />
        )}

        {/* Properties Content */}
        {filteredProperties.length === 0 ? (
          <Card className="bg-card">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No properties found</h3>
              <p className="text-muted-foreground text-center mb-6">
                {searchTerm || filterType !== "all" 
                  ? "Try adjusting your search or filters"
                  : "Get started by adding your first property"
                }
              </p>
              {!searchTerm && filterType === "all" && (
                <PropertyUnitsWizard onPropertyAdded={fetchProperties} />
              )}
            </CardContent>
          </Card>
        ) : (
          viewMode === "kanban" ? (
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProperties.map((property) => (
                <Card key={property.id} className="bg-card hover:shadow-elevated transition-all duration-300 border-border">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-accent/10 rounded-lg">
                          <Building2 className="h-4 w-4 text-accent" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-semibold text-primary">
                            {property.name}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {property.address}, {property.city}
                          </p>
                        </div>
                      </div>
                      <Badge className={`${property.property_type === 'apartment' ? 'bg-success text-success-foreground' : 
                        property.property_type === 'house' ? 'bg-accent text-accent-foreground' : 
                        'bg-warning text-warning-foreground'}`}>
                        {property.property_type.charAt(0).toUpperCase() + property.property_type.slice(1)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Type:</span>
                        <p className="font-medium">{property.property_type}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total Units:</span>
                        <p className="font-medium">{property.total_units || 0}</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-border">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Location:</span>
                        <span className="font-semibold text-primary">{property.city}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-3">
                      <PropertyDetailsDialog 
                        property={property} 
                        mode="view"
                        trigger={
                          <Button variant="outline" size="sm" className="flex-1 border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        }
                      />
                      <PropertyDetailsDialog
                        property={property}
                        mode="edit"
                        onUpdated={fetchProperties}
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
                <CardTitle className="text-primary">All Properties</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredProperties.map((property, index) => (
                    <div 
                      key={property.id} 
                      className={`p-4 rounded-lg border border-border ${
                        index % 2 === 0 ? 'bg-tint-gray' : 'bg-card'
                      } hover:bg-accent/5 transition-colors`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-accent/10 rounded-lg">
                            <Building2 className="h-4 w-4 text-accent" />
                          </div>
                          <div>
                            <h3 className="font-medium text-primary">{property.name}</h3>
                            <p className="text-sm text-muted-foreground">{property.address}, {property.city}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-semibold text-primary">{property.total_units || 0} units</p>
                            <p className="text-sm text-muted-foreground">{property.property_type}</p>
                          </div>
                           <div className="flex gap-2">
                             <PropertyDetailsDialog 
                               property={property} 
                               mode="view"
                               trigger={
                                 <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                                   <Eye className="h-4 w-4" />
                                 </Button>
                               }
                             />
                             <PropertyDetailsDialog
                               property={property}
                               mode="edit"
                               onUpdated={fetchProperties}
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
        )}
        
        {/* Pagination */}
        {filteredProperties.length > 0 && (
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

export default Properties;
