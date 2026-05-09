import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calculator, DollarSign } from "lucide-react";
import { getCurrencySymbol } from "@/utils/currency";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TierPricing {
  min_units: number;
  max_units: number | null;
  price_per_unit: number;
}

interface BillingPreviewCalculatorProps {
  planId?: string;
  billingModel: 'percentage' | 'fixed_per_unit' | 'tiered';
  percentageRate?: number;
  fixedAmountPerUnit?: number;
  tierPricing?: TierPricing[];
  currency: string;
}

export const BillingPreviewCalculator: React.FC<BillingPreviewCalculatorProps> = ({
  planId,
  billingModel,
  percentageRate,
  fixedAmountPerUnit,
  tierPricing,
  currency
}) => {
  const [units, setUnits] = useState(10);
  const [rentCollected, setRentCollected] = useState(100000);
  const [calculatedCharge, setCalculatedCharge] = useState(0);
  const [landlordId, setLandlordId] = useState("");
  const [loadingLandlord, setLoadingLandlord] = useState(false);

  useEffect(() => {
    calculateCharge();
  }, [units, rentCollected, billingModel, percentageRate, fixedAmountPerUnit, tierPricing]);

  const calculateCharge = () => {
    let charge = 0;

    if (billingModel === 'percentage' && percentageRate) {
      charge = (rentCollected * percentageRate) / 100;
    } else if (billingModel === 'fixed_per_unit' && fixedAmountPerUnit) {
      charge = units * fixedAmountPerUnit;
    } else if (billingModel === 'tiered' && tierPricing) {
      const applicableTier = tierPricing.find(t => 
        units >= t.min_units && 
        (t.max_units === null || units <= t.max_units)
      );
      if (applicableTier) {
        charge = units * applicableTier.price_per_unit;
      }
    }

    setCalculatedCharge(charge);
  };

  const fetchLandlordData = async () => {
    if (!landlordId) {
      toast.error("Please enter a landlord ID");
      return;
    }

    setLoadingLandlord(true);
    try {
      // Fetch landlord's properties
      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('id')
        .eq('owner_id', landlordId);

      if (propError) throw propError;

      if (!properties || properties.length === 0) {
        setUnits(0);
        setRentCollected(0);
        toast.success("Landlord has no properties");
        setLoadingLandlord(false);
        return;
      }

      const propertyIds = properties.map(p => p.id);

      // Fetch units count
      const { data: unitsData } = await supabase
        .from('units')
        .select('id')
        .in('property_id', propertyIds);

      const unitCount = unitsData?.length || 0;

      // Fetch rent collected this month - simplified to avoid deep type inference
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      // Simplified query to avoid TypeScript deep instantiation
      const paymentResult = await supabase.rpc('get_landlord_rent_total', {
        p_landlord_id: landlordId,
        p_start_date: startOfMonth.toISOString()
      });

      const totalRent = paymentResult.data || 0;

      setUnits(unitCount);
      setRentCollected(totalRent);
      
      toast.success("Landlord data loaded successfully");
    } catch (error) {
      console.error("Error fetching landlord data:", error);
      toast.error("Failed to fetch landlord data");
    } finally {
      setLoadingLandlord(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Billing Preview Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="landlord-id">Load Landlord Data (Optional)</Label>
            <div className="flex gap-2">
              <Input
                id="landlord-id"
                placeholder="Enter landlord user ID"
                value={landlordId}
                onChange={(e) => setLandlordId(e.target.value)}
              />
              <Button 
                onClick={fetchLandlordData} 
                disabled={loadingLandlord}
                size="sm"
              >
                {loadingLandlord ? "Loading..." : "Load"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="units">Number of Units</Label>
            <Input
              id="units"
              type="number"
              value={units}
              onChange={(e) => setUnits(parseInt(e.target.value) || 0)}
            />
          </div>

          {billingModel === 'percentage' && (
            <div className="space-y-2">
              <Label htmlFor="rent">Monthly Rent Collected</Label>
              <Input
                id="rent"
                type="number"
                value={rentCollected}
                onChange={(e) => setRentCollected(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}

          <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="font-medium">Calculated Charge:</span>
              </div>
              <span className="text-2xl font-bold text-primary">
                {getCurrencySymbol(currency)}{calculatedCharge.toFixed(2)}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {billingModel === 'percentage' && percentageRate && (
                <p>{percentageRate}% of {getCurrencySymbol(currency)}{rentCollected.toFixed(2)}</p>
              )}
              {billingModel === 'fixed_per_unit' && fixedAmountPerUnit && (
                <p>{units} units × {getCurrencySymbol(currency)}{fixedAmountPerUnit}</p>
              )}
              {billingModel === 'tiered' && tierPricing && (
                <p>Tiered pricing for {units} units</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
