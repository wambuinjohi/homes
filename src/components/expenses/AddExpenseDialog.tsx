import { useState } from "react";
import { getGlobalCurrencySync } from "@/utils/currency";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, Users, Building } from "lucide-react";

interface Property {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  unit_number: string;
  property_id: string;
}

interface Tenant {
  id: string;
  first_name: string;
  last_name: string;
  unit_id?: string;
}

interface OneTimeExpenseData {
  property_id: string;
  category: string;
  amount: number;
  expense_date: string;
  description: string;
  vendor_name?: string;
  tenant_id?: string;
  is_recurring?: boolean;
  recurrence_period?: string;
}

interface MeterReadingData {
  unit_id: string;
  meter_type: string;
  previous_reading: number;
  current_reading: number;
  reading_date: string;
  rate_per_unit: number;
  notes?: string;
}

interface AddExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: Property[];
  onSuccess: () => void;
}

const EXPENSE_CATEGORIES = [
  "Maintenance", "Insurance", "Management", "Legal", "Marketing", 
  "Security", "Landscaping", "Cleaning", "Repairs", "Other"
];

const METER_TYPES = [
  { value: "electricity", label: "Electricity" },
  { value: "water", label: "Water" },
  { value: "gas", label: "Gas" },
  { value: "internet", label: "Internet" },
  { value: "cable", label: "Cable TV" }
];

const RECURRENCE_PERIODS = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" }
];

export function AddExpenseDialog({ open, onOpenChange, properties, onSuccess }: AddExpenseDialogProps) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [propertyTenants, setPropertyTenants] = useState<Tenant[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>("");
  const [selectedMeterProperty, setSelectedMeterProperty] = useState<string>("");
  const [activeTab, setActiveTab] = useState("one-time");
  const [bulkType, setBulkType] = useState<"single" | "all-units" | "selected-units">("single");
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<"form" | "bulk">("form");
  const { toast } = useToast();

  const oneTimeForm = useForm<OneTimeExpenseData>();
  const meterForm = useForm<MeterReadingData>();

  const fetchUnits = async (propertyId: string) => {
    try {
      const { data, error } = await supabase
        .from("units")
        .select("id, unit_number, property_id")
        .eq("property_id", propertyId);

      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error("Error fetching units:", error);
    }
  };

  const fetchPropertyTenants = async (propertyId: string) => {
    try {
      const { data, error } = await supabase
        .from("tenants")
        .select(`
          id, first_name, last_name,
          leases!inner(unit_id, units!inner(property_id))
        `)
        .eq("leases.units.property_id", propertyId)
        .eq("leases.status", "active");

      if (error) throw error;
      
      const tenantsWithUnits = data?.map(tenant => ({
        id: tenant.id,
        first_name: tenant.first_name,
        last_name: tenant.last_name,
        unit_id: tenant.leases?.[0]?.unit_id
      })) || [];
      
      setPropertyTenants(tenantsWithUnits);
    } catch (error) {
      console.error("Error fetching property tenants:", error);
      setPropertyTenants([]);
    }
  };

  const handleBulkOneTimeExpense = async (data: OneTimeExpenseData) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("User not authenticated");

      let expenseEntries = [];

      if (bulkType === "single") {
        // Single expense
        expenseEntries = [{
          ...data,
          amount: Number(data.amount),
          expense_type: "one-time",
          created_by: userData.user.id,
        }];
      } else if (bulkType === "all-units") {
        // All units in property
        expenseEntries = units.map(unit => ({
          ...data,
          unit_id: unit.id,
          amount: Number(data.amount),
          expense_type: "one-time",
          created_by: userData.user.id,
        }));
      } else if (bulkType === "selected-units") {
        // Selected units only
        expenseEntries = selectedUnits.map(unitId => ({
          ...data,
          unit_id: unitId,
          amount: Number(data.amount),
          expense_type: "one-time",
          created_by: userData.user.id,
        }));
      }

      const { data: insertedData, error } = await supabase
        .from("expenses")
        .insert(expenseEntries)
        .select();

      if (error) {
        // When RLS prevents reading back inserted rows, the insert may still succeed but select will error
        throw error;
      }

      const createdCount = Array.isArray(insertedData) ? insertedData.length : (insertedData ? 1 : 0);

      toast({
        title: "Success",
        description: `${createdCount} expense record(s) created successfully`,
      });

      // Log full inserted rows for debugging (visible in browser console)
      console.debug('Inserted expense rows:', insertedData);

      oneTimeForm.reset();
      setBulkType("single");
      setSelectedUnits([]);
      onOpenChange(false);
      // Call onSuccess to allow parent to refetch; also pass inserted rows for immediate UI usage if needed
      try { onSuccess && (onSuccess as any)(insertedData); } catch (e) { onSuccess && onSuccess(); }
    } catch (error) {
      console.error("Error recording expense:", error);
      toast({
        title: "Error",
        description: "Failed to record expense",
        variant: "destructive",
      });
    }
  };

  const onSubmitMeter = async (data: MeterReadingData) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("User not authenticated");

      // Calculate consumption and cost
      const unitsConsumed = data.current_reading - data.previous_reading;
      const totalCost = unitsConsumed * data.rate_per_unit;

      // Insert meter reading
      const { data: meterData, error: meterError } = await supabase
        .from("meter_readings")
        .insert([{
          ...data,
          previous_reading: Number(data.previous_reading),
          current_reading: Number(data.current_reading),
          rate_per_unit: Number(data.rate_per_unit),
          created_by: userData.user.id,
        }])
        .select()
        .single();

      if (meterError) throw meterError;

      // Get unit details for expense
      const { data: unitData, error: unitError } = await supabase
        .from("units")
        .select("property_id")
        .eq("id", data.unit_id)
        .single();

      if (unitError) throw unitError;

      // Create corresponding expense record
      const { data: insertedExpenses, error: expenseError } = await supabase
        .from("expenses")
        .insert([{
          property_id: unitData.property_id,
          unit_id: data.unit_id,
          category: "Utilities",
          amount: totalCost,
          expense_date: data.reading_date,
          description: `${data.meter_type} usage: ${unitsConsumed} units`,
          expense_type: "metered",
          meter_reading_id: meterData.id,
          created_by: userData.user.id,
        }])
        .select();

      if (expenseError) throw expenseError;

      toast({
        title: "Success",
        description: "Meter reading and expense recorded successfully",
      });

      console.debug('Inserted expense rows (metered):', insertedExpenses);

      meterForm.reset();
      onOpenChange(false);
      try { onSuccess && (onSuccess as any)(insertedExpenses); } catch (e) { onSuccess && onSuccess(); }
    } catch (error) {
      console.error("Error recording meter reading:", error);
      toast({
        title: "Error",
        description: "Failed to record meter reading",
        variant: "destructive",
      });
    }
  };

  const handlePropertyChange = (propertyId: string) => {
    setSelectedProperty(propertyId);
    oneTimeForm.setValue("property_id", propertyId);
    fetchUnits(propertyId);
    fetchPropertyTenants(propertyId);
    setBulkType("single");
    setSelectedUnits([]);
  };

  const handleMeterPropertyChange = (propertyId: string) => {
    setSelectedMeterProperty(propertyId);
    fetchUnits(propertyId);
  };

  const handleUnitSelection = (unitId: string, checked: boolean) => {
    if (checked) {
      setSelectedUnits([...selectedUnits, unitId]);
    } else {
      setSelectedUnits(selectedUnits.filter(id => id !== unitId));
    }
  };

  const handleBulkUpload = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      toast({
        title: "Info",
        description: `Processing ${lines.length - 1} records from CSV...`,
      });

      // Process CSV data here
      // This is a simplified example - you'd need proper CSV parsing
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process CSV file",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="one-time">One-time Expense</TabsTrigger>
            <TabsTrigger value="metered">Metered Utilities</TabsTrigger>
          </TabsList>

          <TabsContent value="one-time" className="space-y-4">
            <div className="flex gap-2 mb-4">
              <Button
                type="button"
                variant={uploadMode === "form" ? "default" : "outline"}
                onClick={() => setUploadMode("form")}
                className="flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Form Entry
              </Button>
              <Button
                type="button"
                variant={uploadMode === "bulk" ? "default" : "outline"}
                onClick={() => setUploadMode("bulk")}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Bulk Upload
              </Button>
            </div>

            {uploadMode === "bulk" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Bulk Upload Expenses</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="csv-upload">Upload CSV File</Label>
                    <Input
                      id="csv-upload"
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCsvFile(file);
                          handleBulkUpload(file);
                        }
                      }}
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      CSV should include: property_id, category, amount, expense_date, description, vendor_name
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Record One-time Expense</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={oneTimeForm.handleSubmit(handleBulkOneTimeExpense)} className="space-y-4">
                    <div>
                      <Label htmlFor="property_id">Property</Label>
                      <Select onValueChange={handlePropertyChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select property" />
                        </SelectTrigger>
                        <SelectContent>
                          {properties.map(property => (
                            <SelectItem key={property.id} value={property.id}>
                              {property.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedProperty && (
                      <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                        <Label>Expense Distribution</Label>
                        <RadioGroup value={bulkType} onValueChange={(value: any) => setBulkType(value)}>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="single" id="single" />
                            <Label htmlFor="single" className="flex items-center gap-2">
                              <Building className="w-4 h-4" />
                              Single property expense
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="all-units" id="all-units" />
                            <Label htmlFor="all-units" className="flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              All units in property ({units.length} units)
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="selected-units" id="selected-units" />
                            <Label htmlFor="selected-units">Selected units only</Label>
                          </div>
                        </RadioGroup>

                        {bulkType === "selected-units" && (
                          <div className="space-y-2">
                            <Label>Select Units</Label>
                            <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                              {units.map(unit => (
                                <div key={unit.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={unit.id}
                                    checked={selectedUnits.includes(unit.id)}
                                    onCheckedChange={(checked) => handleUnitSelection(unit.id, checked as boolean)}
                                  />
                                  <Label htmlFor={unit.id} className="text-sm">{unit.unit_number}</Label>
                                </div>
                              ))}
                            </div>
                            {selectedUnits.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {selectedUnits.map(unitId => {
                                  const unit = units.find(u => u.id === unitId);
                                  return (
                                    <Badge key={unitId} variant="secondary">
                                      {unit?.unit_number}
                                    </Badge>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="category">Category</Label>
                        <Select onValueChange={(value) => oneTimeForm.setValue("category", value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {EXPENSE_CATEGORIES.map(category => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="amount">Amount ({getGlobalCurrencySync()})</Label>
                        <Input
                          id="amount"
                          type="number"
                          {...oneTimeForm.register("amount", { required: "Amount is required" })}
                          placeholder="5000"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="expense_date">Expense Date</Label>
                        <Input
                          id="expense_date"
                          type="date"
                          {...oneTimeForm.register("expense_date", { required: "Date is required" })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="vendor_name">Vendor Name</Label>
                        <Input
                          id="vendor_name"
                          {...oneTimeForm.register("vendor_name")}
                          placeholder="ABC Supplies"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is_recurring"
                        checked={oneTimeForm.watch("is_recurring")}
                        onCheckedChange={(checked) => oneTimeForm.setValue("is_recurring", checked as boolean)}
                      />
                      <Label htmlFor="is_recurring">Recurring expense</Label>
                    </div>

                    {oneTimeForm.watch("is_recurring") && (
                      <div>
                        <Label htmlFor="recurrence_period">Recurrence Period</Label>
                        <Select onValueChange={(value) => oneTimeForm.setValue("recurrence_period", value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select period" />
                          </SelectTrigger>
                          <SelectContent>
                            {RECURRENCE_PERIODS.map(period => (
                              <SelectItem key={period.value} value={period.value}>
                                {period.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        {...oneTimeForm.register("description", { required: "Description is required" })}
                        placeholder="Describe the expense..."
                        rows={3}
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        Record Expense
                        {bulkType !== "single" && (
                          <Badge variant="secondary" className="ml-2">
                            {bulkType === "all-units" ? units.length : selectedUnits.length} units
                          </Badge>
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="metered" className="space-y-4">
            <div className="flex gap-2 mb-4">
              <Button
                type="button"
                variant={uploadMode === "form" ? "default" : "outline"}
                onClick={() => setUploadMode("form")}
                className="flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Form Entry
              </Button>
              <Button
                type="button"
                variant={uploadMode === "bulk" ? "default" : "outline"}
                onClick={() => setUploadMode("bulk")}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Bulk Upload
              </Button>
            </div>

            {uploadMode === "bulk" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Bulk Upload Meter Readings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="meter-csv-upload">Upload CSV File</Label>
                    <Input
                      id="meter-csv-upload"
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCsvFile(file);
                          handleBulkUpload(file);
                        }
                      }}
                    />
                    <p className="text-sm text-muted-foreground mt-2">
                      CSV should include: unit_id, meter_type, previous_reading, current_reading, reading_date, rate_per_unit, notes
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Record Meter Reading</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={meterForm.handleSubmit(onSubmitMeter)} className="space-y-4">
                    <div>
                      <Label htmlFor="meter_property">Property</Label>
                      <Select onValueChange={handleMeterPropertyChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select property first" />
                        </SelectTrigger>
                        <SelectContent>
                          {properties.map(property => (
                            <SelectItem key={property.id} value={property.id}>
                              {property.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="unit_id">Unit</Label>
                      <Select 
                        onValueChange={(value) => meterForm.setValue("unit_id", value)}
                        disabled={!selectedMeterProperty}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={!selectedMeterProperty ? "Select property first" : "Select unit"} />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map(unit => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unit.unit_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="meter_type">Meter Type</Label>
                        <Select onValueChange={(value) => meterForm.setValue("meter_type", value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select meter type" />
                          </SelectTrigger>
                          <SelectContent>
                            {METER_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="reading_date">Reading Date</Label>
                        <Input
                          id="reading_date"
                          type="date"
                          {...meterForm.register("reading_date", { required: "Date is required" })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="previous_reading">Previous Reading</Label>
                        <Input
                          id="previous_reading"
                          type="number"
                          step="0.01"
                          {...meterForm.register("previous_reading", { required: "Required" })}
                          placeholder="1000"
                        />
                      </div>
                      <div>
                        <Label htmlFor="current_reading">Current Reading</Label>
                        <Input
                          id="current_reading"
                          type="number"
                          step="0.01"
                          {...meterForm.register("current_reading", { required: "Required" })}
                          placeholder="1250"
                        />
                      </div>
                      <div>
                        <Label htmlFor="rate_per_unit">Rate per Unit ({getGlobalCurrencySync()})</Label>
                        <Input
                          id="rate_per_unit"
                          type="number"
                          step="0.01"
                          {...meterForm.register("rate_per_unit", { required: "Required" })}
                          placeholder="25.50"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Textarea
                        id="notes"
                        {...meterForm.register("notes")}
                        placeholder="Additional notes about the reading..."
                        rows={2}
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        Record Reading
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
