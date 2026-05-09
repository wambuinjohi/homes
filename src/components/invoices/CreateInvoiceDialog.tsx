import { useState } from "react";
import { getGlobalCurrencySync } from "@/utils/currency";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const formSchema = z.object({
  lease_id: z.string().min(1, "Please select a lease"),
  amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    "Amount must be a positive number"
  ),
  due_date: z.date({
    required_error: "Due date is required",
  }),
  description: z.string().optional(),
});

interface CreateInvoiceDialogProps {
  onInvoiceCreated?: () => void;
}

export const CreateInvoiceDialog = ({ onInvoiceCreated }: CreateInvoiceDialogProps) => {
  const [open, setOpen] = useState(false);
  const [leases, setLeases] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      lease_id: "",
      amount: "",
      description: "",
    },
  });

  const fetchLeases = async () => {
    try {
      console.log("Fetching leases...");
      
      // Fetch leases separately 
      const { data: leasesData, error: leasesError } = await supabase
        .from("leases")
        .select("id, monthly_rent, tenant_id, unit_id, status")
        .in("status", ["active", "current"])
        .order('created_at', { ascending: false });

      if (leasesError) {
        console.error("Error fetching leases:", leasesError);
        throw leasesError;
      }

      if (!leasesData || leasesData.length === 0) {
        console.log("No leases found");
        setLeases([]);
        return;
      }

      console.log("Found leases:", leasesData.length);

      // Extract unique IDs
      const tenantIds = [...new Set(leasesData.map(l => l.tenant_id).filter(Boolean))];
      const unitIds = [...new Set(leasesData.map(l => l.unit_id).filter(Boolean))];

      // Fetch tenants
      const { data: tenantsData, error: tenantsError } = await supabase
        .from("tenants")
        .select("id, first_name, last_name")
        .in("id", tenantIds);

      if (tenantsError) {
        console.error("Error fetching tenants:", tenantsError);
        throw tenantsError;
      }

      // Fetch units
      const { data: unitsData, error: unitsError } = await supabase
        .from("units")
        .select("id, unit_number, property_id")
        .in("id", unitIds);

      if (unitsError) {
        console.error("Error fetching units:", unitsError);
        throw unitsError;
      }

      // Extract property IDs and fetch properties
      const propertyIds = [...new Set(unitsData?.map(u => u.property_id).filter(Boolean) || [])];
      const { data: propertiesData, error: propertiesError } = await supabase
        .from("properties")
        .select("id, name, owner_id")
        .in("id", propertyIds);

      if (propertiesError) {
        console.error("Error fetching properties:", propertiesError);
        throw propertiesError;
      }

      // Create lookup maps
      const tenantsMap = new Map(tenantsData?.map(t => [t.id, t]) || []);
      const unitsMap = new Map(unitsData?.map(u => [u.id, u]) || []);
      const propertiesMap = new Map(propertiesData?.map(p => [p.id, p]) || []);

      // Compose the data
      const composedLeases = leasesData.map(lease => {
        const tenant = tenantsMap.get(lease.tenant_id);
        const unit = unitsMap.get(lease.unit_id);
        const property = unit ? propertiesMap.get(unit.property_id) : null;

        return {
          ...lease,
          tenants: tenant,
          units: unit ? {
            ...unit,
            properties: property
          } : null
        };
      });

      console.log("Composed leases:", composedLeases.length);
      setLeases(composedLeases);
    } catch (error) {
      console.error("Error fetching leases:", error);
      toast.error("Failed to load leases. Please check console for details.");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      fetchLeases();
    } else {
      form.reset();
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    try {
      const selectedLease = leases.find(lease => lease.id === values.lease_id);
      if (!selectedLease) {
        toast.error("Selected lease not found");
        return;
      }

      // Determine landlord: prefer property owner if available, otherwise current user
      const landlordId = selectedLease?.units?.properties?.owner_id || user?.id;
      if (!landlordId) {
        toast.error("Unable to determine landlord for the selected lease. Please contact support.");
        return;
      }

      // Insert invoice. Some deployments don't have a landlord_id column on invoices; rely on lease->unit->property mapping for RLS.
      const insertPayload: any = {
        lease_id: values.lease_id,
        tenant_id: selectedLease.tenant_id,
        amount: Number(values.amount),
        due_date: format(values.due_date, "yyyy-MM-dd"),
        invoice_date: format(new Date(), "yyyy-MM-dd"),
        description: values.description || `Monthly rent - ${format(new Date(), "MMMM yyyy")}`,
        status: "pending"
      };

      // If the invoices table includes landlord_id (some schemas), include it; otherwise skip
      try {
        const { data: colInfo } = await (supabase as any).rpc('get_table_columns', { p_table_name: 'invoices' }).catch(() => ({ data: null }));
        const hasLandlordCol = Array.isArray(colInfo) && colInfo.some((c: any) => c.column_name === 'landlord_id');
        if (hasLandlordCol) insertPayload.landlord_id = landlordId;
      } catch (e) {
        // ignore - fallback to not including landlord_id
      }

      const { data: insertResult, error } = await supabase
        .from("invoices")
        .insert(insertPayload)
        .select('*');

      if (error) {
        console.error('Client-side insert error:', error);
        // If it's an RLS/permission issue, attempt server-side creation as a fallback for debugging
        const msg = (error?.message || '').toLowerCase();
        if (msg.includes('permission') || msg.includes('policy') || msg.includes('rls')) {
          try {
            const resp = await fetch('/api/invoices/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lease_id: values.lease_id, tenant_id: selectedLease.tenant_id, amount: Number(values.amount), due_date: format(values.due_date, 'yyyy-MM-dd'), description: values.description })
            });
            const body = await resp.json();
            if (!resp.ok) throw body;
            toast.success('Invoice created server-side (debug)');
            setOpen(false);
            form.reset();
            onInvoiceCreated?.();
            return;
          } catch (srvErr) {
            console.error('Server-side invoice creation failed:', srvErr);
            toast.error('Failed to create invoice (server fallback)');
            throw error;
          }
        }

        throw error;
      }

      toast.success("Invoice created successfully!");
      setOpen(false);
      form.reset();
      onInvoiceCreated?.();
    } catch (error: any) {
      console.error("Error creating invoice:", error);
      const message = error?.message || error?.error || (typeof error === 'string' ? error : JSON.stringify(error));
      const detail = error?.details || error?.hint || null;
      toast.error(message || "Failed to create invoice");
      if (detail) console.error("Invoice creation detail:", detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange} modal={false}>
      <DialogTrigger asChild>
        <Button className="bg-accent hover:bg-accent/90">
          <Plus className="h-4 w-4 mr-2" />
          Create Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Invoice</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="lease_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lease</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      // Auto-fill amount from selected lease
                      const selectedLease = leases.find(l => l.id === value);
                      if (selectedLease) {
                        form.setValue("amount", selectedLease.monthly_rent.toString());
                      }
                    }} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a lease" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {leases.map((lease) => (
                        <SelectItem key={lease.id} value={lease.id}>
                          {lease.tenants?.first_name} {lease.tenants?.last_name} - {lease.units?.properties?.name} ({lease.units?.unit_number}) - {getGlobalCurrencySync()} {lease.monthly_rent}
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
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount ({getGlobalCurrencySync()})</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter amount"
                      type="number"
                      step="0.01"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Due Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date < new Date()
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter invoice description"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Invoice"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
