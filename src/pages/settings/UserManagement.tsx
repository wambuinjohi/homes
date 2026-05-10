import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TablePaginator } from "@/components/ui/table-paginator";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Users, Shield, UserCheck, Settings, Eye, Calendar } from "lucide-react";
import { format } from "date-fns";
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
}

interface AddUserFormData {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

const UserManagement = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AddUserFormData>();
  const { page, pageSize, offset, setPage, setPageSize } = useUrlPageParam({ defaultPage: 1, pageSize: 10 });

  useEffect(() => {
    fetchUsers();
  }, [page, pageSize]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.rpc('admin_list_profiles_with_roles', {
        p_limit: pageSize,
        p_offset: offset
      });

      if (error) throw error;
      
      const result = data as unknown as { success: boolean; users: UserProfile[]; total_count: number; error?: string };
      
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to fetch users');
      }
      
      setUsers(result.users);
      setTotalUsers(result.total_count || 0);
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

  const onAddUser = async (data: AddUserFormData) => {
    if (!selectedRole) return;

    try {
      // Map the role names to the database enum values
      const roleMapping: Record<string, string> = {
        "Admin": "Admin",
        "Landlord": "Landlord"
      };

      const dbRole = roleMapping[selectedRole] || selectedRole;

      // Call the edge function to create user with role
      const { data: result, error } = await supabase.functions.invoke('create-user-with-role', {
        body: {
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone || null,
          role: dbRole
        }
      });

      if (error) throw error;

      // Type the result properly
      const response = result as any;
      
      if (response?.success) {
        toast({
          title: "Success",
          description: `${selectedRole} user created successfully. Email: ${data.email}`,
        });

        // Refresh the users list to show the new user
        await fetchUsers();
        
        reset();
        setAddUserOpen(false);
        setSelectedRole(null);
      } else {
        throw new Error(response?.error || "Failed to create user");
      }
    } catch (error: any) {
      console.error("Error adding user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    }
  };

  const handleRoleSelection = (role: string) => {
    setSelectedRole(role);
    setAddUserOpen(true);
  };

  const getUserRole = (user: UserProfile) => {
    const dbRole = user.user_roles?.[0]?.role || "No Role";
    
    // Map database role to display name
    const roleDisplayMapping: Record<string, string> = {
      "Admin": "Admin",
      "Landlord": "Landlord",
      "landlord_subuser": "Sub-User",
      "Tenant": "Tenant"
    };
    
    return roleDisplayMapping[dbRole] || dbRole;
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "Admin":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "Landlord":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "Sub-User":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "Tenant":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const getRoleUsers = (role: string) => {
    return users.filter(user => getUserRole(user) === role);
  };

  const roleDefinitions = [
    {
      name: "Admin",
      description: "Full administrative access to the platform",
      icon: Shield,
      color: "from-red-500 to-red-600",
      cardClass: "card-gradient-red",
      permissions: [
        "Platform administration",
        "User management", 
        "System configuration",
        "Global oversight"
      ]
    },
    {
      name: "Landlord",
      description: "Property ownership and management access",
      icon: UserCheck,
      color: "from-blue-500 to-blue-600",
      cardClass: "card-gradient-blue",
      permissions: [
        "Property management",
        "Tenant management",
        "Lease administration",
        "Financial oversight"
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-primary">User Role Management</h2>
        <p className="text-muted-foreground">
          Assign roles and permissions to team members
        </p>
      </div>

      {/* Role Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {roleDefinitions.map((role) => {
          const roleUsers = getRoleUsers(role.name);
          const Icon = role.icon;
          
          return (
            <Card key={role.name} className={`relative overflow-hidden border-0 hover:shadow-xl transition-all duration-300 transform hover:scale-105 ${role.cardClass}`}>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <Badge variant="secondary" className="bg-white/20 text-white backdrop-blur-sm">
                    {roleUsers.length} users
                  </Badge>
                </div>
                <CardTitle className="text-xl font-bold text-white mt-4">{role.name}</CardTitle>
                <p className="text-white/90">{role.description}</p>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wide">Permissions:</h4>
                  <ul className="space-y-2">
                    {role.permissions.map((permission, index) => (
                      <li key={index} className="flex items-center gap-3 text-sm text-white/90">
                        <div className="w-2 h-2 rounded-full bg-white/60"></div>
                        <span>{permission}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <Button 
                  onClick={() => handleRoleSelection(role.name)}
                  className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create {role.name}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
        
        <Card className="card-gradient-red hover:shadow-elevated transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Admins</CardTitle>
            <div className="icon-bg-white">
              <Shield className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{getRoleUsers("Admin").length}</div>
            <p className="text-xs text-white/80">Platform administration</p>
          </CardContent>
        </Card>

        <Card className="card-gradient-blue hover:shadow-elevated transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Landlords</CardTitle>
            <div className="icon-bg-white">
              <UserCheck className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{getRoleUsers("Landlord").length}</div>
            <p className="text-xs text-white/80">Property management</p>
          </CardContent>
        </Card>

        <Card className="card-gradient-green hover:shadow-elevated transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Sub-Users</CardTitle>
            <div className="icon-bg-white">
              <Eye className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{getRoleUsers("Sub-User").length}</div>
            <p className="text-xs text-white/80">Delegated access</p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-primary">Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Joined Date</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4">
                    Loading users...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4">
                    No team members found
                  </TableCell>
                </TableRow>
              ) : (
                users.filter(user => ["Admin", "Landlord", "Sub-User"].includes(getUserRole(user))).map((user) => (
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
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(user.created_at), 'MMM dd, yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(getUserRole(user))}>
                        {getUserRole(user)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                        Active
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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

      {/* Add User Dialog */}
      <Dialog open={addUserOpen} onOpenChange={(open) => {
        setAddUserOpen(open);
        if (!open) {
          setSelectedRole(null);
          reset();
        }
      }}>
        <DialogContent className="sm:max-w-[500px] bg-tint-gray">
          <DialogHeader>
            <DialogTitle className="text-primary">
              Add New {selectedRole}
            </DialogTitle>
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
              <Label htmlFor="phone" className="text-primary">Phone (Optional)</Label>
              <Input
                id="phone"
                className="border-border bg-card"
                {...register("phone")}
                placeholder="+254 700 000 000"
              />
            </div>
            
            {selectedRole && (
              <div className="p-4 bg-accent/10 rounded-lg border border-accent/20">
                <h4 className="text-sm font-medium text-primary mb-2">Role: {selectedRole}</h4>
                <p className="text-xs text-muted-foreground">
                  This user will be granted {selectedRole.toLowerCase()} permissions upon account creation.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setAddUserOpen(false)}
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-accent hover:bg-accent/90"
              >
                Create {selectedRole}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;