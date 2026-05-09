import React, { useState, useEffect } from "react";
import { getGlobalCurrencySync, formatAmount } from "@/utils/currency";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserActivity } from "@/hooks/useUserActivity";

const tenantSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  national_id: z.string().optional(),
  profession: z.string().optional(),
  employment_status: z.string().optional(),
  employer_name: z.string().optional(),
  monthly_income: z.number().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  previous_address: z.string().optional(),
  property_id: z.string().optional(),
  unit_id: z.string().optional(),
});

type TenantFormData = z.infer<typeof tenantSchema>;

interface TenantEditFormProps {
  tenant: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    national_id?: string;
    profession?: string;
    employment_status?: string;
    employer_name?: string;
    monthly_income?: number;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    previous_address?: string;
  };
  onSave: (data: TenantFormData) => void;
  onCancel: () => void;
}

export function TenantEditForm({ tenant, onSave, onCancel }: TenantEditFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [currentLease, setCurrentLease] = useState<any>(null);
  const { logActivity } = useUserActivity();

  const form = useForm<TenantFormData>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      first_name: tenant.first_name,
      last_name: tenant.last_name,
      email: tenant.email,
      phone: tenant.phone || "",
      national_id: tenant.national_id || "",
      profession: tenant.profession || "",
      employment_status: tenant.employment_status || "",
      employer_name: tenant.employer_name || "",
      monthly_income: tenant.monthly_income || 0,
      emergency_contact_name: tenant.emergency_contact_name || "",
      emergency_contact_phone: tenant.emergency_contact_phone || "",
      previous_address: tenant.previous_address || "",
    },
  });

  const selectedPropertyId = form.watch("property_id");

  useEffect(() => {
    fetchProperties();
    fetchCurrentLease();
  }, []);

  useEffect(() => {
    if (selectedPropertyId) {
      fetchUnits(selectedPropertyId);
    } else {
      setUnits([]);
    }
  }, [selectedPropertyId]);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('id, name, property_type')
        .order('name');
      
      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const fetchUnits = async (propertyId: string) => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('id, unit_number, rent_amount, status')
        .eq('property_id', propertyId)
        .in('status', ['vacant', 'occupied'])
        .order('unit_number');
      
      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  };

  const fetchCurrentLease = async () => {
    try {
      const { data, error } = await supabase
        .from('leases')
        .select(`
          *,
          units!leases_unit_id_fkey (
            id,
            unit_number,
            property_id,
            properties!units_property_id_fkey (
              id,
              name
            )
          )
        `)
        .eq('tenant_id', tenant.id)
        .eq('status', 'active')
        .maybeSingle();
      
      if (error) throw error;
      
      if (data) {
        setCurrentLease(data);
        form.setValue("property_id", data.units.property_id);
        form.setValue("unit_id", data.unit_id);
      }
    } catch (error) {
      console.error('Error fetching current lease:', error);
    }
  };

  const handleSubmit = async (formData: TenantFormData) => {
    setIsLoading(true);
    try {
      // Update tenant information
      const { error: tenantError } = await supabase
        .from('tenants')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone,
          national_id: formData.national_id,
          profession: formData.profession,
          employment_status: formData.employment_status,
          employer_name: formData.employer_name,
          monthly_income: formData.monthly_income,
          emergency_contact_name: formData.emergency_contact_name,
          emergency_contact_phone: formData.emergency_contact_phone,
          previous_address: formData.previous_address,
        })
        .eq('id', tenant.id);

      if (tenantError) throw tenantError;

      // Handle unit assignment changes
      if (formData.unit_id && formData.unit_id !== currentLease?.unit_id) {
        // End current lease if exists
        if (currentLease) {
          await supabase
            .from('leases')
            .update({ status: 'terminated' })
            .eq('id', currentLease.id);
          
          // Mark old unit as vacant
          await supabase
            .from('units')
            .update({ status: 'vacant' })
            .eq('id', currentLease.unit_id);
        }

        // Create new lease
        const { error: leaseError } = await supabase
          .from('leases')
          .insert({
            tenant_id: tenant.id,
            unit_id: formData.unit_id,
            monthly_rent: units.find(u => u.id === formData.unit_id)?.rent_amount || 50000,
            lease_start_date: new Date().toISOString().split('T')[0],
            lease_end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
            security_deposit: 100000,
            status: 'active'
          });

        if (leaseError) throw leaseError;

        // Mark new unit as occupied
        await supabase
          .from('units')
          .update({ status: 'occupied' })
          .eq('id', formData.unit_id);
      }

      // Log the activity
      await logActivity(
        'tenant_updated',
        'tenant',
        tenant.id,
        {
          tenant_name: `${formData.first_name} ${formData.last_name}`,
          unit_changed: formData.unit_id !== currentLease?.unit_id,
          new_unit_id: formData.unit_id
        }
      );

      toast.success("Tenant information updated successfully");
      onSave(formData);
    } catch (error) {
      console.error('Error updating tenant:', error);
      toast.error("Failed to update tenant information");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Property & Unit Assignment */}
        <div className="bg-modal-edit-accent/5 p-4 rounded-lg space-y-4 border border-modal-edit-accent/20">
          <h3 className="text-sm font-medium text-modal-edit-accent">Property & Unit Assignment</h3>
          {currentLease && (
            <p className="text-sm text-muted-foreground">
              Currently assigned to: {currentLease.units.properties.name} - Unit {currentLease.units.unit_number}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="property_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select property" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {properties.map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.name} ({property.property_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unit_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!selectedPropertyId}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          Unit {unit.unit_number} - {formatAmount(unit.rent_amount)} 
                          <span className={`ml-2 text-xs ${unit.status === 'vacant' ? 'text-green-600' : 'text-orange-600'}`}>
                            ({unit.status})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Personal Information */}
        <div className="bg-muted/30 p-4 rounded-lg space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Personal Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter first name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="last_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter last name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="profession"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Profession</FormLabel>
                <FormControl>
                  <Input placeholder="Enter profession" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Contact Information */}
        <div className="bg-muted/30 p-4 rounded-lg space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Contact Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="Enter email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter phone number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Identification & Employment */}
        <div className="bg-muted/30 p-4 rounded-lg space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Identification & Employment</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="national_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>National ID / Passport</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter ID number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="employment_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employment Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select employment status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Employed">Employed</SelectItem>
                      <SelectItem value="Self-Employed">Self-Employed</SelectItem>
                      <SelectItem value="Unemployed">Unemployed</SelectItem>
                      <SelectItem value="Student">Student</SelectItem>
                      <SelectItem value="Retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="employer_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employer Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter employer name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="monthly_income"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Income ({getGlobalCurrencySync()})</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Enter monthly income" 
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="bg-muted/30 p-4 rounded-lg space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Emergency Contact</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="emergency_contact_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter emergency contact name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="emergency_contact_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter emergency contact phone" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Additional Information */}
        <div className="bg-muted/30 p-4 rounded-lg space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Additional Information</h3>
          <FormField
            control={form.control}
            name="previous_address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Previous Address</FormLabel>
                <FormControl>
                  <Input placeholder="Enter previous address" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  );
}