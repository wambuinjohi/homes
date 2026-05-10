import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Clock, Gift, Sparkles, Users } from "lucide-react";

interface TrialCampaign {
  id: string;
  name: string;
  trial_days: number;
  grace_days: number;
  description: string;
  is_active: boolean;
  used_count: number;
}

interface CustomTrialManagementProps {
  onTrialCreated?: () => void;
}

export function CustomTrialManagement({ onTrialCreated }: CustomTrialManagementProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    trial_days: 30,
    grace_days: 7,
    description: '',
    is_active: true
  });

  const [userForm, setUserForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: 'Landlord' as const,
    custom_trial_days: 30,
    custom_grace_days: 7
  });

  const createCustomTrial = async () => {
    setLoading(true);
    try {
      // Create user with custom trial period
      const { data, error } = await supabase.functions.invoke('create-user-with-role', {
        body: {
          email: userForm.email,
          first_name: userForm.firstName,
          last_name: userForm.lastName,
          phone: userForm.phone,
          role: userForm.role,
          custom_trial_config: {
            trial_days: userForm.custom_trial_days,
            grace_days: userForm.custom_grace_days
          }
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Success!",
          description: `User created with ${userForm.custom_trial_days}-day trial period`,
        });
        
        // Reset form
        setUserForm({
          email: '',
          firstName: '',
          lastName: '',
          phone: '',
          role: 'Landlord',
          custom_trial_days: 30,
          custom_grace_days: 7
        });
        
        setIsOpen(false);
        onTrialCreated?.();
      } else {
        throw new Error(data.error || "Failed to create user");
      }

    } catch (error) {
      console.error('Error creating custom trial:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create custom trial",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const extendTrial = async (userId: string, additionalDays: number) => {
    setLoading(true);
    try {
      // Get current subscription
      const { data: subscription, error: subError } = await supabase
        .from('landlord_subscriptions')
        .select('*')
        .eq('landlord_id', userId)
        .single();

      if (subError) throw subError;

      // Calculate new end date
      const currentEndDate = new Date(subscription.trial_end_date);
      const newEndDate = new Date(currentEndDate.getTime() + (additionalDays * 24 * 60 * 60 * 1000));

      // Update subscription
      const { error: updateError } = await supabase
        .from('landlord_subscriptions')
        .update({
          trial_end_date: newEndDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('landlord_id', userId);

      if (updateError) throw updateError;

      toast({
        title: "Success!",
        description: `Trial extended by ${additionalDays} days`,
      });

      onTrialCreated?.();
    } catch (error) {
      console.error('Error extending trial:', error);
      toast({
        title: "Error",
        description: "Failed to extend trial",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Gift className="h-4 w-4 text-primary" />
              Custom Trial User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="w-full">
                  <Users className="h-4 w-4 mr-2" />
                  Create User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Create User with Custom Trial
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-6">
                  {/* User Details */}
                  <div className="space-y-4">
                    <h4 className="font-medium">User Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          value={userForm.firstName}
                          onChange={(e) => setUserForm({...userForm, firstName: e.target.value})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={userForm.lastName}
                          onChange={(e) => setUserForm({...userForm, lastName: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={userForm.email}
                        onChange={(e) => setUserForm({...userForm, email: e.target.value})}
                        required
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          value={userForm.phone}
                          onChange={(e) => setUserForm({...userForm, phone: e.target.value})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select value={userForm.role} onValueChange={(value: any) => setUserForm({...userForm, role: value})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Landlord">Landlord</SelectItem>
                            <SelectItem value="Manager">Manager</SelectItem>
                            <SelectItem value="Agent">Agent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Trial Configuration */}
                  <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Custom Trial Configuration
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="trialDays">Trial Period (Days)</Label>
                        <Input
                          id="trialDays"
                          type="number"
                          min="1"
                          max="365"
                          value={userForm.custom_trial_days}
                          onChange={(e) => setUserForm({...userForm, custom_trial_days: parseInt(e.target.value) || 30})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="graceDays">Grace Period (Days)</Label>
                        <Input
                          id="graceDays"
                          type="number"
                          min="0"
                          max="30"
                          value={userForm.custom_grace_days}
                          onChange={(e) => setUserForm({...userForm, custom_grace_days: parseInt(e.target.value) || 7})}
                        />
                      </div>
                    </div>
                    
                    {/* Preview */}
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm text-muted-foreground">
                        <strong>Preview:</strong> User will get a {userForm.custom_trial_days}-day trial with {userForm.custom_grace_days} grace period days
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={createCustomTrial} disabled={loading}>
                      {loading ? "Creating..." : "Create User with Custom Trial"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Trial Extensions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Extend trial periods for existing users
            </p>
            <Badge variant="secondary" className="text-xs">
              Bulk Operations Available
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Campaign Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Create trial campaigns for different offers
            </p>
            <Badge variant="outline" className="text-xs">
              Coming Soon
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}