import React from "react";
import { BulkUploadBase, ValidationError } from "./BulkUploadBase";
import { BulkUploadFieldGuide, FieldInfo } from "./BulkUploadFieldGuide";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { checkDuplicateUnitNumbers } from "@/utils/unitValidation";

const VALID_UNIT_TYPES = ["Studio", "Bedsitter", "1BR", "2BR", "3BR", "4BR", "5BR", "Penthouse", "Duplex", "Shop", "Office"];

export function BulkUploadUnits() {
  const { user } = useAuth();

  const templateData = [
    {
      "Unit Number": "A101",
      "Property Name": "Sunrise Apartments",
      "Unit Type": "1BR",
      "Monthly Rent": "25000",
      "Security Deposit": "50000", 
      "Garbage Deposit": "1000",
      "Square Feet": "650",
      "Bedrooms": "1",
      "Bathrooms": "1",
      "Amenities": "Balcony,Parking",
      "Description": "Modern 1-bedroom apartment with city view"
    },
    {
      "Unit Number": "B202",
      "Property Name": "Sunset Complex",
      "Unit Type": "2BR", 
      "Monthly Rent": "35000",
      "Security Deposit": "70000",
      "Garbage Deposit": "1500",
      "Square Feet": "850",
      "Bedrooms": "2",
      "Bathrooms": "2",
      "Amenities": "Balcony,Parking,Storage",
      "Description": "Spacious 2-bedroom unit with modern fixtures"
    }
  ];

  const requiredFields = ["Unit Number", "Property Name", "Unit Type", "Monthly Rent"];

  const fieldGuide: FieldInfo[] = [
    { name: "Unit Number", required: true, description: "Unique identifier for the unit within the property", format: "e.g., A101, B202, SHOP-01" },
    { name: "Property Name", required: true, description: "Name of the property this unit belongs to (must already exist)", format: "Must match an existing property name exactly" },
    { name: "Unit Type", required: true, description: "Type of unit", validValues: VALID_UNIT_TYPES },
    { name: "Monthly Rent", required: true, description: "Monthly rent amount in KES", format: "Positive number (e.g., 25000)" },
    { name: "Security Deposit", required: false, description: "Security deposit amount in KES", format: "Non-negative number" },
    { name: "Garbage Deposit", required: false, description: "Garbage deposit amount in KES", format: "Non-negative number" },
    { name: "Square Feet", required: false, description: "Unit size in square feet", format: "Positive number" },
    { name: "Bedrooms", required: false, description: "Number of bedrooms", format: "Number (e.g., 1, 2, 3)" },
    { name: "Bathrooms", required: false, description: "Number of bathrooms", format: "Number (e.g., 1, 2)" },
    { name: "Amenities", required: false, description: "Unit-specific amenities", format: "Comma-separated (e.g., Balcony,Parking,Storage)" },
    { name: "Description", required: false, description: "Additional description of the unit", format: "Text" }
  ];

  const tips = [
    "Property Name must match exactly an existing property you own or manage",
    "Unit Numbers must be unique across ALL your properties (not just per property) for payment matching",
    "Unit Type must match one of the valid values shown (case-sensitive)",
    "Use commas to separate multiple amenities",
    "All monetary values should be in KES without currency symbols"
  ];

  const validateData = async (data: Array<Record<string, any>>): Promise<ValidationError[]> => {
    const errors: ValidationError[] = [];
    const unitNumbers = new Set<string>();

    // Get available properties for the current user
    let availableProperties: Array<{name: string, id: string}> = [];
    try {
      let query = supabase
        .from("properties")
        .select("id, name");

      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user?.id);

      const isAdmin = userRoles?.some(role => role.role === "Admin");
      
      if (!isAdmin) {
        query = query.eq("owner_id", user?.id);
      }

      const { data: properties } = await query;
      if (properties) {
        availableProperties = properties;
      }
    } catch (error) {
      console.error("Error fetching available properties:", error);
    }

    // Check existing unit numbers across all landlord properties (global uniqueness)
    const existingUnitNumbers = new Map<string, string>();
    if (user?.id) {
      try {
        const duplicateChecks = await checkDuplicateUnitNumbers(
          data.map(row => String(row["Unit Number"] || "").trim()),
          user.id
        );
        
        duplicateChecks.forEach((result, unitNum) => {
          if (result.isDuplicate) {
            existingUnitNumbers.set(unitNum, result.existingProperty || "existing property");
          }
        });
      } catch (error) {
        console.error("Error checking existing unit numbers:", error);
      }
    }

    data.forEach((row, index) => {
      // Check required fields
      requiredFields.forEach(field => {
        if (!row[field] || String(row[field]).trim() === '') {
          errors.push({
            row: index,
            field,
            message: `${field} is required`
          });
        }
      });

      // Validate unit number uniqueness
      if (row["Unit Number"]) {
        const unitNumber = String(row["Unit Number"]).toLowerCase().trim();
        
        if (unitNumbers.has(unitNumber)) {
          errors.push({
            row: index,
            field: "Unit Number",
            message: "Duplicate unit number in upload"
          });
        } else {
          unitNumbers.add(unitNumber);
        }

        if (existingUnitNumbers.has(unitNumber)) {
          const existingProperty = existingUnitNumbers.get(unitNumber);
          errors.push({
            row: index,
            field: "Unit Number",
            message: `Unit number already exists in "${existingProperty}". Unit numbers must be unique across all your properties.`
          });
        }
      }

      // Validate property exists and is accessible
      if (row["Property Name"]) {
        const propertyName = String(row["Property Name"]).trim();
        const property = availableProperties.find(p => 
          p.name.toLowerCase() === propertyName.toLowerCase()
        );
        
        if (!property) {
          const availableNames = availableProperties.map(p => p.name).slice(0, 5).join(', ');
          errors.push({
            row: index,
            field: "Property Name",
            message: `Property not found. Your properties: ${availableNames}${availableProperties.length > 5 ? '...' : ''}`
          });
        }
      }

      // Validate unit type
      if (row["Unit Type"]) {
        const unitType = String(row["Unit Type"]).trim();
        if (!VALID_UNIT_TYPES.includes(unitType)) {
          errors.push({
            row: index,
            field: "Unit Type",
            message: `Unit Type must be one of: ${VALID_UNIT_TYPES.join(', ')}`
          });
        }
      }

      // Validate monthly rent is a positive number
      if (row["Monthly Rent"]) {
        const rent = Number(row["Monthly Rent"]);
        if (isNaN(rent) || rent <= 0) {
          errors.push({
            row: index,
            field: "Monthly Rent",
            message: "Monthly rent must be a positive number"
          });
        }
      }

      // Validate security deposit
      if (row["Security Deposit"] && String(row["Security Deposit"]).trim() !== '') {
        const deposit = Number(row["Security Deposit"]);
        if (isNaN(deposit) || deposit < 0) {
          errors.push({
            row: index,
            field: "Security Deposit",
            message: "Security deposit must be a non-negative number"
          });
        }
      }

      // Validate garbage deposit
      if (row["Garbage Deposit"] && String(row["Garbage Deposit"]).trim() !== '') {
        const deposit = Number(row["Garbage Deposit"]);
        if (isNaN(deposit) || deposit < 0) {
          errors.push({
            row: index,
            field: "Garbage Deposit",
            message: "Garbage deposit must be a non-negative number"
          });
        }
      }

      // Validate numeric fields
      const numericFields = ["Square Feet", "Bedrooms", "Bathrooms"];
      numericFields.forEach(field => {
        if (row[field] && String(row[field]).trim() !== '') {
          const value = Number(row[field]);
          if (isNaN(value) || value < 0) {
            errors.push({
              row: index,
              field,
              message: `${field} must be a non-negative number`
            });
          }
        }
      });
    });

    return errors;
  };

  const importData = async (data: Array<Record<string, any>>): Promise<void> => {
    try {
      const propertyNames = data.map(row => String(row["Property Name"]).trim());
      const { data: properties, error: propertiesError } = await supabase
        .from("properties")
        .select("id, name")
        .in("name", propertyNames);

      if (propertiesError) {
        throw new Error(`Failed to fetch properties: ${propertiesError.message}`);
      }

      const propertyMap = new Map(
        properties?.map(property => [property.name.toLowerCase(), property.id]) || []
      );

      const units = data.map(row => ({
        unit_number: String(row["Unit Number"]).trim(),
        property_id: propertyMap.get(String(row["Property Name"]).trim().toLowerCase()),
        unit_type: String(row["Unit Type"]).trim(),
        rent_amount: Number(String(row["Monthly Rent"]).replace(/,/g, '')),
        security_deposit: row["Security Deposit"] && String(row["Security Deposit"]).trim() !== '' ? Number(String(row["Security Deposit"]).replace(/,/g, '')) : null,
        garbage_deposit: row["Garbage Deposit"] && String(row["Garbage Deposit"]).trim() !== '' ? Number(String(row["Garbage Deposit"]).replace(/,/g, '')) : null,
        square_feet: row["Square Feet"] && String(row["Square Feet"]).trim() !== '' ? Number(String(row["Square Feet"]).replace(/,/g, '')) : null,
        bedrooms: row["Bedrooms"] && String(row["Bedrooms"]).trim() !== '' ? Number(row["Bedrooms"]) : null,
        bathrooms: row["Bathrooms"] && String(row["Bathrooms"]).trim() !== '' ? Number(row["Bathrooms"]) : null,
        amenities: row["Amenities"] ? String(row["Amenities"]).split(',').map(a => a.trim()) : null,
        description: row["Description"] ? String(row["Description"]) : null,
        status: 'vacant'
      }));

      // Defensive: ensure no stale/unknown columns (e.g., floor_number) are ever sent.
      const sanitizedUnits = units.map((u) => {
        const copy: any = { ...u };
        delete copy.floor_number;
        return copy;
      });

      const { error: unitsError } = await supabase
        .from("units")
        .insert(sanitizedUnits as any);

      if (unitsError) {
        throw new Error(`Failed to create units: ${unitsError.message}`);
      }

    } catch (error) {
      console.error("Import error:", error);
      throw error;
    }
  };

  // Convert fieldGuide to fieldMetadata format for template generation
  const fieldMetadata = fieldGuide.map(f => ({
    name: f.name,
    required: f.required,
    format: f.format,
    validValues: f.validValues
  }));

  return (
    <div className="space-y-6">
      <BulkUploadFieldGuide fields={fieldGuide} tips={tips} />
      <BulkUploadBase
        title="Bulk Upload Units"
        description="Upload multiple unit records at once. Units will be linked to your existing properties."
        templateData={templateData}
        templateFileName="RentFlow_Units_Import_Template.xlsx"
        requiredFields={requiredFields}
        fieldMetadata={fieldMetadata}
        onValidateData={validateData}
        onImportData={importData}
        maxRecords={2000}
      />
    </div>
  );
}
