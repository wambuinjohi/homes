import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, Plus, Trash2, DoorOpen } from "lucide-react";
import { UnitTypeSelect } from "@/components/ui/unit-type-select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { checkDuplicateUnitNumbers } from "@/utils/unitValidation";

interface Unit {
  unit_number: string;
  unit_type: string;
  rent_amount: string;
  bedrooms: string;
  bathrooms: string;
}

interface AddUnitsStepProps {
  step: any;
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

export function AddUnitsStep({ step, onNext }: AddUnitsStepProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [units, setUnits] = useState<Unit[]>([
    { unit_number: '', unit_type: '', rent_amount: '', bedrooms: '1', bathrooms: '1' }
  ]);

  useEffect(() => {
    fetchProperties();
  }, [user]);

  const fetchProperties = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProperties(data || []);
      if (data && data.length > 0) {
        setSelectedPropertyId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const addUnit = () => {
    setUnits(prev => [...prev, {
      unit_number: '',
      unit_type: '',
      rent_amount: '',
      bedrooms: '1',
      bathrooms: '1'
    }]);
  };

  const removeUnit = (index: number) => {
    if (units.length > 1) {
      setUnits(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateUnit = (index: number, field: keyof Unit, value: string) => {
    setUnits(prev => prev.map((unit, i) => 
      i === index ? { ...unit, [field]: value } : unit
    ));
  };

  const handleSave = async () => {
    if (!selectedPropertyId || !user) return;

    try {
      setLoading(true);

      const unitsToInsert = units
        .filter(unit => unit.unit_number && unit.rent_amount && unit.unit_type)
        .map(unit => ({
          property_id: selectedPropertyId,
          unit_number: unit.unit_number,
          unit_type: unit.unit_type,
          rent_amount: parseFloat(unit.rent_amount),
          bedrooms: parseInt(unit.bedrooms),
          bathrooms: parseFloat(unit.bathrooms),
          status: 'vacant' as const,
        }));

      if (unitsToInsert.length === 0) {
        toast({
          title: "No Units to Add",
          description: "Please fill in at least one unit with number, type, and rent amount.",
          variant: "destructive",
        });
        return;
      }

      // Check for duplicate unit numbers across all landlord properties
      const unitNumbers = unitsToInsert.map(u => u.unit_number);
      const duplicateChecks = await checkDuplicateUnitNumbers(unitNumbers, user.id);
      
      const duplicates = Array.from(duplicateChecks.entries())
        .filter(([, result]) => result.isDuplicate)
        .map(([num, result]) => `"${num}" (in ${result.existingProperty})`);

      if (duplicates.length > 0) {
        toast({
          title: "Duplicate Unit Numbers",
          description: `The following unit numbers already exist: ${duplicates.join(", ")}. Unit numbers must be unique across all your properties.`,
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('units')
        .insert(unitsToInsert);

      if (error) throw error;

      toast({
        title: "Units Added",
        description: `Added ${unitsToInsert.length} unit(s) to your property.`,
      });

      onNext();
    } catch (error) {
      console.error('Error adding units:', error);
      toast({
        title: "Error",
        description: "Failed to add units",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (properties.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-orange-100 rounded-full">
              <Home className="h-8 w-8 text-orange-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-primary">No Properties Found</h2>
          <p className="text-muted-foreground">
            You need to add a property first before you can create units.
          </p>
          <Button variant="outline" onClick={() => window.history.back()}>
            Go Back to Add Property
          </Button>
        </div>
      </div>
    );
  }

  const validUnits = units.filter(unit => unit.unit_number && unit.rent_amount && unit.unit_type);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="p-4 bg-primary/10 rounded-full">
            <DoorOpen className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-primary">Add Units to Your Property</h2>
        <p className="text-muted-foreground">
          Set up the individual units within your property for tenant management.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Property</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a property" />
            </SelectTrigger>
            <SelectContent>
              {properties.map(property => (
                <SelectItem key={property.id} value={property.id}>
                  {property.name} - {property.address}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5" />
              Units ({validUnits.length} valid)
            </CardTitle>
            <Button onClick={addUnit} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Unit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {units.map((unit, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-medium">Unit #{index + 1}</h4>
                {units.length > 1 && (
                  <Button
                    onClick={() => removeUnit(index)}
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label>Unit Number *</Label>
                  <Input
                    value={unit.unit_number}
                    onChange={(e) => updateUnit(index, 'unit_number', e.target.value)}
                    placeholder="e.g., 101, A, 1st Floor"
                  />
                </div>
                <div>
                  <Label>Unit Type *</Label>
                  <UnitTypeSelect
                    value={unit.unit_type}
                    onValueChange={(value) => updateUnit(index, 'unit_type', value)}
                    placeholder="Select unit type"
                  />
                </div>
                <div>
                  <Label>Monthly Rent *</Label>
                  <Input
                    type="number"
                    value={unit.rent_amount}
                    onChange={(e) => updateUnit(index, 'rent_amount', e.target.value)}
                    placeholder="1200"
                  />
                </div>
                <div>
                  <Label>Bedrooms</Label>
                  <Select 
                    value={unit.bedrooms}
                    onValueChange={(value) => updateUnit(index, 'bedrooms', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4, 5].map(num => (
                        <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Bathrooms</Label>
                  <Select 
                    value={unit.bathrooms}
                    onValueChange={(value) => updateUnit(index, 'bathrooms', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['1', '1.5', '2', '2.5', '3', '3.5', '4'].map(num => (
                        <SelectItem key={num} value={num}>{num}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="bg-muted/30 rounded-lg p-4">
        <h4 className="font-medium mb-2 flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            Tip
          </Badge>
          Unit Management
        </h4>
        <p className="text-sm text-muted-foreground">
          You can always add more units later from the Properties page. Each unit can have different rent amounts and configurations.
        </p>
      </div>

      <div className="flex justify-center">
        <Button
          onClick={handleSave}
          disabled={validUnits.length === 0 || loading}
          size="lg"
        >
          {loading ? 'Adding Units...' : `Add ${validUnits.length} Unit(s) & Continue`}
        </Button>
      </div>
    </div>
  );
}
