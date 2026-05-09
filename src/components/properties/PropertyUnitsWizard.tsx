import React, { useState } from "react";
import { getGlobalCurrencySync, formatAmount } from "@/utils/currency";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ArrowRight, ArrowLeft, Check, Trash2, Building2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { propertySchema, unitSchema, validateAndSanitizeFormData } from "@/utils/validation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { checkDuplicateUnitNumbers } from "@/utils/unitValidation";

interface PropertyFormData {
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  country?: string;
  property_type: string;
  description?: string;
  amenities?: string[];
}

interface UnitFormData {
  unit_number: string;
  unit_type: string;
  bedrooms: number;
  bathrooms: number;
  square_feet?: number;
  rent_amount: number;
  security_deposit?: number;
  description?: string;
}

interface PropertyUnitsWizardProps {
  onPropertyAdded: () => void;
}

export function PropertyUnitsWizard({ onPropertyAdded }: PropertyUnitsWizardProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"property" | "units" | "review">("property");
  const [propertyData, setPropertyData] = useState<PropertyFormData | null>(null);
  const [units, setUnits] = useState<UnitFormData[]>([]);
  const [editingUnit, setEditingUnit] = useState<number | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const propertyForm = useForm<PropertyFormData>();
  const unitForm = useForm<UnitFormData>();

  const getUnitTypes = (propertyType: string) => {
    switch (propertyType) {
      case "Apartment":
        return ["Studio", "1-Bedroom", "2-Bedroom", "3-Bedroom", "Penthouse"];
      case "House":
        return ["Maisonette", "Bungalow", "Villa", "Townhouse"];
      case "Condo":
        return ["Studio", "1-Bedroom", "2-Bedroom", "3-Bedroom", "Penthouse"];
      case "Townhouse":
        return ["2-Bedroom Townhouse", "3-Bedroom Townhouse", "4-Bedroom Townhouse"];
      case "Commercial":
        return ["Office Space", "Retail Unit", "Warehouse", "Conference Room"];
      case "Mixed-use":
        return ["Residential Unit", "Commercial Space", "Office Suite"];
      default:
        return ["Standard Unit"];
    }
  };

  const handlePropertySubmit = (data: PropertyFormData) => {
    const dataWithDefaults = { ...data, country: "Kenya" };
    const validation = validateAndSanitizeFormData(propertySchema, dataWithDefaults);
    
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.errors?.join(", ") || "Invalid property data",
        variant: "destructive",
      });
      return;
    }

    setPropertyData(validation.data as PropertyFormData);
    setStep("units");
  };

  const handleAddUnit = (data: UnitFormData) => {
    // Clean up NaN values for all number fields
    const cleanedData = {
      ...data,
      bedrooms: isNaN(data.bedrooms as any) ? 0 : Number(data.bedrooms),
      bathrooms: isNaN(data.bathrooms as any) ? 0 : Number(data.bathrooms),
      rent_amount: isNaN(data.rent_amount as any) ? 0 : Number(data.rent_amount),
      square_feet: isNaN(data.square_feet as any) ? undefined : data.square_feet,
      security_deposit: isNaN(data.security_deposit as any) ? undefined : data.security_deposit,
    };
    
    const validation = validateAndSanitizeFormData(unitSchema, cleanedData);
    
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.errors?.join(", ") || "Invalid unit data",
        variant: "destructive",
      });
      return;
    }

    if (editingUnit !== null) {
      const updatedUnits = [...units];
      updatedUnits[editingUnit] = validation.data as UnitFormData;
      setUnits(updatedUnits);
      setEditingUnit(null);
    } else {
      setUnits([...units, validation.data as UnitFormData]);
    }
    
    unitForm.reset();
    toast({
      title: "Success",
      description: editingUnit !== null ? "Unit updated" : "Unit added",
    });
  };

  const editUnit = (index: number) => {
    const unit = units[index];
    unitForm.reset(unit);
    setEditingUnit(index);
  };

  const removeUnit = (index: number) => {
    setUnits(units.filter((_, i) => i !== index));
    if (editingUnit === index) {
      setEditingUnit(null);
      unitForm.reset();
    }
  };

  const handleFinalSubmit = async () => {
    if (!propertyData) return;

    setLoading(true);
    try {
      // Check for duplicate unit numbers across all landlord properties before creating
      if (user?.id && units.length > 0) {
        const unitNumbers = units.map(u => u.unit_number);
        const duplicateChecks = await checkDuplicateUnitNumbers(unitNumbers, user.id);
        
        const duplicates = Array.from(duplicateChecks.entries())
          .filter(([, result]) => result.isDuplicate)
          .map(([num, result]) => `"${num}" (in ${result.existingProperty})`);

        if (duplicates.length > 0) {
          toast({
            title: "Duplicate Unit Numbers",
            description: `The following unit numbers already exist: ${duplicates.join(", ")}`,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      // Insert property first
      const { data: property, error: propertyError } = await supabase
        .from("properties")
        .insert([propertyData])
        .select()
        .single();

      if (propertyError) throw propertyError;

      // Insert units if any
      if (units.length > 0) {
        const unitsWithPropertyId = units.map(unit => ({
          ...unit,
          property_id: property.id,
          status: 'vacant' as const
        }));

        const { error: unitsError } = await supabase
          .from("units")
          .insert(unitsWithPropertyId);

        if (unitsError) throw unitsError;
      }

      toast({
        title: "Success",
        description: `Property "${propertyData.name}" created successfully with ${units.length} units`,
      });

      // Reset all state
      setPropertyData(null);
      setUnits([]);
      setStep("property");
      propertyForm.reset();
      unitForm.reset();
      setOpen(false);
      onPropertyAdded();
    } catch (error) {
      console.error("Error creating property:", error);
      toast({
        title: "Error",
        description: "Failed to create property",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderPropertyStep = () => (
    <form onSubmit={propertyForm.handleSubmit(handlePropertySubmit)} className="space-y-6">
      {/* Basic Information */}
      <div className="bg-tint-gray p-6 rounded-lg border border-border space-y-4">
        <h3 className="text-base font-semibold text-primary border-b border-border pb-2">
          Basic Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium text-foreground">
              Property Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              className="bg-background border-input"
              {...propertyForm.register("name", { required: "Property name is required" })}
              placeholder="e.g., Sunset Apartments"
            />
            {propertyForm.formState.errors.name && (
              <p className="text-xs text-destructive">{propertyForm.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="property_type" className="text-sm font-medium text-foreground">
              Property Type <span className="text-destructive">*</span>
            </Label>
            <Select onValueChange={(value) => propertyForm.setValue("property_type", value)}>
              <SelectTrigger className="bg-background border-input">
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
            {propertyForm.formState.errors.property_type && (
              <p className="text-xs text-destructive">Property type is required</p>
            )}
          </div>
        </div>
      </div>

      {/* Location Details */}
      <div className="bg-tint-gray p-6 rounded-lg border border-border space-y-4">
        <h3 className="text-base font-semibold text-primary border-b border-border pb-2">
          Location Details
        </h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address" className="text-sm font-medium text-foreground">
              Street Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="address"
              className="bg-background border-input"
              {...propertyForm.register("address", { required: "Address is required" })}
              placeholder="123 Main Street, Westlands"
            />
            {propertyForm.formState.errors.address && (
              <p className="text-xs text-destructive">{propertyForm.formState.errors.address.message}</p>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city" className="text-sm font-medium text-foreground">
                City <span className="text-destructive">*</span>
              </Label>
              <Input
                id="city"
                className="bg-background border-input"
                {...propertyForm.register("city", { required: "City is required" })}
                placeholder="Nairobi"
              />
              {propertyForm.formState.errors.city && (
                <p className="text-xs text-destructive">{propertyForm.formState.errors.city.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="state" className="text-sm font-medium text-foreground">
                County <span className="text-destructive">*</span>
              </Label>
              <Input
                id="state"
                className="bg-background border-input"
                {...propertyForm.register("state", { required: "County is required" })}
                placeholder="Nairobi County"
              />
              {propertyForm.formState.errors.state && (
                <p className="text-xs text-destructive">{propertyForm.formState.errors.state.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip_code" className="text-sm font-medium text-foreground">
                Postal Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="zip_code"
                className="bg-background border-input"
                {...propertyForm.register("zip_code", { required: "Postal code is required" })}
                placeholder="00100"
              />
              {propertyForm.formState.errors.zip_code && (
                <p className="text-xs text-destructive">{propertyForm.formState.errors.zip_code.message}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Additional Information */}
      <div className="bg-tint-gray p-6 rounded-lg border border-border space-y-4">
        <h3 className="text-base font-semibold text-primary border-b border-border pb-2">
          Additional Information
        </h3>
        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-medium text-foreground">
            Description <span className="text-muted-foreground">(Optional)</span>
          </Label>
          <Textarea
            id="description"
            className="bg-background border-input"
            {...propertyForm.register("description")}
            placeholder="Property description, amenities, nearby facilities..."
            rows={3}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t border-border">
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" className="bg-primary hover:bg-primary/90">
          Next: Add Units
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </form>
  );

  const renderUnitsStep = () => (
    <div className="space-y-6">
      <Tabs defaultValue="add" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="add">Add Unit</TabsTrigger>
          <TabsTrigger value="list">Units List ({units.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="add" className="space-y-6">
          <form onSubmit={unitForm.handleSubmit(handleAddUnit)} className="space-y-6">
            {/* Basic Unit Information */}
            <div className="bg-tint-gray p-6 rounded-lg border border-border space-y-4">
              <h3 className="text-base font-semibold text-primary border-b border-border pb-2">
                Unit Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit_number" className="text-sm font-medium text-foreground">
                    Unit Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="unit_number"
                    className="bg-background border-input"
                    {...unitForm.register("unit_number", { required: "Unit number is required" })}
                    placeholder="A101"
                  />
                  {unitForm.formState.errors.unit_number && (
                    <p className="text-xs text-destructive">{unitForm.formState.errors.unit_number.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit_type" className="text-sm font-medium text-foreground">
                    Unit Type <span className="text-destructive">*</span>
                  </Label>
                  <Select onValueChange={(value) => unitForm.setValue("unit_type", value)}>
                    <SelectTrigger className="bg-background border-input">
                      <SelectValue placeholder="Select unit type" />
                    </SelectTrigger>
                    <SelectContent>
                      {propertyData && getUnitTypes(propertyData.property_type).map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {unitForm.formState.errors.unit_type && (
                    <p className="text-xs text-destructive">Unit type is required</p>
                  )}
                </div>
              </div>
            </div>

            {/* Unit Specifications */}
            <div className="bg-tint-gray p-6 rounded-lg border border-border space-y-4">
              <h3 className="text-base font-semibold text-primary border-b border-border pb-2">
                Specifications
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bedrooms" className="text-sm font-medium text-foreground">
                    Bedrooms <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="bedrooms"
                    type="number"
                    className="bg-background border-input"
                    {...unitForm.register("bedrooms", { required: "Bedrooms required", valueAsNumber: true, min: 0 })}
                    placeholder="2"
                  />
                  {unitForm.formState.errors.bedrooms && (
                    <p className="text-xs text-destructive">{unitForm.formState.errors.bedrooms.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bathrooms" className="text-sm font-medium text-foreground">
                    Bathrooms <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="bathrooms"
                    type="number"
                    step="0.5"
                    className="bg-background border-input"
                    {...unitForm.register("bathrooms", { required: "Bathrooms required", valueAsNumber: true, min: 0 })}
                    placeholder="1"
                  />
                  {unitForm.formState.errors.bathrooms && (
                    <p className="text-xs text-destructive">{unitForm.formState.errors.bathrooms.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="square_feet" className="text-sm font-medium text-foreground">
                    Square Feet <span className="text-muted-foreground">(Optional)</span>
                  </Label>
                  <Input
                    id="square_feet"
                    type="number"
                    className="bg-background border-input"
                    {...unitForm.register("square_feet", { valueAsNumber: true })}
                    placeholder="800"
                  />
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-tint-gray p-6 rounded-lg border border-border space-y-4">
              <h3 className="text-base font-semibold text-primary border-b border-border pb-2">
                Pricing
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rent_amount" className="text-sm font-medium text-foreground">
                    Monthly Rent ({getGlobalCurrencySync()}) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="rent_amount"
                    type="number"
                    className="bg-background border-input"
                    {...unitForm.register("rent_amount", { required: "Rent amount required", valueAsNumber: true, min: 0 })}
                    placeholder="25000"
                  />
                  {unitForm.formState.errors.rent_amount && (
                    <p className="text-xs text-destructive">{unitForm.formState.errors.rent_amount.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="security_deposit" className="text-sm font-medium text-foreground">
                    Security Deposit ({getGlobalCurrencySync()}) <span className="text-muted-foreground">(Optional)</span>
                  </Label>
                  <Input
                    id="security_deposit"
                    type="number"
                    className="bg-background border-input"
                    {...unitForm.register("security_deposit", { valueAsNumber: true })}
                    placeholder="25000"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit_description" className="text-sm font-medium text-foreground">
                Unit Description <span className="text-muted-foreground">(Optional)</span>
              </Label>
              <Textarea
                id="unit_description"
                className="bg-background border-input"
                {...unitForm.register("description")}
                placeholder="Unit features, condition, special notes..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => {
                unitForm.reset();
                setEditingUnit(null);
              }}>
                {editingUnit !== null ? "Cancel Edit" : "Clear Form"}
              </Button>
              <Button type="submit" className="bg-accent hover:bg-accent/90">
                {editingUnit !== null ? "Update Unit" : "Add Unit"}
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
          {units.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No units added yet</p>
              <p className="text-sm text-muted-foreground">Switch to "Add Unit" tab to create your first unit</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {units.map((unit, index) => (
                <Card key={index} className="bg-background">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">{unit.unit_number}</CardTitle>
                        <p className="text-sm text-muted-foreground">{unit.unit_type}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => editUnit(index)}>
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => removeUnit(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Bedrooms:</span>
                        <p className="font-medium">{unit.bedrooms}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Bathrooms:</span>
                        <p className="font-medium">{unit.bathrooms}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Rent:</span>
                        <p className="font-medium">{formatAmount(unit.rent_amount)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Deposit:</span>
                        <p className="font-medium">{unit.security_deposit ? formatAmount(unit.security_deposit) : 'N/A'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex justify-between gap-3 pt-6 border-t border-border">
        <Button type="button" variant="outline" onClick={() => setStep("property")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Property
        </Button>
        <Button onClick={() => setStep("review")} className="bg-primary hover:bg-primary/90">
          Review & Create
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-6">
      {/* Property Summary */}
      <Card className="bg-background">
        <CardHeader>
          <CardTitle className="text-primary">Property Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {propertyData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-foreground">{propertyData.name}</h4>
                <p className="text-sm text-muted-foreground">{propertyData.property_type}</p>
                <p className="text-sm text-muted-foreground">
                  {propertyData.address}, {propertyData.city}, {propertyData.state}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {units.length} {units.length === 1 ? 'Unit' : 'Units'}
                </Badge>
                <Badge variant="outline">
                  Total Rent: {formatAmount(units.reduce((total, unit) => total + unit.rent_amount, 0))}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Units Summary */}
      {units.length > 0 && (
        <Card className="bg-background">
          <CardHeader>
            <CardTitle className="text-primary">Units Summary ({units.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {units.map((unit, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-tint-gray rounded-lg">
                  <div>
                    <span className="font-medium">{unit.unit_number}</span>
                    <span className="text-muted-foreground ml-2">• {unit.unit_type}</span>
                    <span className="text-muted-foreground ml-2">• {unit.bedrooms}BR/{unit.bathrooms}BA</span>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatAmount(unit.rent_amount)}/month</p>
                    {unit.security_deposit && (
                      <p className="text-sm text-muted-foreground">
                        Deposit: {formatAmount(unit.security_deposit)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between gap-3 pt-6 border-t border-border">
        <Button type="button" variant="outline" onClick={() => setStep("units")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Units
        </Button>
        <Button onClick={handleFinalSubmit} disabled={loading} className="bg-success hover:bg-success/90">
          {loading ? "Creating..." : "Create Property"}
          <Check className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Add Property & Units
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-semibold">
            {step === "property" && "Create New Property"}
            {step === "units" && "Add Units"}
            {step === "review" && "Review & Create"}
          </DialogTitle>
          <div className="flex items-center gap-2 mt-2">
            <div className={`h-2 w-8 rounded ${step === "property" ? "bg-primary" : "bg-muted"}`} />
            <div className={`h-2 w-8 rounded ${step === "units" ? "bg-primary" : "bg-muted"}`} />
            <div className={`h-2 w-8 rounded ${step === "review" ? "bg-primary" : "bg-muted"}`} />
          </div>
        </DialogHeader>
        
        {step === "property" && renderPropertyStep()}
        {step === "units" && renderUnitsStep()}
        {step === "review" && renderReviewStep()}
      </DialogContent>
    </Dialog>
  );
}