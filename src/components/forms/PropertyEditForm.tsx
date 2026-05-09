import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const propertySchema = z.object({
  name: z.string().min(1, "Property name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "County is required"),
  zip_code: z.string().min(1, "Postal code is required"),
  property_type: z.string().min(1, "Property type is required"),
  total_units: z.number().min(1, "Must have at least 1 unit"),
  description: z.string().optional(),
  amenities: z.array(z.string()).optional(),
});

type PropertyFormData = z.infer<typeof propertySchema>;

interface PropertyEditFormProps {
  property: {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
    property_type: string;
    total_units: number;
    description?: string;
    amenities?: string[];
  };
  onSave: (data: PropertyFormData) => void;
  onCancel: () => void;
}

export function PropertyEditForm({ property, onSave, onCancel }: PropertyEditFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [newAmenity, setNewAmenity] = useState("");
  
  const form = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      name: property.name,
      address: property.address,
      city: property.city,
      state: property.state,
      zip_code: property.zip_code,
      property_type: property.property_type,
      total_units: property.total_units,
      description: property.description || "",
      amenities: property.amenities || [],
    },
  });

  const handleSubmit = async (data: PropertyFormData) => {
    setIsLoading(true);
    try {
      await onSave(data);
      toast.success("Property updated successfully");
    } catch (error) {
      toast.error("Failed to update property");
    } finally {
      setIsLoading(false);
    }
  };

  const addAmenity = () => {
    if (newAmenity.trim()) {
      const currentAmenities = form.getValues("amenities") || [];
      form.setValue("amenities", [...currentAmenities, newAmenity.trim()]);
      setNewAmenity("");
    }
  };

  const removeAmenity = (index: number) => {
    const currentAmenities = form.getValues("amenities") || [];
    form.setValue("amenities", currentAmenities.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-modal-card rounded-xl shadow-sm border border-modal-edit-accent/10">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 p-6">
          {/* Basic Information */}
          <div className="bg-modal-input-bg/50 p-4 rounded-lg space-y-4 border border-modal-edit-accent/10">
            <h3 className="text-sm font-semibold text-modal-edit-accent">Basic Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-modal-label font-medium">Property Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter property name" {...field} className="bg-modal-input-bg border-modal-edit-accent/20 focus:border-modal-edit-accent focus:ring-modal-edit-accent/20" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="property_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-modal-label font-medium">Property Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-modal-input-bg border-modal-edit-accent/20 focus:border-modal-edit-accent focus:ring-modal-edit-accent/20">
                        <SelectValue placeholder="Select property type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="apartment">Apartment</SelectItem>
                      <SelectItem value="house">House</SelectItem>
                      <SelectItem value="condo">Condo</SelectItem>
                      <SelectItem value="townhouse">Townhouse</SelectItem>
                      <SelectItem value="commercial">Commercial</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="total_units"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-modal-label font-medium">Total Units</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="Enter total units" 
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    className="bg-modal-input-bg border-modal-edit-accent/20 focus:border-modal-edit-accent focus:ring-modal-edit-accent/20"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

          {/* Location */}
          <div className="bg-modal-input-bg/50 p-4 rounded-lg space-y-4 border border-modal-edit-accent/10">
            <h3 className="text-sm font-semibold text-modal-edit-accent">Location</h3>
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-modal-label font-medium">Address</FormLabel>
                <FormControl>
                  <Input placeholder="Enter property address" {...field} className="bg-modal-input-bg border-modal-edit-accent/20 focus:border-modal-edit-accent focus:ring-modal-edit-accent/20" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-modal-label font-medium">City</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter city" {...field} className="bg-modal-input-bg border-modal-edit-accent/20 focus:border-modal-edit-accent focus:ring-modal-edit-accent/20" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-modal-label font-medium">County</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter county" {...field} className="bg-modal-input-bg border-modal-edit-accent/20 focus:border-modal-edit-accent focus:ring-modal-edit-accent/20" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="zip_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-modal-label font-medium">Postal Code</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter postal code" {...field} className="bg-modal-input-bg border-modal-edit-accent/20 focus:border-modal-edit-accent focus:ring-modal-edit-accent/20" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

          {/* Description */}
          <div className="bg-modal-input-bg/50 p-4 rounded-lg space-y-4 border border-modal-edit-accent/10">
            <h3 className="text-sm font-semibold text-modal-edit-accent">Description</h3>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-modal-label font-medium">Property Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter property description"
                      className="min-h-[100px] bg-modal-input-bg border-modal-edit-accent/20 focus:border-modal-edit-accent focus:ring-modal-edit-accent/20 resize-none"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Amenities */}
          <div className="bg-modal-input-bg/50 p-4 rounded-lg space-y-4 border border-modal-edit-accent/10">
            <h3 className="text-sm font-semibold text-modal-edit-accent">Amenities</h3>
            <div className="flex gap-2">
              <Input
                placeholder="Add amenity"
                value={newAmenity}
                onChange={(e) => setNewAmenity(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAmenity())}
                className="bg-modal-input-bg border-modal-edit-accent/20 focus:border-modal-edit-accent focus:ring-modal-edit-accent/20"
              />
              <Button type="button" onClick={addAmenity} size="sm" className="bg-modal-edit-accent hover:bg-modal-edit-accent/90 text-white">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          <div className="flex flex-wrap gap-2">
            {(form.watch("amenities") || []).map((amenity, index) => (
              <Badge key={index} variant="secondary" className="flex items-center gap-1">
                {amenity}
                <button
                  type="button"
                  onClick={() => removeAmenity(index)}
                  className="hover:bg-destructive/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-modal-edit-accent/10">
            <Button type="button" variant="outline" onClick={onCancel} className="border-modal-edit-accent/20 text-modal-edit-accent hover:bg-modal-edit-accent/10">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-modal-edit-accent hover:bg-modal-edit-accent/90 text-white">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}