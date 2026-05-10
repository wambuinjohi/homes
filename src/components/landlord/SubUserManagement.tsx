import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, UserPlus, Settings, UserX, Shield, Users, AlertTriangle } from "lucide-react";
import { TablePaginator } from "@/components/ui/table-paginator";
import { useForm, useWatch } from "react-hook-form";
import { useSubUsers } from "@/hooks/useSubUsers";
import { DisabledActionWrapper } from "@/components/feature-access/DisabledActionWrapper";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";
import { useTrialManagement } from "@/hooks/useTrialManagement";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

interface CreateSubUserFormData {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  title?: string;
  password?: string;
  confirm_password?: string;
  permissions: {
    manage_properties: boolean;
    manage_tenants: boolean;
    manage_leases: boolean;
    manage_maintenance: boolean;
    manage_payments: boolean;
    view_reports: boolean;
    manage_expenses: boolean;
    send_messages: boolean;
  };
}

// Helper to normalize permissions - ensures all 8 permission keys exist
const normalizePermissions = (permissions: Record<string, boolean>): CreateSubUserFormData['permissions'] => {
  return {
    manage_properties: permissions.manage_properties === true,
    manage_tenants: permissions.manage_tenants === true,
    manage_leases: permissions.manage_leases === true,
    manage_maintenance: permissions.manage_maintenance === true,
    manage_payments: permissions.manage_payments === true,
    view_reports: permissions.view_reports === true,
    manage_expenses: permissions.manage_expenses === true,
    send_messages: permissions.send_messages === true,
  };
};

const SubUserManagement = () => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedSubUser, setSelectedSubUser] = useState<any>(null);
  const [roleConflictWarning, setRoleConflictWarning] = useState<string | null>(null);
  const { subUsers, loading, createSubUser, updateSubUserPermissions, deactivateSubUser } = useSubUsers();
  const { page, pageSize, offset, setPage, setPageSize } = useUrlPageParam({ defaultPage: 1, pageSize: 10 });
  const { trialStatus } = useTrialManagement();
  const { register, handleSubmit, reset, watch, setValue, getValues, control, formState: { errors } } = useForm<CreateSubUserFormData>({
    defaultValues: {
      permissions: {
        manage_properties: true,
        manage_tenants: true,
        manage_leases: true,
        manage_maintenance: true,
        manage_payments: true,
        view_reports: true,
        manage_expenses: true,
        send_messages: true,
      }
    }
  });

  const permissions = watch('permissions');
  const passwordValue = useWatch({ control, name: "password" });

  const checkRoleConflicts = async (email: string) => {
    try {
      // Check if user exists and has conflicting roles
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', existingUser.id);

        if (roles && roles.length > 0) {
          const rolesList = roles.map(r => r.role).join(', ');
          const hasConflictingRole = roles.some(r => 
            r.role === 'Admin' || r.role === 'Tenant'
          );
          
          if (hasConflictingRole) {
            setRoleConflictWarning(
              `⚠️ Warning: This user already has roles: ${rolesList}. ` +
              `Adding them as a sub-user may cause role conflicts. ` +
              `Admin and Tenant roles cannot be combined with Landlord/Manager roles.`
            );
            return false;
          }
        }
      }
      setRoleConflictWarning(null);
      return true;
    } catch (error) {
      console.error('Error checking role conflicts:', error);
      return true; // Allow creation if check fails
    }
  };

  const onCreateSubUser = async (data: CreateSubUserFormData) => {
    try {
      // Check for role conflicts before creating
      const canProceed = await checkRoleConflicts(data.email);
      
      if (!canProceed && roleConflictWarning) {
        // Show warning but allow user to proceed
        return;
      }

      // Normalize permissions before sending
      const normalizedData = {
        ...data,
        permissions: normalizePermissions(data.permissions as any)
      };
      await createSubUser(normalizedData);
      setCreateDialogOpen(false);
      setRoleConflictWarning(null);
      reset();
    } catch (error) {
      // Error handled in hook
    }
  };

  const handlePermissionChange = (permission: keyof CreateSubUserFormData['permissions'], value: boolean) => {
    setValue(`permissions.${permission}`, value);
  };

  const openPermissionsDialog = (subUser: any) => {
    setSelectedSubUser(subUser);
    setPermissionsDialogOpen(true);
  };

  const handleUpdatePermissions = async (newPermissions: any) => {
    if (!selectedSubUser) return;
    
    try {
      // Normalize permissions before updating
      const normalizedPermissions = normalizePermissions(newPermissions);
      await updateSubUserPermissions(selectedSubUser.id, normalizedPermissions);
      setPermissionsDialogOpen(false);
      setSelectedSubUser(null);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleDeactivateSubUser = async (subUserId: string) => {
    try {
      await deactivateSubUser(subUserId);
    } catch (error) {
      // Error handled in hook
    }
  };

  const getPermissionCount = (perms: any) => {
    return Object.values(perms).filter(Boolean).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-primary">Sub-User Management</h2>
          <p className="text-muted-foreground">
            Delegate access to trusted partners, managers, and agents
          </p>
        </div>
        <DisabledActionWrapper 
          feature={FEATURES.SUB_USERS}
          fallbackTitle="Create Sub-Users"
          fallbackDescription="Add team members with custom permissions and role-based access control."
        >
          <Button className="bg-accent hover:bg-accent/90 w-full sm:w-auto" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Sub-User
          </Button>
        </DisabledActionWrapper>
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] bg-tint-gray">
          <DialogHeader>
            <DialogTitle className="text-primary">Create New Sub-User</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit(onCreateSubUser)} className="flex flex-col gap-4">
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-6">
              {roleConflictWarning && (
                <Alert variant="destructive" className="bg-destructive/10 border-destructive/50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {roleConflictWarning}
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name" className="text-primary">First Name *</Label>
                  <Input
                    id="first_name"
                    className="border-border bg-card"
                    {...register("first_name", { required: "First name is required" })}
                    placeholder="John"
                  />
                  {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name" className="text-primary">Last Name *</Label>
                  <Input
                    id="last_name"
                    className="border-border bg-card"
                    {...register("last_name", { required: "Last name is required" })}
                    placeholder="Doe"
                  />
                  {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-primary">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  className="border-border bg-card"
                  {...register("email", { required: "Email is required" })}
                  placeholder="john.doe@example.com"
                  onBlur={(e) => checkRoleConflicts(e.target.value)}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                <p className="text-xs text-muted-foreground">
                  If this email exists, we'll reset their password and link them to your organization. You'll receive new credentials to share with them.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-primary">Phone</Label>
                  <Input
                    id="phone"
                    className="border-border bg-card"
                    {...register("phone")}
                    placeholder="+254 700 000 000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-primary">Title</Label>
                  <Input
                    id="title"
                    className="border-border bg-card"
                    {...register("title")}
                    placeholder="Manager, Agent, Partner"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-primary">Password (Optional)</Label>
                <Input
                  id="password"
                  type="password"
                  className="border-border bg-card"
                  {...register("password", {
                    minLength: { value: 8, message: "Password must be at least 8 characters" }
                  })}
                  placeholder="Leave empty to auto-generate"
                />
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                <p className="text-xs text-muted-foreground">
                  Leave empty to auto-generate a secure password. Min 8 characters if provided.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm_password" className="text-primary">Confirm Password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  className="border-border bg-card"
                  {...register("confirm_password", {
                    validate: (value) => {
                      const password = getValues("password");
                      if (!password || password.length === 0) return true;
                      return value === password || "Passwords do not match";
                    }
                  })}
                  placeholder="Re-enter password to confirm"
                />
                {errors.confirm_password && <p className="text-xs text-destructive">{errors.confirm_password.message}</p>}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-primary font-semibold">Permissions</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        Object.keys(permissions).forEach(key => {
                          handlePermissionChange(key as keyof CreateSubUserFormData['permissions'], true);
                        });
                      }}
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        Object.keys(permissions).forEach(key => {
                          handlePermissionChange(key as keyof CreateSubUserFormData['permissions'], false);
                        });
                      }}
                    >
                      Clear All
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {Object.entries({
                    manage_properties: { label: "Manage Properties", description: "Create, edit, and delete properties" },
                    manage_tenants: { label: "Manage Tenants", description: "Add, edit, and view tenant information" },
                    manage_leases: { label: "Manage Leases", description: "Create and modify lease agreements" },
                    manage_maintenance: { label: "Manage Maintenance", description: "View and respond to maintenance requests" },
                    manage_payments: { label: "Manage Payments", description: "Record and track rent payments" },
                    view_reports: { label: "View Reports", description: "Access analytics and financial reports" },
                    manage_expenses: { label: "Manage Expenses", description: "Add and track property expenses" },
                    send_messages: { label: "Send Messages", description: "Send emails and SMS to tenants" },
                  }).map(([key, { label, description }]) => (
                    <div key={key} className="flex items-start space-x-3 p-3 rounded-lg border border-border bg-card/50">
                      <Switch
                        id={key}
                        checked={permissions[key as keyof typeof permissions]}
                        onCheckedChange={(checked) => handlePermissionChange(key as keyof CreateSubUserFormData['permissions'], checked)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <Label htmlFor={key} className="text-sm font-medium cursor-pointer">
                          {label}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              </div>
            </ScrollArea>

            {/* Action Buttons - Outside ScrollArea but inside form */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setCreateDialogOpen(false)}
                className="w-full sm:w-auto border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="w-full sm:w-auto bg-accent hover:bg-accent/90"
              >
                Create Sub-User
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
        <Card className="card-gradient-blue hover:shadow-elevated transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Total Sub-Users</CardTitle>
            <div className="icon-bg-white">
              <Users className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{subUsers.length}</div>
            <p className="text-xs text-white/80">Active sub-users</p>
          </CardContent>
        </Card>
        
        <Card className="card-gradient-green hover:shadow-elevated transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">With Management Access</CardTitle>
            <div className="icon-bg-white">
              <Shield className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {subUsers.filter(su => su.permissions.manage_properties || su.permissions.manage_tenants).length}
            </div>
            <p className="text-xs text-white/80">Can manage data</p>
          </CardContent>
        </Card>

        <Card className="card-gradient-purple hover:shadow-elevated transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">View-Only Access</CardTitle>
            <div className="icon-bg-white">
              <UserPlus className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {subUsers.filter(su => !su.permissions.manage_properties && !su.permissions.manage_tenants && su.permissions.view_reports).length}
            </div>
            <p className="text-xs text-white/80">Read-only access</p>
          </CardContent>
        </Card>
      </div>

      {/* Sub-Users Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-primary">Sub-Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4">
                      Loading sub-users...
                    </TableCell>
                  </TableRow>
                ) : subUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                      No sub-users found. Create your first sub-user to delegate access.
                    </TableCell>
                  </TableRow>
                ) : (
                  subUsers.slice(offset, offset + pageSize).map((subUser) => (
                    <TableRow key={subUser.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {subUser.profiles?.first_name && subUser.profiles?.last_name
                              ? `${subUser.profiles.first_name} ${subUser.profiles.last_name}`
                              : <span className="text-muted-foreground italic">Pending...</span>}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {subUser.profiles?.email || <span className="text-muted-foreground italic">Setting up...</span>}
                      </TableCell>
                      <TableCell>{subUser.title || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {getPermissionCount(subUser.permissions)} permissions
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {subUser.created_at ? new Date(subUser.created_at).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPermissionsDialog(subUser)}
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <UserX className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Deactivate Sub-User</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to deactivate this sub-user? They will lose access to your organization.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeactivateSubUser(subUser.id)}>
                                  Deactivate
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            
            <TablePaginator
              currentPage={page}
              totalPages={Math.ceil(subUsers.length / pageSize)}
              pageSize={pageSize}
              totalItems={subUsers.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              showPageSizeSelector={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Permissions Dialog */}
      {selectedSubUser && (
        <Dialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen}>
          <DialogContent className="sm:max-w-[400px] bg-tint-gray">
            <DialogHeader>
              <DialogTitle className="text-primary">
                Update Permissions - {selectedSubUser.profiles?.first_name} {selectedSubUser.profiles?.last_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex justify-end gap-2 pb-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const updatedPermissions = Object.keys(selectedSubUser.permissions).reduce((acc, key) => ({
                      ...acc,
                      [key]: true
                    }), {});
                    setSelectedSubUser({
                      ...selectedSubUser,
                      permissions: updatedPermissions
                    });
                  }}
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const updatedPermissions = Object.keys(selectedSubUser.permissions).reduce((acc, key) => ({
                      ...acc,
                      [key]: false
                    }), {});
                    setSelectedSubUser({
                      ...selectedSubUser,
                      permissions: updatedPermissions
                    });
                  }}
                >
                  Clear All
                </Button>
              </div>
              <div className="space-y-3">
                {Object.entries({
                  manage_properties: { label: "Manage Properties", description: "Create, edit, and delete properties" },
                  manage_tenants: { label: "Manage Tenants", description: "Add, edit, and view tenant information" },
                  manage_leases: { label: "Manage Leases", description: "Create and modify lease agreements" },
                  manage_maintenance: { label: "Manage Maintenance", description: "View and respond to maintenance requests" },
                  manage_payments: { label: "Manage Payments", description: "Record and track rent payments" },
                  view_reports: { label: "View Reports", description: "Access analytics and financial reports" },
                  manage_expenses: { label: "Manage Expenses", description: "Add and track property expenses" },
                  send_messages: { label: "Send Messages", description: "Send emails and SMS to tenants" },
                }).map(([key, { label, description }]) => {
                  const hasPermission = selectedSubUser.permissions[key as keyof typeof selectedSubUser.permissions];
                  return (
                    <div key={key} className="flex items-start space-x-3 p-3 rounded-lg border border-border bg-card/50">
                      <Switch
                        checked={hasPermission as boolean}
                        onCheckedChange={(checked) => {
                          const updatedPermissions = {
                            ...selectedSubUser.permissions,
                            [key]: checked
                          };
                          setSelectedSubUser({
                            ...selectedSubUser,
                            permissions: updatedPermissions
                          });
                        }}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <Label className="text-sm font-medium cursor-pointer">
                          {label}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setPermissionsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={() => handleUpdatePermissions(selectedSubUser.permissions)}
                className="bg-accent hover:bg-accent/90"
              >
                Update Permissions
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default SubUserManagement;