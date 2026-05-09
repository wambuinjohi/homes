import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UnitTypeSelect } from "@/components/ui/unit-type-select";
import { DynamicUnitSpecifications } from "@/components/forms/DynamicUnitSpecifications";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { isCommercialUnit } from "@/utils/unitSpecifications";
import { UnitCapGate } from "./UnitCapGate";
import { useAuth } from "@/hooks/useAuth";
import { checkDuplicateUnitNumber } from "@/utils/unitValidation";

interface Property {
  id: string;
  name: string;
  property_type: string;
}

interface UnitFormData {
  property_id: string;
  unit_number: string;
  unit_type: string;
  rent_amount: number;
  security_deposit?: number;
  water_deposit?: number;
  electricity_deposit?: number;
  garbage_deposit?: number;
  description?: string;
  amenities?: string[];
}

interface AddUnitDialogProps {
  onUnitAdded: () => void;
}

export function AddUnitDialog({ onUnitAdded }: AddUnitDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [unitSpecifications, setUnitSpecifications] = useState<Record<string, any>>({});
  const { toast } = useToast();
  const { user } = useAuth();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<UnitFormData>();

  const watchedPropertyId = watch("property_id");
  const selectedUnitType = watch('unit_type');
  const isCommercial = selectedUnitType && isCommercialUnit(selectedUnitType);

  useEffect(() => {
    fetchProperties();
  }, []);

  useEffect(() => {
    if (watchedPropertyId) {
      const property = properties.find(p => p.id === watchedPropertyId);
      setSelectedProperty(property || null);
    }
  }, [watchedPropertyId, properties]);

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
      toast({
        title: "Error",
        description: "Failed to fetch properties",
        variant: "destructive",
      });
    }
  };

  const handleSpecificationChange = (field: string, value: any) => {
    setUnitSpecifications(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const onSubmit = async (data: UnitFormData) => {
    const formatError = (e: any) => {
      try {
        if (!e) return 'Unknown error';
        if (typeof e === 'string') return e;
        const parts: string[] = [];
        if (e.message) parts.push(e.message);
        if (e.details) parts.push(e.details);
        if (e.hint) parts.push(`hint: ${e.hint}`);
        if (e.code) parts.push(`code: ${e.code}`);
        if (parts.length === 0) return JSON.stringify(e);
        return parts.join(' | ');
      } catch { return String(e); }
    };

    try {
      setLoading(true);

      // Validate required fields
      if (!data.property_id) {
        toast({ title: 'Property required', description: 'Please select a property.', variant: 'destructive' });
        return;
      }
      if (!data.unit_number) {
        toast({ title: 'Unit number required', description: 'Please enter a unit number.', variant: 'destructive' });
        return;
      }
      if (!data.unit_type) {
        toast({ title: 'Unit type required', description: 'Please select a unit type.', variant: 'destructive' });
        return;
      }

      // Check for duplicate unit number across all landlord properties
      if (user?.id) {
        const duplicateCheck = await checkDuplicateUnitNumber(data.unit_number, user.id);
        if (duplicateCheck.isDuplicate) {
          toast({
            title: 'Duplicate Unit Number',
            description: `Unit "${data.unit_number}" already exists in "${duplicateCheck.existingProperty}". Unit numbers must be unique across all your properties for payment matching.`,
            variant: 'destructive',
          });
          return;
        }
      }

      // Build payload restricted to columns that exist in the units table schema
      const specs = unitSpecifications || {};
      const payload: any = {
        property_id: data.property_id,
        unit_number: data.unit_number,
        unit_type: data.unit_type,
        rent_amount: Number(data.rent_amount),
        security_deposit: data.security_deposit != null ? Number(data.security_deposit) : null,
        description: data.description || null,
        amenities: Array.isArray(data.amenities) ? data.amenities : null,
        status: 'vacant',
      };
      // Optional numeric specs supported by schema
      if (specs.bedrooms != null) payload.bedrooms = Number(specs.bedrooms);
      if (specs.bathrooms != null) payload.bathrooms = Number(specs.bathrooms);
      if (specs.square_feet != null) payload.square_feet = Number(specs.square_feet);
      if (specs.block_id) payload.block_id = String(specs.block_id);

      const { error } = await supabase
        .from('units')
        .insert([payload]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Unit added successfully",
      });

      reset();
      setUnitSpecifications({});
      setOpen(false);
      onUnitAdded();
    } catch (error: any) {
      const msg = formatError(error);
      console.error('Error adding unit:', msg, error);
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <UnitCapGate action="create">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Unit
          </Button>
        </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Unit</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <Label htmlFor="property_id">Property <span className="text-destructive ml-1">*</span></Label>
            <Select
              value={watch("property_id")}
              onValueChange={(value) => setValue("property_id", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a property" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.property_id && (
              <p className="text-sm text-destructive mt-1">Property is required</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="unit_number">Unit Number <span className="text-destructive ml-1">*</span></Label>
              <Input
                id="unit_number"
                {...register('unit_number', { required: 'Unit number is required' })}
                placeholder="e.g., 101, A-1"
                className={errors.unit_number ? 'border-destructive' : ''}
              />
              {errors.unit_number && (
                <p className="text-sm text-destructive mt-1">{errors.unit_number.message}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="unit_type">Unit Type <span className="text-destructive ml-1">*</span></Label>
              <UnitTypeSelect
                value={watch('unit_type')}
                onValueChange={(value) => setValue('unit_type', value)}
              />
              {errors.unit_type && (
                <p className="text-sm text-destructive mt-1">{errors.unit_type.message}</p>
              )}
            </div>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="rent_amount">Monthly Rent <span className="text-destructive ml-1">*</span></Label>
              <Input
                id="rent_amount"
                type="number"
                step="0.01"
                {...register('rent_amount', { required: 'Monthly rent is required' })}
                placeholder="0.00"
                className={errors.rent_amount ? 'border-destructive' : ''}
              />
              {errors.rent_amount && (
                <p className="text-sm text-destructive mt-1">{errors.rent_amount.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="security_deposit">Security Deposit</Label>
              <Input
                id="security_deposit"
                type="number"
                step="0.01"
                {...register('security_deposit')}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="water_deposit">Water Deposit</Label>
              <Input
                id="water_deposit"
                type="number"
                step="0.01"
                {...register('water_deposit')}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="electricity_deposit">Electricity Deposit</Label>
              <Input
                id="electricity_deposit"
                type="number"
                step="0.01"
                {...register('electricity_deposit')}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="garbage_deposit">Garbage Deposit</Label>
              <Input
                id="garbage_deposit"
                type="number"
                step="0.01"
                {...register('garbage_deposit')}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Additional details about the unit..."
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Unit"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                reset();
                setUnitSpecifications({});
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    </UnitCapGate>
  );
}
