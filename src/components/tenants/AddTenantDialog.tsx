import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserActivity } from "@/hooks/useUserActivity";
import { Plus, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const tenantFormSchemaBase = z.object({
  first_name: z.string().min(1, "First name is required").transform((s) => s.trim()),
  last_name: z.string().min(1, "Last name is required").transform((s) => s.trim()),
  email: z.string().email("Invalid email address").transform((s) => s.trim()),
  phone: z.string()
    .min(1, "Phone number is required")
    .transform((s) => s.trim())
    .refine((phone) => /^\+[1-9][0-9]{7,14}$/.test(phone), {
      message: "Please enter a valid phone number in international format (e.g., +254712345678)"
    }),
  national_id: z.string().min(1, "National ID or Passport is required").transform((s) => s.trim()),
  profession: z.string().optional(),
  employment_status: z.string().optional(),
  employer_name: z.string().optional(),
  monthly_income: z.coerce.number().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  previous_address: z.string().optional(),
  property_id: z.string().min(1, "Property is required"),
  unit_id: z.string().min(1, "Unit is required"),
  lease_start_date: z.string().optional(),
  lease_end_date: z.string().optional(),
  monthly_rent: z.coerce.number().optional(),
  security_deposit: z.coerce.number().optional(),
});

const tenantFormSchema = tenantFormSchemaBase.superRefine((val, ctx) => {
  const hasUnit = Boolean(val.unit_id);
  if (hasUnit) {
    if (!val.lease_start_date) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Lease start date is required", path: ["lease_start_date"] });
    if (!val.lease_end_date) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Lease end date is required", path: ["lease_end_date"] });
    if (val.monthly_rent == null || isNaN(Number(val.monthly_rent)) || Number(val.monthly_rent) <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Monthly rent is required", path: ["monthly_rent"] });
    }
    if (val.security_deposit != null && isNaN(Number(val.security_deposit))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Security deposit must be a number", path: ["security_deposit"] });
    }
  }
});

type TenantFormData = z.infer<typeof tenantFormSchema>;

interface AddTenantDialogProps {
  onTenantAdded: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

export function AddTenantDialog({ onTenantAdded, open: controlledOpen, onOpenChange, showTrigger = true }: AddTenantDialogProps) {
  const [open, setOpen] = useState(false);
  const isOpen = controlledOpen ?? open;
  const handleOpenChange = (next: boolean) => {
    if (onOpenChange) onOpenChange(next);
    else setOpen(next);
  };
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [unitTypeFilter, setUnitTypeFilter] = useState<string>("all");
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [existingTenant, setExistingTenant] = useState<any>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const { toast } = useToast();
  const { user } = useAuth();
  const { logActivity } = useUserActivity();

  const form = useForm<TenantFormData>({
    resolver: zodResolver(tenantFormSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      national_id: "",
      profession: "",
      employment_status: "",
      employer_name: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      previous_address: "",
      property_id: "",
      unit_id: "",
      lease_start_date: "",
      lease_end_date: "",
    },
  });

  const getTabErrors = () => {
    const errors = form.formState.errors;
    const basicFields = ['first_name', 'last_name', 'email', 'phone', 'national_id'];
    const leaseFields = ['property_id', 'unit_id', 'lease_start_date', 'lease_end_date', 'monthly_rent', 'security_deposit'];
    const additionalFields = ['profession', 'employment_status', 'employer_name', 'monthly_income', 'emergency_contact_name', 'emergency_contact_phone', 'previous_address'];
    
    return {
      basic: basicFields.filter(field => errors[field as keyof typeof errors]).length,
      lease: leaseFields.filter(field => errors[field as keyof typeof errors]).length,
      additional: additionalFields.filter(field => errors[field as keyof typeof errors]).length,
    };
  };

  useEffect(() => {
    if (isOpen) {
      fetchProperties();
      form.reset();
      setSelectedProperty("");
      setUnits([]);
      setActiveTab("basic");
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedProperty) {
      fetchUnits(selectedProperty);
    } else {
      setUnits([]);
    }
  }, [selectedProperty]);

  const fetchProperties = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("properties")
      .select("id, name, address")
      .or(`owner_id.eq.${user.id},manager_id.eq.${user.id}`)
      .order("name");
    if (error) {
      console.error("Error fetching properties:", error);
      toast({ title: "Error", description: "Failed to fetch properties", variant: "destructive" });
    } else {
      setProperties(data || []);
    }
  };

  const fetchUnits = async (propertyId: string) => {
    const { data, error } = await supabase
      .from("units")
      .select("id, unit_number, status, rent_amount, security_deposit, unit_type, bedrooms")
      .eq("property_id", propertyId)
      .eq("status", "vacant")
      .order("unit_number");
    if (error) {
      console.error("Error fetching units:", error);
      toast({ title: "Error", description: "Failed to fetch units", variant: "destructive" });
    } else {
      setUnits(data || []);
      setUnitTypeFilter("all");
    }
  };

  const formatKES = (amount?: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 0,
    }).format(Number(amount || 0));
  };

  const handleUnitChange = (unitId: string) => {
    const selectedUnit = units.find(u => u.id === unitId);
    if (selectedUnit) {
      if (selectedUnit.rent_amount) {
        form.setValue("monthly_rent", selectedUnit.rent_amount);
      }
      if (selectedUnit.security_deposit) {
        form.setValue("security_deposit", selectedUnit.security_deposit);
      }
    }
  };

  const filteredUnits = units.filter(u => 
    unitTypeFilter === "all" || (u.unit_type || "").toLowerCase() === unitTypeFilter.toLowerCase()
  );

  const uniqueUnitTypes = Array.from(new Set(units.map(u => u.unit_type).filter(Boolean)));


  const checkForExistingTenant = async (email: string, phone: string, nationalId: string) => {
    try {
      const { data, error } = await supabase.rpc("lookup_tenant_in_portfolio", {
        p_email: email,
        p_phone: phone,
        p_national_id: nationalId,
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error checking for existing tenant:", error);
      return null;
    }
  };

  const onSubmit = async (data: TenantFormData) => {
    try {
      // Log form state for debugging
      console.log('[AddTenant] Form submission started');
      console.log('[AddTenant] Form values:', data);
      console.log('[AddTenant] Form errors:', form.formState.errors);
      
      // Check if there are validation errors
      const errors = form.formState.errors;
      if (Object.keys(errors).length > 0) {
        console.error('[AddTenant] Validation errors found:', errors);
        
        // Determine which tab has errors
        const basicFields = ['first_name', 'last_name', 'email', 'phone', 'national_id'];
        const leaseFields = ['property_id', 'unit_id', 'lease_start_date', 'lease_end_date', 'monthly_rent'];
        
        const hasBasicErrors = basicFields.some(field => errors[field as keyof typeof errors]);
        const hasLeaseErrors = leaseFields.some(field => errors[field as keyof typeof errors]);
        
        // Switch to the first tab with errors
        if (hasBasicErrors) {
          setActiveTab('basic');
          toast({
            title: "Validation Error",
            description: "Please fill in all required fields in Basic Info",
            variant: "destructive",
          });
        } else if (hasLeaseErrors) {
          setActiveTab('lease');
          toast({
            title: "Validation Error",
            description: "Please complete all required fields in Lease Details",
            variant: "destructive",
          });
        }
        
        return; // Stop submission
      }
      
      setLoading(true);
      
      const existing = await checkForExistingTenant(data.email, data.phone, data.national_id);
      
      if (existing) {
        setExistingTenant(existing);
        setShowConfirmDialog(true);
        setLoading(false);
        return;
      }

      await createTenant(data);
    } catch (error) {
      console.error("Error in onSubmit:", error);
      setLoading(false);
    }
  };

  const createTenant = async (data: TenantFormData, attachToExisting: boolean = false) => {
    const timeoutDuration = 30000;
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Request timed out")), timeoutDuration)
    );

    try {
      setLoading(true);

      let rpcPromise;
      
      if (attachToExisting && existingTenant?.id) {
        // For existing tenant, use RPC to attach lease
        rpcPromise = supabase.rpc('attach_lease_and_occupy_unit', {
          p_tenant_id: existingTenant.id,
          p_unit_id: data.unit_id,
          p_lease_start_date: data.lease_start_date!,
          p_lease_end_date: data.lease_end_date!,
          p_monthly_rent: data.monthly_rent!,
          p_security_deposit: data.security_deposit || null,
          p_lease_terms: null
        });
      } else {
        // For new tenant, use the RPC (aligned with DB function signature)
        const payload = {
          p_first_name: data.first_name,
          p_last_name: data.last_name,
          p_email: data.email,
          p_phone: data.phone,
          p_national_id: data.national_id || null,
          p_date_of_birth: null,
          p_employment_status: data.employment_status || null,
          p_employer_name: data.employer_name || null,
          p_employer_contact: null,
          p_emergency_contact_name: data.emergency_contact_name || null,
          p_emergency_contact_phone: data.emergency_contact_phone || null,
          p_emergency_contact_relationship: null,
          p_previous_address: data.previous_address || null,
          p_previous_landlord_name: null,
          p_previous_landlord_contact: null,
          p_unit_id: data.unit_id,
          p_lease_start_date: data.lease_start_date!,
          p_lease_end_date: data.lease_end_date!,
          p_monthly_rent: data.monthly_rent!,
          p_security_deposit: data.security_deposit || null,
          p_lease_terms: null
        };

        console.log('[createTenant] Payload keys:', Object.keys(payload));
        rpcPromise = supabase.rpc("create_tenant_and_optional_lease", payload);
      }

      const result = await Promise.race([rpcPromise, timeoutPromise]);

      const { data: rpcData, error: rpcError } = result as any;

      if (rpcError) {
        console.error('RPC error:', rpcError);
        throw rpcError;
      }

      console.log('[createTenant] RPC Response:', rpcData);
      
      // Check RPC response format (works for both new tenant and attach existing)
      if (!rpcData || (typeof rpcData === 'object' && !rpcData.success)) {
        const errorMsg = rpcData?.error || (attachToExisting ? 'Failed to attach lease' : 'Failed to create tenant');
        console.error(attachToExisting ? 'Lease attachment failed:' : 'Tenant creation failed:', errorMsg, rpcData);
        
        // Set specific form errors based on error message
        if (errorMsg.toLowerCase().includes('phone')) {
          form.setError('phone', { message: 'Phone number must be in E.164 format (e.g., +254712345678)' });
        } else if (errorMsg.toLowerCase().includes('email')) {
          form.setError('email', { message: errorMsg });
        } else if (errorMsg.toLowerCase().includes('national id')) {
          form.setError('national_id', { message: errorMsg });
        } else if (errorMsg.toLowerCase().includes('unit')) {
          form.setError('unit_id', { message: errorMsg });
        }
        
        toast({
          title: "Error",
          description: errorMsg,
          variant: "destructive",
        });
        throw new Error(errorMsg);
      }
      
      // For new tenant creation, verify tenant_id exists
      if (!attachToExisting && !rpcData.tenant_id) {
        console.error('Invalid response - no tenant_id:', rpcData);
        toast({
          title: "Error",
          description: "Failed to create tenant - invalid response from server",
          variant: "destructive",
        });
        throw new Error('Failed to create tenant - invalid response');
      }

      toast({
        title: "Success",
        description: attachToExisting 
          ? "New lease added to existing tenant successfully"
          : "Tenant added successfully",
      });

      logActivity?.("tenant_created", "tenants", rpcData?.tenant_id);
      
      handleOpenChange(false);
      onTenantAdded();
      form.reset();
      setExistingTenant(null);
      setShowConfirmDialog(false);
    } catch (error: any) {
      console.error("Error creating tenant:", error);
      const errorMessage = error?.message || "An unexpected error occurred";

      if (errorMessage.toLowerCase().includes("timeout")) {
        toast({
          title: "Request Timeout",
          description: "The operation is taking longer than expected. Please check if the tenant was created.",
          variant: "destructive",
        });
      } else if (errorMessage.toLowerCase().includes("email")) {
        form.setError("email", {
          type: "manual",
          message: "A tenant with this email already exists in your portfolio",
        });
        toast({
          title: "Duplicate Email",
          description: "This email is already registered to another tenant",
          variant: "destructive",
        });
      } else if (errorMessage.toLowerCase().includes("phone")) {
        form.setError("phone", {
          type: "manual",
          message: "A tenant with this phone number already exists in your portfolio",
        });
        toast({
          title: "Duplicate Phone",
          description: "This phone number is already registered to another tenant",
          variant: "destructive",
        });
      } else if (errorMessage.toLowerCase().includes("e.164") || errorMessage.toLowerCase().includes("phone must be")) {
        form.setError("phone", {
          type: "manual",
          message: "Phone must be in E.164 format (e.g., +254712345678)",
        });
        toast({
          title: "Invalid Phone Format",
          description: "Phone must be in E.164 format (e.g., +254712345678)",
          variant: "destructive",
        });
      } else if (errorMessage.toLowerCase().includes("national") || errorMessage.toLowerCase().includes("id number")) {
        form.setError("national_id", {
          type: "manual",
          message: "A tenant with this ID number already exists in your portfolio",
        });
        toast({
          title: "Duplicate ID",
          description: "This ID number is already registered to another tenant",
          variant: "destructive",
        });
      } else if (errorMessage.toLowerCase().includes("unit is already occupied")) {
        form.setError("unit_id", {
          type: "manual",
          message: "This unit is already occupied",
        });
        toast({
          title: "Unit Occupied",
          description: "This unit is already occupied. Please select a different unit.",
          variant: "destructive",
        });
      } else if (errorMessage.toLowerCase().includes("unit not found")) {
        form.setError("unit_id", {
          type: "manual",
          message: "Unit not found",
        });
        toast({
          title: "Unit Not Found",
          description: "The selected unit could not be found.",
          variant: "destructive",
        });
      } else if (errorMessage.toLowerCase().includes("permission") || errorMessage.toLowerCase().includes("do not have permission")) {
        toast({
          title: "Permission Denied",
          description: "You do not have permission to assign this unit.",
          variant: "destructive",
        });
      } else if (errorMessage.toLowerCase().includes("lease") && errorMessage.toLowerCase().includes("required")) {
        toast({
          title: "Missing Lease Details",
          description: errorMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAttachLease = async () => {
    const data = form.getValues();
    await createTenant(data, true);
  };

  const selectedUnit = units.find(u => u.id === form.watch("unit_id"));

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        {showTrigger && (
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Tenant
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Tenant</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic" className="relative">
                    Basic Info
                    {getTabErrors().basic > 0 && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive"></span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="lease" className="relative">
                    Lease Details
                    {getTabErrors().lease > 0 && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive"></span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="additional" className="relative">
                    Additional Info
                    {getTabErrors().additional > 0 && (
                      <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive"></span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="first_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="John" {...field} />
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
                          <FormLabel>Last Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email *</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="john@example.com" {...field} />
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
                          <FormLabel>Phone *</FormLabel>
                          <FormControl>
                            <Input placeholder="+254712345678" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="national_id"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>National ID / Passport *</FormLabel>
                          <FormControl>
                            <Input placeholder="12345678" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={() => setActiveTab("lease")}
                      variant="default"
                    >
                      Next: Lease Details
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="lease" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="property_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Property *</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              setSelectedProperty(value);
                              form.setValue("unit_id", "");
                            }}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select property" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {properties.map((property) => (
                                <SelectItem key={property.id} value={property.id}>
                                  {property.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {uniqueUnitTypes.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Filter by Unit Type</label>
                        <Select
                          value={unitTypeFilter}
                          onValueChange={setUnitTypeFilter}
                          disabled={!selectedProperty || units.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="All unit types" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Types ({units.length})</SelectItem>
                            {uniqueUnitTypes.map((type) => {
                              const count = units.filter(u => u.unit_type === type).length;
                              return (
                                <SelectItem key={type} value={type.toLowerCase()}>
                                  {type} ({count})
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="unit_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit * {filteredUnits.length > 0 && `(${filteredUnits.length} available)`}</FormLabel>
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              handleUnitChange(value);
                            }}
                            value={field.value}
                            disabled={!selectedProperty || filteredUnits.length === 0}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={filteredUnits.length === 0 ? "No vacant units" : "Select unit"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {filteredUnits.map((unit) => (
                                <SelectItem key={unit.id} value={unit.id}>
                                  {unit.unit_number} — {formatKES(unit.rent_amount)}/month
                                  {unit.unit_type && ` • ${unit.unit_type}`}
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
                      name="lease_start_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lease Start Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lease_end_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lease End Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="monthly_rent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Monthly Rent (KES) *</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="25000" {...field} />
                          </FormControl>
                          {selectedUnit?.rent_amount && (
                            <FormDescription className="text-xs">
                              Default: KES {selectedUnit.rent_amount.toLocaleString()} (can be adjusted)
                            </FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="security_deposit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Security Deposit (KES)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="25000" {...field} />
                          </FormControl>
                          {selectedUnit?.security_deposit && (
                            <FormDescription className="text-xs">
                              Default: KES {selectedUnit.security_deposit.toLocaleString()} (can be adjusted)
                            </FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-between">
                    <Button
                      type="button"
                      onClick={() => setActiveTab("basic")}
                      variant="outline"
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      onClick={() => setActiveTab("additional")}
                      variant="default"
                    >
                      Next: Additional Info (Optional)
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="additional" className="space-y-4 mt-4">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="employment">
                      <AccordionTrigger>Employment Information (Optional)</AccordionTrigger>
                      <AccordionContent className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="profession"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Profession</FormLabel>
                                <FormControl>
                                  <Input placeholder="Software Engineer" {...field} />
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
                                      <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="employed">Employed</SelectItem>
                                    <SelectItem value="self-employed">Self-Employed</SelectItem>
                                    <SelectItem value="unemployed">Unemployed</SelectItem>
                                    <SelectItem value="student">Student</SelectItem>
                                    <SelectItem value="retired">Retired</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="employer_name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Employer Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="Company XYZ" {...field} />
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
                                <FormLabel>Monthly Income (KES)</FormLabel>
                                <FormControl>
                                  <Input type="number" placeholder="50000" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="emergency">
                      <AccordionTrigger>Emergency Contact (Optional)</AccordionTrigger>
                      <AccordionContent className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="emergency_contact_name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Contact Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="Jane Doe" {...field} />
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
                                  <Input placeholder="+254712345678" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="address">
                      <AccordionTrigger>Previous Address (Optional)</AccordionTrigger>
                      <AccordionContent className="space-y-4 pt-4">
                        <FormField
                          control={form.control}
                          name="previous_address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Previous Address</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="123 Main Street, Nairobi"
                                  className="resize-none"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  <div className="flex justify-between pt-4">
                    <Button
                      type="button"
                      onClick={() => setActiveTab("lease")}
                      variant="outline"
                    >
                      Back
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add Tenant
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tenant Already Exists</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                A tenant with matching details already exists in your portfolio:
              </p>
              <div className="bg-muted p-3 rounded-md">
                <p className="font-medium">
                  {existingTenant?.first_name} {existingTenant?.last_name}
                </p>
                <p className="text-sm text-muted-foreground">{existingTenant?.email}</p>
                <p className="text-sm text-muted-foreground">{existingTenant?.phone}</p>
                {existingTenant?.national_id && (
                  <p className="text-sm text-muted-foreground">ID: {existingTenant.national_id}</p>
                )}
                <p className="text-sm text-muted-foreground mt-2">
                  Currently renting {existingTenant?.current_units || 0} unit(s)
                </p>
              </div>
              <p className="pt-2">
                Would you like to add a new lease to this existing tenant profile?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLoading(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAttachLease}>
              Yes, Add New Lease
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
