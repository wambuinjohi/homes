import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { TablePaginator } from "@/components/ui/table-paginator";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useUserActivity } from "@/hooks/useUserActivity";
import { UserSessionsDialog } from "@/components/admin/UserSessionsDialog";
import { UserActivityDialog } from "@/components/admin/UserActivityDialog";
import { UserImpersonationDialog } from "@/components/admin/UserImpersonationDialog";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DataIntegrityMonitor } from "@/components/admin/DataIntegrityMonitor";
import { AccountMergeDialog } from "@/components/admin/AccountMergeDialog";
import { Plus, Trash2, Edit, Users, Shield, UserCheck, UserX, History, Monitor, UserCog, Key, Save, X, Clock } from "lucide-react";
import { useTrialManagement } from "@/hooks/useTrialManagement";
import { TrialCountdown } from "@/components/admin/TrialCountdown";
import { useForm } from "react-hook-form";

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  user_roles: Array<{
    role: string;
  }>;
  subscription?: {
    status: string;
    trial_end_date?: string;
    daysRemaining: number;
  };
  sub_user_info?: {
    landlord_id: string;
    landlord_name: string;
    landlord_email: string;
    title: string | null;
    permissions: Record<string, boolean>;
  };
}

interface AddUserFormData {
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  phone: string;
}

interface EditUserFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
}

const UserManagement = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [sessionsDialogOpen, setSessionsDialogOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [impersonationDialogOpen, setImpersonationDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [duplicateUser, setDuplicateUser] = useState<UserProfile | null>(null);
  const [editData, setEditData] = useState<EditUserFormData>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    role: ""
  });
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [subscriptionFilter, setSubscriptionFilter] = useState<string>("all");
  
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { hasPermission } = usePermissions();
  const { logActivity } = useUserActivity();
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<AddUserFormData>();
  const { page, pageSize, offset, setPage, setPageSize } = useUrlPageParam({ defaultPage: 1, pageSize: 10 });

  const roles = ["Admin", "Landlord", "Manager", "Agent", "Tenant"];

  useEffect(() => {
    fetchUsers();
  }, [page, pageSize, searchQuery, roleFilter, statusFilter, subscriptionFilter]);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    if (page !== 1) {
      setPage(1);
    }
  }, [searchQuery, roleFilter, statusFilter, subscriptionFilter]);

  const fetchUsers = async () => {
    try {
      // Use the optimized RPC function to fetch users with all related data
      const { data: result, error } = await supabase.rpc('admin_list_profiles_with_roles', {
        p_limit: pageSize,
        p_offset: offset
      });

      if (error) throw error;

      const response = result as any;
      if (!response?.success) {
        if (response?.error === 'forbidden') {
          toast({
            title: "Access Denied",
            description: "Admin privileges required to view users",
            variant: "destructive",
          });
          setUsers([]);
          setTotalUsers(0);
          setLoading(false);
          return;
        }
        throw new Error(response?.error || "Failed to fetch users");
      }

      setTotalUsers(response.total_count || 0);
      
      // Fetch subscriptions and sub-user info for users with property roles
      const usersWithSubscriptions = await Promise.all(
        (response.users || []).map(async (user: any) => {
          const propertyRoles = ['Landlord', 'Manager', 'Agent'];
          const hasPropertyRole = user.user_roles?.some((r: any) => propertyRoles.includes(r.role));
          
          let subscription = null;
          if (hasPropertyRole) {
            const { data: subscriptionData } = await supabase
              .from("landlord_subscriptions")
              .select("status, trial_end_date")
              .eq("landlord_id", user.id)
              .maybeSingle();
            
            if (subscriptionData) {
              let daysRemaining = 0;
              if (subscriptionData.trial_end_date) {
                const trialEndDate = new Date(subscriptionData.trial_end_date);
                const today = new Date();
                daysRemaining = Math.max(0, Math.ceil((trialEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
              }
              
              subscription = {
                ...subscriptionData,
                daysRemaining
              };
            }
          }
          
          // Check if user is a sub-user and fetch their info
          let subUserInfo = null;
          const isSubUser = user.user_roles?.some((r: any) => r.role === 'SubUser');
          if (isSubUser) {
            const { data: subUserData } = await supabase
              .from("admin_sub_user_view")
              .select("*")
              .eq("user_id", user.id)
              .eq("status", "active")
              .maybeSingle();
            
            if (subUserData) {
              subUserInfo = {
                landlord_id: subUserData.landlord_id,
                landlord_name: `${subUserData.landlord_first_name || ''} ${subUserData.landlord_last_name || ''}`.trim(),
                landlord_email: subUserData.landlord_email,
                title: subUserData.title,
                permissions: subUserData.permissions as Record<string, boolean>
              };
            }
          }
          
          return {
            ...user,
            subscription,
            sub_user_info: subUserInfo
          };
        })
      );
      
      // Apply client-side filters (since RPC doesn't support filtering yet)
      let filteredUsers = usersWithSubscriptions as UserProfile[];
      
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filteredUsers = filteredUsers.filter(user => 
          (user.first_name?.toLowerCase().includes(query) || false) ||
          (user.last_name?.toLowerCase().includes(query) || false) ||
          (user.email?.toLowerCase().includes(query) || false) ||
          (user.phone?.toLowerCase().includes(query) || false)
        );
      }
      
      // Role filter
      if (roleFilter !== "all") {
        filteredUsers = filteredUsers.filter(user => getUserRole(user) === roleFilter);
      }
      
      // Status filter
      if (statusFilter !== "all") {
        filteredUsers = filteredUsers.filter(user => getUserStatus(user) === statusFilter);
      }
      
      // Subscription filter
      if (subscriptionFilter !== "all") {
        filteredUsers = filteredUsers.filter(user => {
          if (subscriptionFilter === "trial") return user.subscription?.status === "trial";
          if (subscriptionFilter === "active") return user.subscription?.status === "active";
          if (subscriptionFilter === "expired") return user.subscription?.status === "trial_expired";
          if (subscriptionFilter === "no_subscription") return !user.subscription;
          return true;
        });
      }
      
      setUsers(filteredUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleClearFilters = () => {
    setSearchQuery("");
    setRoleFilter("all");
    setStatusFilter("all");
    setSubscriptionFilter("all");
    setPage(1);
  };

  const onAddUser = async (data: AddUserFormData) => {
    try {
      // Use the new create_user_safe function for better duplicate handling
      const { data: result, error } = await supabase.rpc('create_user_safe', {
        p_email: data.email,
        p_first_name: data.first_name,
        p_last_name: data.last_name,
        p_phone: data.phone,
        p_role: data.role as "Admin" | "Landlord" | "Manager" | "Agent" | "Tenant"
      });

      if (error) throw error;

      const resultData = result as any;
      if (!resultData?.success) {
        if (resultData?.error === 'EMAIL_EXISTS') {
          toast({
            title: "Email Already Exists",
            description: `A user with email ${data.email} already exists. Please use a different email or edit the existing user.`,
            variant: "destructive",
          });
          return;
        }
        throw new Error(resultData?.message || "Failed to create user");
      }

      // Show similar users warning if any found
      if (resultData.similar_users && resultData.similar_users.length > 0) {
        toast({
          title: "Similar Users Found",
          description: `Found ${resultData.similar_users.length} similar user(s) with same phone/name. Please review to avoid duplicates.`,
          variant: "default",
        });
      }

      await logActivity('user_created_by_admin', 'user', resultData.user_id, {
        user_email: data.email,
        user_name: `${data.first_name} ${data.last_name}`,
        role: data.role,
        created_by_admin: true,
        similar_users_count: resultData.similar_users?.length || 0
      });

      toast({
        title: "Success",
        description: `User ${data.first_name} ${data.last_name} created successfully.`,
      });
      
      reset();
      setAddUserOpen(false);
      fetchUsers();
    } catch (error) {
      console.error("Error adding user:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add user",
        variant: "destructive",
      });
    }
  };

  const handleEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setEditData({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.user_roles?.[0]?.role || ""
    });
    setEditDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    try {
      // Check if email is being changed and validate uniqueness
      if (editData.email !== editingUser.email) {
        // Check if the new email is already taken by another user
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name')
          .eq('email', editData.email)
          .neq('id', editingUser.id)
          .maybeSingle();

        if (existingUser) {
          toast({
            title: "Email Already Exists", 
            description: `Email ${editData.email} is already used by ${existingUser.first_name} ${existingUser.last_name}`,
            variant: "destructive",
          });
          return;
        }

        // Use edge function to update email in both auth and profile
        const { data: emailResult, error: emailError } = await supabase.functions.invoke('update-user-email', {
          body: {
            user_id: editingUser.id,
            new_email: editData.email
          }
        });

        if (emailError) throw emailError;

        const response = emailResult as any;
        if (!response?.success) {
          throw new Error(response?.error || "Failed to update email");
        }

        // Show success message with password reset info
        toast({
          title: "Email Updated",
          description: `User email updated to ${editData.email}. A password reset email has been sent to the new address.`,
        });

        console.log('Email updated successfully via edge function');
      }

      // Update other profile fields (excluding email since it's handled above)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: editData.first_name,
          last_name: editData.last_name,
          phone: editData.phone,
          updated_at: new Date().toISOString()
        })
        .eq("id", editingUser.id);

      if (profileError) throw profileError;

      // Update role if changed
      if (editData.role && editData.role !== editingUser.user_roles?.[0]?.role) {
        // Show confirmation dialog for role changes
        const confirmed = window.confirm(
          `Are you sure you want to change ${editingUser.first_name} ${editingUser.last_name}'s role from ${getUserRole(editingUser)} to ${editData.role}? This change will be logged for audit purposes.`
        );
        
        if (!confirmed) {
          return;
        }

        // Update using UPSERT to prevent unique constraint violations
        const { error: roleError } = await supabase
          .from("user_roles")
          .upsert({ 
            user_id: editingUser.id, 
            role: editData.role as "Admin" | "Landlord" | "Manager" | "Agent" | "Tenant"
          }, {
            onConflict: 'user_id,role'
          });

        if (roleError) throw roleError;

        // Log the activity - this will be automatically logged by our trigger
        await logActivity('user_role_updated', 'user', editingUser.id, {
          old_role: getUserRole(editingUser),
          new_role: editData.role,
          updated_by_admin: true
        });
      }

      // Log the profile update activity
      await logActivity('user_profile_updated', 'user', editingUser.id, {
        updated_by_admin: true,
        updated_fields: ['first_name', 'last_name', 'email', 'phone']
      });

      toast({
        title: "Success",
        description: "User profile updated successfully",
      });
      
      setEditDialogOpen(false);
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      toast({
        title: "Error",
        description: "Failed to update user profile",
        variant: "destructive",
      });
    }
  };

  const handleResetPassword = async (user: UserProfile) => {
    try {
      const { data: result, error } = await supabase.functions.invoke('admin-user-operations', {
        body: {
          operation: 'reset_password',
          userId: user.id
        }
      });

      if (error) throw error;

      const response = result as any;
      if (!response?.success) {
        throw new Error(response?.error || "Failed to send password reset");
      }

      toast({
        title: "Success",
        description: `Password reset sent via ${response.channels_used?.join(' and ') || 'email'}`,
      });
    } catch (error) {
      console.error("Error resetting password:", error);
      toast({
        title: "Error",
        description: "Failed to send password reset",
        variant: "destructive",
      });
    }
  };

  const handleResetTrial = async (user: UserProfile, trialDays: number = 30) => {
    try {
      const { data: result, error } = await supabase.functions.invoke('admin-user-operations', {
        body: {
          operation: 'reset_trial',
          userId: user.id,
          trialDays
        }
      });

      if (error) throw error;

      const response = result as any;
      if (!response?.success) {
        throw new Error(response?.error || "Failed to reset trial");
      }

      toast({
        title: "Success",
        description: `Trial reset for ${trialDays} days`,
      });
      
      fetchUsers(); // Refresh data
    } catch (error) {
      console.error("Error resetting trial:", error);
      toast({
        title: "Error",
        description: "Failed to reset trial",
        variant: "destructive",
      });
    }
  };

  const handleSuspendUser = async (user: UserProfile) => {
    try {
      const { data: result, error } = await supabase.functions.invoke('admin-user-operations', {
        body: {
          operation: 'suspend_user',
          userId: user.id
        }
      });

      if (error) throw error;

      const response = result as any;
      if (!response?.success) {
        throw new Error(response?.error || "Failed to suspend user");
      }

      toast({
        title: "Success",
        description: `User ${user.first_name} ${user.last_name} has been suspended`,
      });
      
      fetchUsers(); // Refresh data
    } catch (error) {
      console.error("Error suspending user:", error);
      toast({
        title: "Error",
        description: "Failed to suspend user",
        variant: "destructive",
      });
    }
  };

  const handleActivateUser = async (user: UserProfile) => {
    try {
      const { data: result, error } = await supabase.functions.invoke('admin-user-operations', {
        body: {
          operation: 'activate_user',
          userId: user.id
        }
      });

      if (error) throw error;

      const response = result as any;
      if (!response?.success) {
        throw new Error(response?.error || "Failed to activate user");
      }

      toast({
        title: "Success",
        description: `User ${user.first_name} ${user.last_name} has been activated`,
      });
      
      fetchUsers(); // Refresh data
    } catch (error) {
      console.error("Error activating user:", error);
      toast({
        title: "Error",
        description: "Failed to activate user",
        variant: "destructive",
      });
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      // First, delete existing roles for this user
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      // Then insert the new role
      const { error } = await supabase
        .from("user_roles")
        .insert([{ 
          user_id: userId, 
          role: newRole as "Admin" | "Landlord" | "Manager" | "Agent" | "Tenant"
        }]);

      if (error) throw error;

      // Log the activity
      await logActivity('user_role_updated', 'user', userId, {
        old_role: getUserRole(users.find(u => u.id === userId) || {} as UserProfile),
        new_role: newRole,
        updated_by_admin: true
      });

      toast({
        title: "Success",
        description: "User role updated successfully",
      });
      
      fetchUsers();
    } catch (error) {
      console.error("Error updating user role:", error);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    }
  };

  const removeUser = async (userId: string, permanent: boolean = false) => {
    try {
      const userToRemove = users.find(u => u.id === userId);
      
      const { data: result, error } = await supabase.functions.invoke('admin-user-operations', {
        body: {
          operation: permanent ? 'permanently_delete_user' : 'soft_delete_user',
          userId: userId
        }
      });

      if (error) throw error;

      const response = result as any;
      if (!response?.success) {
        if (response?.transfer_required) {
          toast({
            title: "Cannot Delete User",
            description: "User has active dependencies. Please transfer ownership first.",
            variant: "destructive",
          });
          // TODO: Show transfer ownership dialog
          return;
        }
        throw new Error(response?.error || "Failed to delete user");
      }

      toast({
        title: "Success",
        description: permanent ? "User permanently deleted" : "User soft deleted successfully",
      });
      
      fetchUsers();
    } catch (error) {
      console.error("Error removing user:", error);
      toast({
        title: "Error",
        description: "Failed to remove user",
        variant: "destructive",
      });
    }
  };

  const getUserRole = (user: UserProfile) => {
    return user.user_roles?.[0]?.role || "No Role";
  };

  const getUserStatus = (user: UserProfile) => {
    return user.user_roles?.length > 0 ? "Active" : "Pending";
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "Admin":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "Landlord":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "Manager":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "Agent":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "Tenant":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "SubUser":
        return "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    return status === "Active" 
      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
      : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-primary">User Management</h2>
            <p className="text-muted-foreground">
              Manage user accounts and role assignments
            </p>
          </div>
          <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent hover:bg-accent/90">
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-tint-gray">
              <DialogHeader>
                <DialogTitle className="text-primary">Add New User</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onAddUser)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="first_name" className="text-primary">First Name</Label>
                    <Input
                      id="first_name"
                      className="border-border bg-card"
                      {...register("first_name", { required: "First name is required" })}
                      placeholder="John"
                    />
                    {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name" className="text-primary">Last Name</Label>
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
                  <Label htmlFor="email" className="text-primary">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    className="border-border bg-card"
                    {...register("email", { required: "Email is required" })}
                    placeholder="john.doe@example.com"
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-primary">Phone *</Label>
                  <Input
                    id="phone"
                    className="border-border bg-card"
                    {...register("phone", { required: "Phone number is required" })}
                    placeholder="+254 700 000 000"
                  />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role" className="text-primary">Role</Label>
                  <Select onValueChange={(value) => setValue("role", value)}>
                    <SelectTrigger className="border-border bg-card">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {roles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.role && <p className="text-xs text-destructive">Role is required</p>}
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setAddUserOpen(false)} className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-accent hover:bg-accent/90">Add User</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Data Integrity Monitor */}
        <DataIntegrityMonitor />
        
        {/* Filters Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-primary flex items-center justify-between">
              <span>Filter Users</span>
              {(searchQuery || roleFilter !== "all" || statusFilter !== "all" || subscriptionFilter !== "all") && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleClearFilters}
                  className="text-muted-foreground hover:text-primary"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="space-y-2">
                <Label className="text-primary text-sm">Search</Label>
                <Input
                  placeholder="Name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-border bg-card"
                />
              </div>
              
              {/* Role Filter */}
              <div className="space-y-2">
                <Label className="text-primary text-sm">Role</Label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="border-border bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">All Roles</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Status Filter */}
              <div className="space-y-2">
                <Label className="text-primary text-sm">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="border-border bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Subscription Filter */}
              <div className="space-y-2">
                <Label className="text-primary text-sm">Subscription</Label>
                <Select value={subscriptionFilter} onValueChange={setSubscriptionFilter}>
                  <SelectTrigger className="border-border bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">All Subscriptions</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="no_subscription">No Subscription</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Active filters summary */}
            {(searchQuery || roleFilter !== "all" || statusFilter !== "all" || subscriptionFilter !== "all") && (
              <div className="mt-4 p-3 bg-muted/50 rounded-md">
                <p className="text-sm text-muted-foreground">
                  Showing {users.length} of {totalUsers} users
                  {searchQuery && ` matching "${searchQuery}"`}
                  {roleFilter !== "all" && ` • Role: ${roleFilter}`}
                  {statusFilter !== "all" && ` • Status: ${statusFilter}`}
                  {subscriptionFilter !== "all" && ` • Subscription: ${subscriptionFilter}`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card className="card-gradient-blue hover:shadow-elevated transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Total Users</CardTitle>
              <div className="icon-bg-white">
                <Users className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{users.length}</div>
              <p className="text-xs text-white/80">Registered users</p>
            </CardContent>
          </Card>
          <Card className="card-gradient-green hover:shadow-elevated transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Active Users</CardTitle>
              <div className="icon-bg-white">
                <UserCheck className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {users.filter(u => getUserStatus(u) === "Active").length}
              </div>
              <p className="text-xs text-white/80">With assigned roles</p>
            </CardContent>
          </Card>
          <Card className="card-gradient-orange hover:shadow-elevated transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Pending Users</CardTitle>
              <div className="icon-bg-white">
                <UserX className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {users.filter(u => getUserStatus(u) === "Pending").length}
              </div>
              <p className="text-xs text-white/80">Awaiting setup</p>
            </CardContent>
          </Card>
          <Card className="card-gradient-navy hover:shadow-elevated transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-white">Admins</CardTitle>
              <div className="icon-bg-white">
                <Shield className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {users.filter(u => getUserRole(u) === "Admin").length}
              </div>
              <p className="text-xs text-white/80">System administrators</p>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-primary">Platform Users</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Parent Landlord</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trial Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-4">
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-4">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        {user.first_name && user.last_name 
                          ? `${user.first_name} ${user.last_name}`
                          : user.email || "No name"
                        }
                      </TableCell>
                      <TableCell>{user.email || "No email"}</TableCell>
                      <TableCell>{user.phone || "No phone"}</TableCell>
                      <TableCell>
                        <Select
                          value={getUserRole(user)}
                          onValueChange={(value) => updateUserRole(user.id, value)}
                          disabled={user.id === currentUser?.id}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue>
                              <Badge className={getRoleBadgeColor(getUserRole(user))}>
                                {getUserRole(user)}
                              </Badge>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {user.sub_user_info ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-sm">{user.sub_user_info.landlord_name}</span>
                            <span className="text-xs text-muted-foreground">{user.sub_user_info.landlord_email}</span>
                            {user.sub_user_info.title && (
                              <Badge variant="outline" className="w-fit text-xs">
                                {user.sub_user_info.title}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                       <TableCell>
                         <Badge 
                           className={`cursor-pointer transition-colors ${getStatusBadgeColor(getUserStatus(user))}`}
                           onClick={() => {
                             const currentStatus = getUserStatus(user);
                             if (currentStatus === "Active") {
                               handleSuspendUser(user);
                             } else {
                               handleActivateUser(user);
                             }
                           }}
                         >
                           {getUserStatus(user)}
                         </Badge>
                       </TableCell>
                      <TableCell>
                        {user.subscription ? (
                          <TrialCountdown 
                            daysRemaining={user.subscription.daysRemaining}
                            status={user.subscription.status}
                          />
                        ) : (
                          ['Landlord', 'Manager', 'Agent'].includes(getUserRole(user)) ? (
                            <Badge variant="outline" className="text-muted-foreground">
                              No Subscription
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {/* Edit User */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditUser(user)}
                            className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>

                          {/* Reset Password */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-orange-500 text-orange-600 hover:bg-orange-500 hover:text-white"
                              >
                                <Key className="h-4 w-4 mr-1" />
                                Reset
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Reset Password</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will send a temporary password to {user.email}. The user will need to change it on their next login.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleResetPassword(user)}
                                  className="bg-orange-500 hover:bg-orange-600"
                                >
                                  Send Reset Email
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                          {/* View Sessions */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedUser(user);
                              setSessionsDialogOpen(true);
                            }}
                            className="border-blue-500 text-blue-600 hover:bg-blue-500 hover:text-white"
                          >
                            <Monitor className="h-4 w-4 mr-1" />
                            Sessions
                          </Button>

                          {/* View Activity */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedUser(user);
                              setActivityDialogOpen(true);
                            }}
                            className="border-purple-500 text-purple-600 hover:bg-purple-500 hover:text-white"
                          >
                            <History className="h-4 w-4 mr-1" />
                            Activity
                          </Button>

                          {/* User Impersonation */}
                          {hasPermission("users.impersonate") && user.id !== currentUser?.id && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedUser(user);
                                setImpersonationDialogOpen(true);
                              }}
                              className="border-red-500 text-red-600 hover:bg-red-500 hover:text-white"
                            >
                              <UserCog className="h-4 w-4 mr-1" />
                              Impersonate
                            </Button>
                          )}

                          {/* Remove User */}
                          {user.id !== currentUser?.id && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-red-500 text-red-600 hover:bg-red-500 hover:text-white"
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Remove
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove User Access</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will revoke all access for {user.first_name} {user.last_name}. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                   <AlertDialogAction
                                     onClick={() => removeUser(user.id, false)}
                                     className="bg-orange-500 hover:bg-orange-600"
                                   >
                                     Soft Delete
                                   </AlertDialogAction>
                                   <AlertDialogAction
                                     onClick={() => removeUser(user.id, true)}
                                     className="bg-red-600 hover:bg-red-700 text-white ml-2"
                                   >
                                     Permanent Delete
                                   </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit User Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px] bg-tint-gray">
            <DialogHeader>
              <DialogTitle className="text-primary">Edit User Profile</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_first_name" className="text-primary">First Name</Label>
                  <Input
                    id="edit_first_name"
                    value={editData.first_name}
                    onChange={(e) => setEditData({ ...editData, first_name: e.target.value })}
                    className="border-border bg-card"
                    placeholder="First Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_last_name" className="text-primary">Last Name</Label>
                  <Input
                    id="edit_last_name"
                    value={editData.last_name}
                    onChange={(e) => setEditData({ ...editData, last_name: e.target.value })}
                    className="border-border bg-card"
                    placeholder="Last Name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_email" className="text-primary">Email</Label>
                <Input
                  id="edit_email"
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  className="border-border bg-card"
                  placeholder="Email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_phone" className="text-primary">Phone</Label>
                <Input
                  id="edit_phone"
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  className="border-border bg-card"
                  placeholder="Phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_role" className="text-primary">Role</Label>
                <Select value={editData.role} onValueChange={(value) => setEditData({ ...editData, role: value })}>
                  <SelectTrigger className="border-border bg-card">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {roles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditDialogOpen(false)}
                  className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button 
                  onClick={handleSaveUser}
                  className="bg-accent hover:bg-accent/90"
                >
                  <Save className="h-4 w-4 mr-1" />
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* User Sessions Dialog */}
        <UserSessionsDialog
          open={sessionsDialogOpen}
          onOpenChange={setSessionsDialogOpen}
          userId={selectedUser?.id || ""}
          userName={selectedUser ? `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || selectedUser.email || 'Unknown User' : 'Unknown User'}
        />

        {/* User Activity Dialog */}
        <UserActivityDialog
          open={activityDialogOpen}
          onOpenChange={setActivityDialogOpen}
          userId={selectedUser?.id || ""}
          userName={selectedUser ? `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || selectedUser.email || 'Unknown User' : 'Unknown User'}
        />

        {/* User Impersonation Dialog */}
        <UserImpersonationDialog
          open={impersonationDialogOpen}
          onOpenChange={setImpersonationDialogOpen}
          user={selectedUser}
        />

        {/* Account Merge Dialog */}
        {selectedUser && duplicateUser && (
          <AccountMergeDialog
            open={mergeDialogOpen}
            onOpenChange={setMergeDialogOpen}
            primaryUser={selectedUser}
            duplicateUser={duplicateUser}
            onMergeComplete={() => {
              setMergeDialogOpen(false);
              setSelectedUser(null);
              setDuplicateUser(null);
              fetchUsers();
            }}
          />
        )}
        
        {/* Pagination */}
        <TablePaginator
          currentPage={page}
          totalPages={Math.ceil(totalUsers / pageSize)}
          pageSize={pageSize}
          totalItems={totalUsers}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          showPageSizeSelector={true}
        />
      </div>
    </DashboardLayout>
  );
};

export default UserManagement;