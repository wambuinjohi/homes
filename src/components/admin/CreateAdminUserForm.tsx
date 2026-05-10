import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Shield } from "lucide-react";

export function CreateAdminUserForm() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "ziratechnologies@gmail.com",
    password: "Mukima@2025",
    firstName: "Zira",
    lastName: "Technologies",
    role: "Admin"
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Call the edge function to create admin user
      const { data, error } = await supabase.functions.invoke('create-admin-user', {
        body: formData
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Success!",
          description: `Admin user ${formData.email} created successfully`,
        });
        
        // Clear form
        setFormData({
          email: "",
          password: "",
          firstName: "",
          lastName: "",
          role: "Admin"
        });
      } else {
        throw new Error(data.error || "Failed to create admin user");
      }

    } catch (error) {
      console.error('Error creating admin user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create admin user",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateCurrentUserRole = async () => {
    setLoading(true);
    try {
      // Update current user's role to Landlord
      const { error } = await supabase
        .from("user_roles")
        .update({ role: "Landlord" })
        .eq("user_id", "a53f69a5-104e-489b-9b0a-48a56d6b011d");

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Current user role updated to Landlord",
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Alert className="border-info bg-info/10">
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Admin Setup:</strong> This form will create a new super admin user and update the current user to Landlord role.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Create Super Admin User
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                value={formData.role}
                disabled
                className="bg-muted"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Admin User...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Admin User
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Update Current User Role</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Update dmwangui@gmail.com from Admin to Landlord role for the landlord-facing platform.
          </p>
          <Button 
            onClick={updateCurrentUserRole}
            variant="outline"
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating Role...
              </>
            ) : (
              "Update to Landlord Role"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}