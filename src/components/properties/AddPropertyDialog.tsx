
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { propertySchema, validateAndSanitizeFormData } from "@/utils/validation";

interface PropertyFormData {
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country?: string;
  property_type: string;
  total_units: number;
  description?: string;
  amenities?: string[];
}

interface AddPropertyDialogProps {
  onPropertyAdded: () => void;
}

export function AddPropertyDialog({ onPropertyAdded }: AddPropertyDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<PropertyFormData>();

  const onSubmit = async (data: PropertyFormData) => {
    setLoading(true);
    try {
      // Validate and sanitize input data
      const dataWithDefaults = { ...data, country: "Kenya" };
      const validation = validateAndSanitizeFormData(propertySchema, dataWithDefaults);
      if (!validation.success) {
        toast({
          title: "Validation Error",
          description: validation.errors?.join(", ") || "Invalid input data",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Database trigger will automatically set owner_id to auth.uid()
      const { error } = await supabase
        .from("properties")
        .insert([validation.data as any]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Property added successfully",
      });

      reset();
      setOpen(false);
      onPropertyAdded();
    } catch (error) {
      console.error("Error adding property:", error);
      toast({
        title: "Error",
        description: "Failed to add property",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Add Property
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-semibold">Add New Property</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg border border-slate-200 dark:border-slate-700 space-y-4">
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600 pb-2">
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Property Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="name"
                  className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 focus:border-primary focus:ring-primary"
                  {...register("name", { required: "Property name is required" })}
                  placeholder="e.g., Sunset Apartments"
                />
                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="property_type" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Property Type <span className="text-red-500">*</span>
                </Label>
                <Select onValueChange={(value) => setValue("property_type", value)}>
                  <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 focus:border-primary focus:ring-primary">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Apartment">Apartment Building</SelectItem>
                    <SelectItem value="House">Gated Community</SelectItem>
                    <SelectItem value="Condo">Condominium</SelectItem>
                    <SelectItem value="Townhouse">Townhouse Complex</SelectItem>
                    <SelectItem value="Commercial">Commercial Building</SelectItem>
                    <SelectItem value="Mixed-use">Mixed-use Development</SelectItem>
                  </SelectContent>
                </Select>
                {errors.property_type && <p className="text-xs text-red-500">Property type is required</p>}
              </div>
            </div>
          </div>

          {/* Location Details */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg border border-slate-200 dark:border-slate-700 space-y-4">
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600 pb-2">
              Location Details
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Street Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="address"
                  className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 focus:border-primary focus:ring-primary"
                  {...register("address", { required: "Address is required" })}
                  placeholder="123 Main Street, Westlands"
                />
                {errors.address && <p className="text-xs text-red-500">{errors.address.message}</p>}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    City <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="city"
                    className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 focus:border-primary focus:ring-primary"
                    {...register("city", { required: "City is required" })}
                    placeholder="Nairobi"
                  />
                  {errors.city && <p className="text-xs text-red-500">{errors.city.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    County <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="state"
                    className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 focus:border-primary focus:ring-primary"
                    {...register("state", { required: "County is required" })}
                    placeholder="Nairobi County"
                  />
                  {errors.state && <p className="text-xs text-red-500">{errors.state.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip_code" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Postal Code <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="zip_code"
                    className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 focus:border-primary focus:ring-primary"
                    {...register("zip_code", { required: "Postal code is required" })}
                    placeholder="00100"
                  />
                  {errors.zip_code && <p className="text-xs text-red-500">{errors.zip_code.message}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Property Details */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg border border-slate-200 dark:border-slate-700 space-y-4">
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600 pb-2">
              Property Details
            </h3>
            <div className="space-y-2">
              <Label htmlFor="total_units" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Total Units <span className="text-red-500">*</span>
              </Label>
              <Input
                id="total_units"
                type="number"
                className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 focus:border-primary focus:ring-primary"
                {...register("total_units", { required: "Total units is required", min: 1 })}
                placeholder="10"
              />
              {errors.total_units && <p className="text-xs text-red-500">{errors.total_units.message}</p>}
            </div>
          </div>

          {/* Additional Information */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg border border-slate-200 dark:border-slate-700 space-y-4">
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-600 pb-2">
              Additional Information
            </h3>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Description <span className="text-slate-500">(Optional)</span>
              </Label>
              <Textarea
                id="description"
                className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 focus:border-primary focus:ring-primary"
                {...register("description")}
                placeholder="Property description, amenities, nearby facilities..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90">
              {loading ? "Adding..." : "Add Property"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
