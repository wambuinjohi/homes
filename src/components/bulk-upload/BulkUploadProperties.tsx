import React from "react";
import { BulkUploadBase, ValidationError } from "./BulkUploadBase";
import { BulkUploadFieldGuide, FieldInfo } from "./BulkUploadFieldGuide";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const VALID_PROPERTY_TYPES = ["Apartment", "House", "Villa", "Townhouse", "Condo", "Studio", "Office", "Retail"];

export function BulkUploadProperties() {
  const { user } = useAuth();

  const templateData = [
    {
      "Property Name": "Sunrise Apartments",
      "Address": "123 Nairobi Road",
      "City": "Nairobi",
      "State": "Nairobi County",
      "Zip Code": "00100",
      "Country": "Kenya",
      "Property Type": "Apartment",
      "Total Units": "20",
      "Manager Email": "manager@example.com",
      "Amenities": "Swimming Pool,Gym,Parking",
      "Description": "Modern apartment complex with excellent amenities"
    },
    {
      "Property Name": "Sunset Villas",
      "Address": "456 Mombasa Avenue", 
      "City": "Mombasa",
      "State": "Mombasa County",
      "Zip Code": "80100",
      "Country": "Kenya",
      "Property Type": "Villa",
      "Total Units": "12",
      "Manager Email": "",
      "Amenities": "Garden,Security,Parking",
      "Description": "Luxury villas with private gardens"
    }
  ];

  const requiredFields = ["Property Name", "Address", "City", "State", "Property Type"];

  const fieldGuide: FieldInfo[] = [
    { name: "Property Name", required: true, description: "Unique name for the property", format: "Text, max 100 characters" },
    { name: "Address", required: true, description: "Street address of the property", format: "Text" },
    { name: "City", required: true, description: "City where property is located", format: "Text" },
    { name: "State", required: true, description: "County/State where property is located", format: "e.g., Nairobi County" },
    { name: "Zip Code", required: false, description: "Postal code", format: "3-10 characters" },
    { name: "Country", required: false, description: "Country (defaults to Kenya)", format: "Text" },
    { name: "Property Type", required: true, description: "Type of property", validValues: VALID_PROPERTY_TYPES },
    { name: "Total Units", required: false, description: "Expected number of units", format: "Positive number" },
    { name: "Manager Email", required: false, description: "Email of manager (must be an existing user in the system)", format: "email@example.com" },
    { name: "Amenities", required: false, description: "Property amenities", format: "Comma-separated list" },
    { name: "Description", required: false, description: "Property description", format: "Text" }
  ];

  const tips = [
    "Property Names must be unique - duplicates will be rejected",
    "Manager Email must belong to an existing user in the system",
    "Use commas to separate multiple amenities (e.g., 'Pool,Gym,Parking')",
    "Property Type must match exactly one of the valid values shown above"
  ];

  const validateData = async (data: Array<Record<string, any>>): Promise<ValidationError[]> => {
    const errors: ValidationError[] = [];
    const propertyNames = new Set<string>();

    // Check existing property names
    const existingPropertyNames = new Set<string>();
    try {
      const { data: properties } = await supabase
        .from("properties")
        .select("name");
      
      if (properties) {
        properties.forEach(property => existingPropertyNames.add(property.name.toLowerCase()));
      }
    } catch (error) {
      console.error("Error fetching existing property names:", error);
    }

    // Get available manager emails (any existing user can be a manager)
    let availableManagers: string[] = [];
    try {
      const { data: managers } = await supabase
        .from("profiles")
        .select("id, email");

      if (managers) {
        availableManagers = managers.map(m => m.email.toLowerCase());
      }
    } catch (error) {
      console.error("Error fetching available managers:", error);
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

      // Validate property name uniqueness
      if (row["Property Name"]) {
        const propertyName = String(row["Property Name"]).toLowerCase().trim();
        
        if (propertyNames.has(propertyName)) {
          errors.push({
            row: index,
            field: "Property Name",
            message: "Duplicate property name in upload"
          });
        } else {
          propertyNames.add(propertyName);
        }

        if (existingPropertyNames.has(propertyName)) {
          errors.push({
            row: index,
            field: "Property Name",
            message: "Property name already exists in database"
          });
        }
      }

      // Validate manager email if provided
      if (row["Manager Email"] && String(row["Manager Email"]).trim() !== '') {
        const managerEmail = String(row["Manager Email"]).toLowerCase().trim();
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(managerEmail)) {
          errors.push({
            row: index,
            field: "Manager Email",
            message: "Invalid email format"
          });
        } else if (!availableManagers.includes(managerEmail)) {
          errors.push({
            row: index,
            field: "Manager Email",
            message: "Manager email not found. Email must belong to an existing user."
          });
        }
      }

      // Validate total units is a positive number
      if (row["Total Units"]) {
        const totalUnits = Number(row["Total Units"]);
        if (isNaN(totalUnits) || totalUnits <= 0) {
          errors.push({
            row: index,
            field: "Total Units",
            message: "Total units must be a positive number"
          });
        }
      }

      // Validate zip code format
      if (row["Zip Code"]) {
        const zipCode = String(row["Zip Code"]).trim();
        if (zipCode.length < 3 || zipCode.length > 10) {
          errors.push({
            row: index,
            field: "Zip Code",
            message: "Zip code must be 3-10 characters"
          });
        }
      }

      // Validate property type
      if (row["Property Type"]) {
        const propertyType = String(row["Property Type"]).trim();
        if (!VALID_PROPERTY_TYPES.includes(propertyType)) {
          errors.push({
            row: index,
            field: "Property Type",
            message: `Property Type must be one of: ${VALID_PROPERTY_TYPES.join(', ')}`
          });
        }
      }
    });

    return errors;
  };

  const importData = async (data: Array<Record<string, any>>): Promise<void> => {
    try {
      const managerEmails = data
        .filter(row => row["Manager Email"] && String(row["Manager Email"]).trim() !== '')
        .map(row => String(row["Manager Email"]).toLowerCase().trim());

      let managerMap = new Map<string, string>();
      if (managerEmails.length > 0) {
        const { data: managers, error: managersError } = await supabase
          .from("profiles")
          .select("id, email")
          .in("email", managerEmails);

        if (managersError) {
          throw new Error(`Failed to fetch managers: ${managersError.message}`);
        }

        managerMap = new Map(
          managers?.map(manager => [manager.email.toLowerCase(), manager.id]) || []
        );
      }

      // Build properties with ONLY valid columns - strip any extra keys from parsed data
      const properties = data.map(row => {
        // Handle numeric fields that may have commas (e.g., "1,000")
        const totalUnitsRaw = String(row["Total Units"] || '0').replace(/,/g, '');
        
        return {
          name: String(row["Property Name"]).trim(),
          address: String(row["Address"]).trim(),
          city: String(row["City"]).trim(),
          state: String(row["State"]).trim(),
          zip_code: String(row["Zip Code"] || '').trim(),
          country: String(row["Country"] || 'Kenya').trim(),
          property_type: String(row["Property Type"]).trim(),
          total_units: totalUnitsRaw ? Number(totalUnitsRaw) : 0,
          owner_id: user?.id,
          manager_id: row["Manager Email"] ? managerMap.get(String(row["Manager Email"]).toLowerCase().trim()) : null,
          amenities: row["Amenities"] ? String(row["Amenities"]).split(',').map(a => a.trim()) : null,
          description: row["Description"] ? String(row["Description"]) : null
        };
      });

      const { error: propertiesError } = await supabase
        .from("properties")
        .insert(properties);

      if (propertiesError) {
        throw new Error(`Failed to create properties: ${propertiesError.message}`);
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
        title="Bulk Upload Properties"
        description="Upload multiple property records at once. Properties will be assigned to you as the owner."
        templateData={templateData}
        templateFileName="RentFlow_Properties_Import_Template.xlsx"
        requiredFields={requiredFields}
        fieldMetadata={fieldMetadata}
        onValidateData={validateData}
        onImportData={importData}
        maxRecords={500}
      />
    </div>
  );
}
