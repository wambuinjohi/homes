import React, { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Play, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function BillingTestMode() {
  const [landlordId, setLandlordId] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runBillingTest = async () => {
    if (!landlordId.trim()) {
      toast.error("Please enter a landlord ID");
      return;
    }

    setIsRunning(true);
    setResult(null);
    setError(null);

    try {
      // Fetch landlord subscription details
      const { data: subscription, error: subError } = await supabase
        .from('landlord_subscriptions')
        .select(`
          *,
          billing_plans (
            id,
            name,
            billing_model,
            percentage_rate,
            fixed_amount_per_unit,
            tier_pricing,
            currency
          )
        `)
        .eq('landlord_id', landlordId)
        .eq('status', 'active')
        .single();

      if (subError) throw new Error(`Subscription error: ${subError.message}`);
      if (!subscription) throw new Error("No active subscription found for this landlord");

      const plan = subscription.billing_plans;
      
      // Fetch landlord's properties
      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('id')
        .eq('owner_id', landlordId);

      if (propError) throw propError;

      const propertyIds = properties?.map(p => p.id) || [];

      // Fetch units
      const { data: units, error: unitsError } = await supabase
        .from('units')
        .select('id, property_id')
        .in('property_id', propertyIds);

      if (unitsError) throw unitsError;

      const unitCount = units?.length || 0;

      // Fetch rent collected this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: rentTotal, error: payError } = await supabase.rpc('get_landlord_rent_total', {
        p_landlord_id: landlordId,
        p_start_date: startOfMonth.toISOString()
      });

      if (payError) throw payError;

      const rentCollected = rentTotal || 0;

      // Calculate service charge
      let serviceCharge = 0;

      if (plan.billing_model === 'percentage' && plan.percentage_rate) {
        serviceCharge = (rentCollected * plan.percentage_rate) / 100;
      } else if (plan.billing_model === 'fixed_per_unit' && plan.fixed_amount_per_unit) {
        serviceCharge = unitCount * plan.fixed_amount_per_unit;
      } else if (plan.billing_model === 'tiered' && Array.isArray(plan.tier_pricing)) {
        const tierPricing = plan.tier_pricing as Array<{
          min_units: number;
          max_units: number | null;
          price_per_unit: number;
        }>;
        const applicableTier = tierPricing.find(t => 
          unitCount >= t.min_units && 
          (t.max_units === null || unitCount <= t.max_units)
        );
        if (applicableTier) {
          serviceCharge = unitCount * applicableTier.price_per_unit;
        }
      }

      // Fetch SMS charges
      const { data: smsUsage, error: smsError } = await supabase
        .from('sms_usage')
        .select('cost')
        .eq('landlord_id', landlordId)
        .gte('created_at', startOfMonth.toISOString());

      if (smsError) throw smsError;

      const smsCharges = smsUsage?.reduce((sum, s) => sum + (s.cost || 0), 0) || 0;

      const totalAmount = serviceCharge + smsCharges;

      setResult({
        landlord_id: landlordId,
        plan: {
          id: plan.id,
          name: plan.name,
          billing_model: plan.billing_model,
          percentage_rate: plan.percentage_rate,
          fixed_amount_per_unit: plan.fixed_amount_per_unit,
          currency: plan.currency
        },
        metrics: {
          properties: propertyIds.length,
          units: unitCount,
          rent_collected: rentCollected,
          sms_charges: smsCharges
        },
        calculation: {
          service_charge: serviceCharge,
          sms_charges: smsCharges,
          total_amount: totalAmount,
          would_generate_invoice: totalAmount >= 10
        }
      });

      toast.success("Billing test completed successfully");
    } catch (err: any) {
      console.error("Billing test error:", err);
      setError(err.message);
      toast.error("Billing test failed");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Billing Test Mode</h1>
          <p className="text-muted-foreground">
            Test billing calculations for a specific landlord without generating actual invoices
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Run Billing Test</CardTitle>
              <CardDescription>
                Enter a landlord ID to simulate the monthly billing process
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="landlord-id">Landlord User ID</Label>
                <Input
                  id="landlord-id"
                  placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000"
                  value={landlordId}
                  onChange={(e) => setLandlordId(e.target.value)}
                />
              </div>

              <Button 
                onClick={runBillingTest} 
                disabled={isRunning || !landlordId.trim()}
                className="w-full"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running Test...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Billing Test
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {error && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  Test Failed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {result && (
            <Card className="border-green-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  Test Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Plan Information</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Plan Name:</div>
                    <div className="font-medium">{result.plan.name}</div>
                    <div className="text-muted-foreground">Billing Model:</div>
                    <div><Badge variant="outline">{result.plan.billing_model}</Badge></div>
                    {result.plan.percentage_rate && (
                      <>
                        <div className="text-muted-foreground">Rate:</div>
                        <div>{result.plan.percentage_rate}%</div>
                      </>
                    )}
                    {result.plan.fixed_amount_per_unit && (
                      <>
                        <div className="text-muted-foreground">Per Unit:</div>
                        <div>{result.plan.currency} {result.plan.fixed_amount_per_unit}</div>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-2">Landlord Metrics</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Properties:</div>
                    <div>{result.metrics.properties}</div>
                    <div className="text-muted-foreground">Units:</div>
                    <div>{result.metrics.units}</div>
                    <div className="text-muted-foreground">Rent Collected:</div>
                    <div>{result.plan.currency} {result.metrics.rent_collected.toFixed(2)}</div>
                    <div className="text-muted-foreground">SMS Charges:</div>
                    <div>{result.plan.currency} {result.metrics.sms_charges.toFixed(2)}</div>
                  </div>
                </div>

                <div className="p-4 bg-primary/10 rounded-lg">
                  <h3 className="font-medium mb-2">Billing Calculation</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Service Charge:</div>
                    <div>{result.plan.currency} {result.calculation.service_charge.toFixed(2)}</div>
                    <div className="text-muted-foreground">SMS Charges:</div>
                    <div>{result.plan.currency} {result.calculation.sms_charges.toFixed(2)}</div>
                    <div className="font-bold">Total Amount:</div>
                    <div className="font-bold text-lg">{result.plan.currency} {result.calculation.total_amount.toFixed(2)}</div>
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Would Generate Invoice:</span>
                      {result.calculation.would_generate_invoice ? (
                        <Badge className="bg-green-500">Yes</Badge>
                      ) : (
                        <Badge variant="secondary">No (Amount &lt; 10)</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Full Response (JSON)</Label>
                  <Textarea
                    value={JSON.stringify(result, null, 2)}
                    readOnly
                    className="font-mono text-xs mt-2"
                    rows={10}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
