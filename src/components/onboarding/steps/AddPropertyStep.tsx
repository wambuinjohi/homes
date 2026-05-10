import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building, MapPin, CheckCircle2, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface AddPropertyStepProps {
  step: any;
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

export function AddPropertyStep({ step, onNext }: AddPropertyStepProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [property, setProperty] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'USA',
    property_type: '',
    description: '',
  });

  const propertyTypes = [
    'Single Family Home',
    'Duplex',
    'Apartment Building',
    'Condominium',
    'Townhouse',
    'Commercial Property',
    'Other'
  ];

  const handleSave = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('properties')
        .insert([{
          ...property,
          owner_id: user.id,
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Property Added",
        description: `${property.name} has been added to your portfolio.`,
      });

      onNext();
    } catch (error) {
      console.error('Error adding property:', error);
      toast({
        title: "Error",
        description: "Failed to add property",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isComplete = property.name && property.address && property.property_type;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="p-4 bg-primary/10 rounded-full">
            <Building className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-primary">Add Your First Property</h2>
        <p className="text-muted-foreground">
          Let's start by adding your first property to the platform.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Property Information
            {isComplete && <CheckCircle2 className="h-5 w-5 text-success" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Property Name *</Label>
            <Input
              id="name"
              value={property.name}
              onChange={(e) => setProperty(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Sunset Apartments, 123 Main St Property"
              required
            />
          </div>

          <div>
            <Label htmlFor="property_type">Property Type *</Label>
            <Select 
              value={property.property_type} 
              onValueChange={(value) => setProperty(prev => ({ ...prev, property_type: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select property type" />
              </SelectTrigger>
              <SelectContent>
                {propertyTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="address">Street Address *</Label>
            <Input
              id="address"
              value={property.address}
              onChange={(e) => setProperty(prev => ({ ...prev, address: e.target.value }))}
              placeholder="123 Main Street"
              required
            />
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                value={property.city}
                onChange={(e) => setProperty(prev => ({ ...prev, city: e.target.value }))}
                placeholder="City"
                required
              />
            </div>
            <div>
              <Label htmlFor="state">State *</Label>
              <Input
                id="state"
                value={property.state}
                onChange={(e) => setProperty(prev => ({ ...prev, state: e.target.value }))}
                placeholder="State"
                required
              />
            </div>
            <div>
              <Label htmlFor="zip_code">ZIP Code *</Label>
              <Input
                id="zip_code"
                value={property.zip_code}
                onChange={(e) => setProperty(prev => ({ ...prev, zip_code: e.target.value }))}
                placeholder="12345"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={property.description}
              onChange={(e) => setProperty(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of the property..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <div className="bg-muted/30 rounded-lg p-4">
        <h4 className="font-medium mb-2 flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            Next Step
          </Badge>
          After Adding Property
        </h4>
        <p className="text-sm text-muted-foreground">
          Once your property is added, we'll help you set up units and start inviting tenants.
        </p>
      </div>

      <div className="flex justify-center">
        <Button
          onClick={handleSave}
          disabled={!isComplete || loading}
          size="lg"
        >
          {loading ? 'Adding Property...' : 'Add Property & Continue'}
        </Button>
      </div>
    </div>
  );
}