import React, { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TablePaginator } from "@/components/ui/table-paginator";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, Eye, Shield, Users, Building, Edit3, CreditCard, MapPin, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { format } from "date-fns";

interface LandlordFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

interface PropertyStakeholder {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  created_at: string;
  role: string;
  properties_count?: number;
  tenants_count?: number;
  subscription_status?: string;
  billing_plan?: string;
}

interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  property_type: string;
  total_units: number;
  created_at: string;
}

export default function LandlordManagement() {
  const [stakeholders, setStakeholders] = useState<PropertyStakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addingLandlord, setAddingLandlord] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [propertiesDialogOpen, setPropertiesDialogOpen] = useState(false);
  const [selectedStakeholder, setSelectedStakeholder] = useState<PropertyStakeholder | null>(null);
  const [landlordProperties, setLandlordProperties] = useState<Property[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const { toast } = useToast();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<LandlordFormData>();
  const { register: registerEdit, handleSubmit: handleSubmitEdit, reset: resetEdit, setValue, formState: { errors: editErrors } } = useForm<LandlordFormData>();
  
  // Pagination
  const { page, pageSize, setPage, setPageSize } = useUrlPageParam({ defaultPage: 1, pageSize: 10 });

  useEffect(() => {
    fetchStakeholders();
  }, []);

  const fetchStakeholders = async () => {
    setLoading(true);
    try {
      // Get users with property-related roles
      const { data: propertyRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['Landlord', 'Manager', 'Agent']);

      if (rolesError) throw rolesError;

      // Get profile data for each stakeholder
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', (propertyRoles || []).map(r => r.user_id));

      if (profileError) throw profileError;

      // Get property, tenant, and subscription data for each stakeholder
      const stakeholdersWithCounts = await Promise.all(
        (profiles || []).map(async (profile) => {
          const roleData = propertyRoles?.find(r => r.user_id === profile.id);
          
          const [propertiesResult, tenantsResult, subscriptionResult] = await Promise.all([
            supabase.from('properties').select('id').eq('owner_id', profile.id),
            supabase.from('tenants').select('id').eq('user_id', profile.id),
            supabase
              .from('landlord_subscriptions')
              .select(`
                status,
                billing_plan:billing_plans(name)
              `)
              .eq('landlord_id', profile.id)
              .maybeSingle()
          ]);

          return {
            id: profile.id,
            first_name: profile.first_name,
            last_name: profile.last_name,
            email: profile.email,
            phone: profile.phone,
            created_at: profile.created_at,
            role: roleData?.role || 'Unknown',
            properties_count: propertiesResult.data?.length || 0,
            tenants_count: tenantsResult.data?.length || 0,
            subscription_status: subscriptionResult.data?.status || 'not_subscribed',
            billing_plan: subscriptionResult.data?.billing_plan?.name || 'None'
          };
        })
      );

      // Sort by created_at descending (newest first)
      stakeholdersWithCounts.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setStakeholders(stakeholdersWithCounts);
    } catch (error) {
      console.error('Error fetching stakeholders:', error);
      toast({
        title: "Error",
        description: "Failed to fetch property stakeholders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddLandlord = async (data: LandlordFormData) => {
    setAddingLandlord(true);
    try {
      // Call edge function to create landlord account
      const { data: result, error } = await supabase.functions.invoke('create-admin-user', {
        body: {
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone,
          role: 'Landlord'
        }
      });

      if (error) throw error;

      if (result?.success) {
        toast({
          title: "Success",
          description: "Landlord account created successfully! Login credentials sent via email.",
        });
        reset();
        setAddDialogOpen(false);
        fetchStakeholders();
      } else {
        throw new Error(result?.error || "Failed to create landlord account");
      }
    } catch (error) {
      console.error('Error creating landlord:', error);
      toast({
        title: "Error",
        description: "Failed to create landlord account",
        variant: "destructive",
      });
    } finally {
      setAddingLandlord(false);
    }
  };

  const handleEditStakeholder = async (data: LandlordFormData) => {
    if (!selectedStakeholder) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedStakeholder.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User updated successfully",
      });
      setEditDialogOpen(false);
      setSelectedStakeholder(null);
      fetchStakeholders();
    } catch (error) {
      console.error('Error updating landlord:', error);
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    }
  };

  const openViewDialog = (stakeholder: PropertyStakeholder) => {
    setSelectedStakeholder(stakeholder);
    setViewDialogOpen(true);
  };

  const openEditDialog = (stakeholder: PropertyStakeholder) => {
    setSelectedStakeholder(stakeholder);
    setValue('first_name', stakeholder.first_name);
    setValue('last_name', stakeholder.last_name);
    setValue('email', stakeholder.email);
    setValue('phone', stakeholder.phone);
    setEditDialogOpen(true);
  };

  const openPropertiesDialog = async (stakeholder: PropertyStakeholder) => {
    setSelectedStakeholder(stakeholder);
    setPropertiesDialogOpen(true);
    setLoadingProperties(true);
    
    try {
      const { data: properties, error } = await supabase
        .from('properties')
        .select('id, name, address, city, state, property_type, total_units, created_at')
        .eq('owner_id', stakeholder.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLandlordProperties(properties || []);
    } catch (error) {
      console.error('Error fetching properties:', error);
      toast({
        title: "Error",
        description: "Failed to fetch properties",
        variant: "destructive",
      });
    } finally {
      setLoadingProperties(false);
    }
  };

  // Filter and paginate stakeholders
  const filteredStakeholders = useMemo(() => {
    return stakeholders.filter(stakeholder => {
      // Search filter
      const matchesSearch = !searchTerm || 
        `${stakeholder.first_name} ${stakeholder.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stakeholder.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stakeholder.role.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Role filter
      const matchesRole = roleFilter === "all" || stakeholder.role === roleFilter;
      
      // Status filter
      const matchesStatus = statusFilter === "all" || stakeholder.subscription_status === statusFilter;
      
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [stakeholders, searchTerm, roleFilter, statusFilter]);

  const totalPages = Math.ceil(filteredStakeholders.length / pageSize);
  const paginatedStakeholders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredStakeholders.slice(start, start + pageSize);
  }, [filteredStakeholders, page, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, roleFilter, statusFilter]);

  const clearFilters = () => {
    setSearchTerm("");
    setRoleFilter("all");
    setStatusFilter("all");
  };

  const hasActiveFilters = searchTerm || roleFilter !== "all" || statusFilter !== "all";

  return (
    <DashboardLayout>
      <div className="bg-tint-gray p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary">Property Stakeholder Management</h1>
            <p className="text-muted-foreground">
              Manage property owners, landlords, managers, and agents
            </p>
          </div>
          
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Add Landlord
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-tint-gray">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold text-primary">Add New Landlord</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(handleAddLandlord)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name" className="text-sm font-medium text-primary">
                      First Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="first_name"
                      className="bg-card border-border focus:border-accent focus:ring-accent"
                      {...register("first_name", { required: "First name is required" })}
                      placeholder="John"
                    />
                    {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name" className="text-sm font-medium text-primary">
                      Last Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="last_name"
                      className="bg-card border-border focus:border-accent focus:ring-accent"
                      {...register("last_name", { required: "Last name is required" })}
                      placeholder="Doe"
                    />
                    {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-primary">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    className="bg-card border-border focus:border-accent focus:ring-accent"
                    {...register("email", { 
                      required: "Email is required",
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: "Invalid email address"
                      }
                    })}
                    placeholder="john@example.com"
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium text-primary">
                    Phone Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="phone"
                    className="bg-card border-border focus:border-accent focus:ring-accent"
                    {...register("phone", { required: "Phone number is required" })}
                    placeholder="+254 700 000 000"
                  />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addingLandlord} className="bg-accent hover:bg-accent/90">
                    {addingLandlord ? "Creating..." : "Create Landlord"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-2 md:grid-cols-3">
          <Card className="bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Landlords</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stakeholders.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Properties</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {stakeholders.reduce((sum, stakeholder) => sum + (stakeholder.properties_count || 0), 0)}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {stakeholders.reduce((sum, stakeholder) => sum + (stakeholder.tenants_count || 0), 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-card border-border focus:border-accent focus:ring-accent"
            />
          </div>
          
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full md:w-[180px] bg-card border-border">
              <SelectValue placeholder="Filter by Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="Landlord">Landlord</SelectItem>
              <SelectItem value="Manager">Manager</SelectItem>
              <SelectItem value="Agent">Agent</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[180px] bg-card border-border">
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="trial_expired">Trial Expired</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="not_subscribed">Not Subscribed</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters} className="flex items-center gap-2">
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>

        {/* Results summary */}
        {hasActiveFilters && (
          <div className="text-sm text-muted-foreground">
            Showing {filteredStakeholders.length} of {stakeholders.length} stakeholders
          </div>
        )}

        {/* Landlords List */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-primary">Property Stakeholders Directory</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-pulse text-muted-foreground">Loading stakeholders...</div>
              </div>
            ) : paginatedStakeholders.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-muted-foreground">
                  {hasActiveFilters ? "No stakeholders found matching your filters" : "No stakeholders found"}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {paginatedStakeholders.map((stakeholder) => (
                  <div key={stakeholder.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Shield className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-primary text-lg">
                              {stakeholder.first_name} {stakeholder.last_name}
                            </h3>
                            <Badge variant="secondary" className="text-xs">
                              {stakeholder.role}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{stakeholder.email}</p>
                          <p className="text-sm text-muted-foreground">{stakeholder.phone}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              <Building className="h-3 w-3 mr-1" />
                              {stakeholder.properties_count || 0} Properties
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              {stakeholder.tenants_count || 0} Tenants
                            </Badge>
                            <Badge 
                              variant={stakeholder.subscription_status === 'active' ? 'default' : 
                                      stakeholder.subscription_status === 'trial' ? 'secondary' : 'outline'}
                              className="text-xs"
                            >
                              <CreditCard className="h-3 w-3 mr-1" />
                              {stakeholder.billing_plan}
                            </Badge>
                          </div>
                        </div>
                      </div>
                       <div className="flex items-center space-x-2">
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => openPropertiesDialog(stakeholder)}
                           className="hover:bg-purple-50"
                           disabled={!stakeholder.properties_count || stakeholder.properties_count === 0}
                         >
                           <Building className="h-4 w-4 mr-1" />
                           Properties ({stakeholder.properties_count || 0})
                         </Button>
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => openViewDialog(stakeholder)}
                           className="hover:bg-blue-50"
                         >
                           <Eye className="h-4 w-4 mr-1" />
                           View
                         </Button>
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => openEditDialog(stakeholder)}
                           className="hover:bg-green-50"
                         >
                           <Edit3 className="h-4 w-4 mr-1" />
                           Edit
                         </Button>
                       </div>
                     </div>
                     <div className="mt-3 text-xs text-muted-foreground flex justify-between">
                       <span>Joined: {format(new Date(stakeholder.created_at), 'MMM dd, yyyy')}</span>
                       <Badge 
                         className={
                           stakeholder.subscription_status === 'active' ? 'bg-green-100 text-green-800' :
                           stakeholder.subscription_status === 'trial' ? 'bg-blue-100 text-blue-800' :
                           'bg-gray-100 text-gray-800'
                         }
                       >
                         {stakeholder.subscription_status?.replace('_', ' ').toUpperCase()}
                       </Badge>
                     </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        <TablePaginator
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredStakeholders.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          showPageSizeSelector={true}
        />

        {/* View Stakeholder Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="sm:max-w-[600px] bg-tint-gray">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-primary">Stakeholder Details</DialogTitle>
            </DialogHeader>
            {selectedStakeholder && (
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-primary">
                      {selectedStakeholder.first_name} {selectedStakeholder.last_name}
                    </h3>
                    <p className="text-muted-foreground">{selectedStakeholder.email}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-semibold text-primary">Contact Information</h4>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-sm text-muted-foreground">Phone</Label>
                        <p className="font-medium">{selectedStakeholder.phone}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Email</Label>
                        <p className="font-medium">{selectedStakeholder.email}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Member Since</Label>
                        <p className="font-medium">{format(new Date(selectedStakeholder.created_at), 'MMM dd, yyyy')}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-semibold text-primary">Account Details</h4>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-sm text-muted-foreground">Role</Label>
                        <p className="font-medium">{selectedStakeholder.role}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Properties</Label>
                        <p className="font-medium">{selectedStakeholder.properties_count || 0}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Tenants</Label>
                        <p className="font-medium">{selectedStakeholder.tenants_count || 0}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Billing Plan</Label>
                        <p className="font-medium">{selectedStakeholder.billing_plan}</p>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">Subscription Status</Label>
                        <Badge 
                          className={
                            selectedStakeholder.subscription_status === 'active' ? 'bg-green-100 text-green-800' :
                            selectedStakeholder.subscription_status === 'trial' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }
                        >
                          {selectedStakeholder.subscription_status?.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                    Close
                  </Button>
                  <Button onClick={() => {
                    setViewDialogOpen(false);
                    openEditDialog(selectedStakeholder);
                  }} className="bg-primary hover:bg-primary/90">
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit Details
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Stakeholder Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px] bg-tint-gray">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-primary">Edit Stakeholder</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmitEdit(handleEditStakeholder)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_first_name" className="text-sm font-medium text-primary">
                    First Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit_first_name"
                    className="bg-card border-border focus:border-accent focus:ring-accent"
                    {...registerEdit("first_name", { required: "First name is required" })}
                    placeholder="John"
                  />
                  {editErrors.first_name && <p className="text-xs text-destructive">{editErrors.first_name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_last_name" className="text-sm font-medium text-primary">
                    Last Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit_last_name"
                    className="bg-card border-border focus:border-accent focus:ring-accent"
                    {...registerEdit("last_name", { required: "Last name is required" })}
                    placeholder="Doe"
                  />
                  {editErrors.last_name && <p className="text-xs text-destructive">{editErrors.last_name.message}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_email" className="text-sm font-medium text-primary">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit_email"
                  type="email"
                  className="bg-card border-border focus:border-accent focus:ring-accent"
                  {...registerEdit("email", { 
                    required: "Email is required",
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: "Invalid email address"
                    }
                  })}
                  placeholder="john@example.com"
                />
                {editErrors.email && <p className="text-xs text-destructive">{editErrors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_phone" className="text-sm font-medium text-primary">
                  Phone Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit_phone"
                  className="bg-card border-border focus:border-accent focus:ring-accent"
                  {...registerEdit("phone", { required: "Phone number is required" })}
                  placeholder="+254 700 000 000"
                />
                {editErrors.phone && <p className="text-xs text-destructive">{editErrors.phone.message}</p>}
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-accent hover:bg-accent/90">
                  Save Changes
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Properties Dialog */}
        <Dialog open={propertiesDialogOpen} onOpenChange={setPropertiesDialogOpen}>
          <DialogContent className="sm:max-w-[800px] bg-tint-gray">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-primary">
                Properties - {selectedStakeholder?.first_name} {selectedStakeholder?.last_name}
              </DialogTitle>
            </DialogHeader>
            {selectedStakeholder && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Total Properties: {landlordProperties.length}
                  </div>
                </div>
                
                {loadingProperties ? (
                  <div className="text-center py-8">
                    <div className="animate-pulse text-muted-foreground">Loading properties...</div>
                  </div>
                ) : landlordProperties.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-muted-foreground">No properties found for this landlord</div>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {landlordProperties.map((property) => (
                      <div key={property.id} className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <Building className="h-5 w-5 text-primary" />
                              <h4 className="font-semibold text-primary">{property.name}</h4>
                              <Badge variant="secondary" className="text-xs">
                                {property.property_type}
                              </Badge>
                            </div>
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center text-sm text-muted-foreground">
                                <MapPin className="h-4 w-4 mr-1" />
                                {property.address}, {property.city}, {property.state}
                              </div>
                              <div className="flex items-center text-sm text-muted-foreground">
                                <Building className="h-4 w-4 mr-1" />
                                {property.total_units} Units
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Added: {format(new Date(property.created_at), 'MMM dd, yyyy')}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex justify-end pt-4 border-t">
                  <Button variant="outline" onClick={() => setPropertiesDialogOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
