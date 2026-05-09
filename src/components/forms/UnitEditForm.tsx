import { useForm } from "react-hook-form";
import { getGlobalCurrencySync } from "@/utils/currency";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { UnitTypeSelect } from "@/components/ui/unit-type-select";
import { DynamicUnitSpecifications } from "@/components/forms/DynamicUnitSpecifications";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { isCommercialUnit } from "@/utils/unitSpecifications";
import { useAuth } from "@/hooks/useAuth";
import { checkDuplicateUnitNumber } from "@/utils/unitValidation";

const unitSchema = z.object({
  unit_number: z.string().min(1, "Unit number is required"),
  unit_type: z.string().min(1, "Unit type is required"),
  rent_amount: z.number().min(1, "Rent amount is required"),
  security_deposit: z.number().optional(),
  status: z.string().optional(), // Optional since occupancy is auto-calculated
  description: z.string().optional(),
});

type UnitFormData = z.infer<typeof unitSchema>;

interface UnitEditFormProps {
  unit: {
    id: string;
    unit_number: string;
    unit_type: string;
    bedrooms?: number;
    bathrooms?: number;
    square_feet?: number;
    floor_area?: number;
    office_spaces?: number;
    rent_amount: number;
    security_deposit?: number;
    status: string;
    description?: string;
    [key: string]: any; // Allow other dynamic fields
  };
  onSave: (data: any) => void;
  onCancel: () => void;
}

export function UnitEditForm({ unit, onSave, onCancel }: UnitEditFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const [unitSpecifications, setUnitSpecifications] = useState<Record<string, any>>(() => {
    // Initialize with existing unit data
    const specs: Record<string, any> = {};
    ['bedrooms', 'bathrooms', 'square_feet', 'floor_area', 'office_spaces', 'conference_rooms', 'parking_spaces', 'loading_docks'].forEach(key => {
      if (unit[key] !== undefined) {
        specs[key] = unit[key];
      }
    });
    return specs;
  });
  
  const form = useForm<UnitFormData>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      unit_number: unit.unit_number,
      unit_type: unit.unit_type,
      rent_amount: unit.rent_amount,
      security_deposit: unit.security_deposit || 0,
      status: unit.status === 'maintenance' ? 'maintenance' : 'normal',
      description: unit.description || "",
    },
  });

  const selectedUnitType = form.watch('unit_type');
  const isCommercial = selectedUnitType && isCommercialUnit(selectedUnitType);

  const handleSpecificationChange = (field: string, value: any) => {
    setUnitSpecifications(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const onSubmit = async (data: UnitFormData) => {
    setIsLoading(true);
    try {
      // Check for duplicate unit number if it changed
      if (user?.id && data.unit_number !== unit.unit_number) {
        const duplicateCheck = await checkDuplicateUnitNumber(
          data.unit_number,
          user.id,
          unit.id // Exclude current unit
        );
        if (duplicateCheck.isDuplicate) {
          toast.error(
            `Unit "${data.unit_number}" already exists in "${duplicateCheck.existingProperty}". Unit numbers must be unique across all your properties.`
          );
          setIsLoading(false);
          return;
        }
      }

      // Handle status updates: 
      // - Set to 'maintenance' when explicitly requested
      // - Set to 'vacant' when returning from maintenance (DB will update to 'occupied' if active lease exists)
      const finalStatus = data.status === 'maintenance' ? 'maintenance' : 'vacant';
      
      // Combine form data with unit specifications
      const combinedData = {
        ...data,
        status: finalStatus,
        ...unitSpecifications,
      };
      
      await onSave(combinedData);
      toast.success("Unit updated successfully");
    } catch (error) {
      console.error("Failed to update unit:", error);
      toast.error("Failed to update unit");
    } finally {
      setIsLoading(false);
    }
  };

  const currency = getGlobalCurrencySync();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Edit Unit</h2>
        {isCommercial && <Badge variant="secondary">Commercial Unit</Badge>}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="unit_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit Number <span className="text-destructive ml-1">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 101" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="unit_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit Type <span className="text-destructive ml-1">*</span></FormLabel>
                  <FormControl>
                    <UnitTypeSelect
                      value={field.value}
                      onValueChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Dynamic Unit Specifications */}
          {selectedUnitType && (
            <div>
              <Label className="text-base font-medium">
                {isCommercial ? 'Commercial' : 'Residential'} Specifications
                {isCommercial && <Badge variant="secondary" className="ml-2">Commercial</Badge>}
              </Label>
              <div className="mt-3">
                <DynamicUnitSpecifications
                  unitType={selectedUnitType}
                  values={unitSpecifications}
                  onChange={handleSpecificationChange}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="rent_amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Rent ({currency})</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="security_deposit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Security Deposit ({currency})</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Occupancy Status</Label>
              <div className="mt-2 p-3 bg-secondary/30 rounded-md border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Occupancy is automatically determined from active leases
                  </span>
                  <Badge 
                    className={
                      unit.status === 'occupied' ? 'bg-success text-success-foreground' : 
                      unit.status === 'vacant' ? 'bg-accent text-accent-foreground' : 
                      'bg-warning text-warning-foreground'
                    }
                  >
                    {unit.status === 'occupied' ? 'Occupied' : 
                     unit.status === 'vacant' ? 'Vacant' : 
                     'Maintenance'}
                  </Badge>
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Maintenance Status</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={unit.status === 'maintenance' ? 'maintenance' : 'normal'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select maintenance status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="normal">Normal Operation</SelectItem>
                      <SelectItem value="maintenance">Under Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Additional details about the unit..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}