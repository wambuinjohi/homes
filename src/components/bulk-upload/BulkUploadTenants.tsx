import React from "react";
import { BulkUploadBase, ValidationError } from "./BulkUploadBase";
import { BulkUploadFieldGuide, FieldInfo } from "./BulkUploadFieldGuide";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logBulkUploadOperation } from "@/utils/bulkUploadAudit";

export function BulkUploadTenants() {
  const { user } = useAuth();

  const templateData = [
    {
      "Full Name": "John Doe",
      "Email": "john.doe@example.com", 
      "Phone": "+254712345678",
      "Unit Number": "A101",
      "Move In Date": "2024-01-15",
      "Emergency Contact Name": "Jane Doe",
      "Emergency Contact Phone": "+254712345679",
      "ID Number": "12345678",
      "Occupation": "Software Engineer"
    },
    {
      "Full Name": "Mary Smith",
      "Email": "mary.smith@example.com",
      "Phone": "+254723456789", 
      "Unit Number": "B202",
      "Move In Date": "2024-02-01",
      "Emergency Contact Name": "Robert Smith",
      "Emergency Contact Phone": "+254723456790",
      "ID Number": "23456789",
      "Occupation": "Teacher"
    }
  ];

  const requiredFields = ["Full Name", "Email", "Phone", "Unit Number"];

  const fieldGuide: FieldInfo[] = [
    { name: "Full Name", required: true, description: "Tenant's full name", format: "First and last name (e.g., John Doe)" },
    { name: "Email", required: true, description: "Tenant's email address (must be unique)", format: "email@example.com" },
    { name: "Phone", required: true, description: "Tenant's phone number in Kenyan format", format: "+254XXXXXXXXX (e.g., +254712345678)" },
    { name: "Unit Number", required: true, description: "Unit number to assign tenant to (must exist and be vacant)", format: "Must match an existing unit number exactly" },
    { name: "Move In Date", required: false, description: "Date tenant moves in", format: "YYYY-MM-DD (e.g., 2024-01-15)" },
    { name: "Emergency Contact Name", required: false, description: "Name of emergency contact", format: "Text" },
    { name: "Emergency Contact Phone", required: false, description: "Emergency contact phone number", format: "+254XXXXXXXXX" },
    { name: "ID Number", required: false, description: "National ID or passport number", format: "Text or number" },
    { name: "Occupation", required: false, description: "Tenant's occupation/job", format: "Text" }
  ];

  const tips = [
    "Each Email must be unique - no duplicate emails allowed",
    "Phone numbers must be in Kenyan format: +254 followed by 9 digits",
    "Unit Number must match exactly a vacant unit in your properties",
    "Move In Date format is YYYY-MM-DD (e.g., 2024-03-15)",
    "A user account will be created for each tenant with the provided email"
  ];

  const validateData = async (data: Array<Record<string, any>>): Promise<ValidationError[]> => {
    const errors: ValidationError[] = [];
    const emails = new Set<string>();

    // Check existing emails in database
    const existingEmails = new Set<string>();
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("email");
      
      if (profiles) {
        profiles.forEach(profile => existingEmails.add(profile.email.toLowerCase()));
      }
    } catch (error) {
      console.error("Error fetching existing emails:", error);
    }

    // Get available units for the current user
    let availableUnits: string[] = [];
    try {
      let query = supabase
        .from("units")
        .select("unit_number, properties!inner(id, name)");

      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user?.id);

      const isAdmin = userRoles?.some(role => role.role === "Admin");
      
      if (!isAdmin) {
        query = query.eq("properties.owner_id", user?.id);
      }

      const { data: units } = await query;
      if (units) {
        availableUnits = units.map(unit => unit.unit_number);
      }
    } catch (error) {
      console.error("Error fetching available units:", error);
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

      // Validate email format and uniqueness
      if (row["Email"]) {
        const email = String(row["Email"]).toLowerCase().trim();
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          errors.push({
            row: index,
            field: "Email",
            message: "Invalid email format (e.g., tenant@example.com)"
          });
        } else {
          if (emails.has(email)) {
            errors.push({
              row: index,
              field: "Email",
              message: "Duplicate email in this upload file"
            });
          } else {
            emails.add(email);
          }

          if (existingEmails.has(email)) {
            errors.push({
              row: index,
              field: "Email",
              message: "Email already exists in database - user already registered"
            });
          }
        }
      }

      // Validate phone number format
      if (row["Phone"]) {
        const phone = String(row["Phone"]).trim();
        const phoneRegex = /^\+254[0-9]{9}$/;
        if (!phoneRegex.test(phone)) {
          errors.push({
            row: index,
            field: "Phone",
            message: "Phone must be in format +254XXXXXXXXX (e.g., +254712345678)"
          });
        }
      }

      // Validate Unit Number exists and is available
      if (row["Unit Number"]) {
        const unitNumber = String(row["Unit Number"]).trim();
        if (!availableUnits.includes(unitNumber)) {
          const sampleUnits = availableUnits.slice(0, 5).join(', ');
          errors.push({
            row: index,
            field: "Unit Number", 
            message: `Unit not found or not in your properties. Available: ${sampleUnits}${availableUnits.length > 5 ? '...' : ''}`
          });
        }
      }

      // Validate date format
      if (row["Move In Date"] && String(row["Move In Date"]).trim() !== '') {
        const dateStr = String(row["Move In Date"]);
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          errors.push({
            row: index,
            field: "Move In Date",
            message: "Invalid date format - use YYYY-MM-DD (e.g., 2024-01-15)"
          });
        }
      }

      // Validate emergency contact phone if provided
      if (row["Emergency Contact Phone"] && String(row["Emergency Contact Phone"]).trim() !== '') {
        const phone = String(row["Emergency Contact Phone"]).trim();
        const phoneRegex = /^\+254[0-9]{9}$/;
        if (!phoneRegex.test(phone)) {
          errors.push({
            row: index,
            field: "Emergency Contact Phone",
            message: "Emergency phone must be in format +254XXXXXXXXX"
          });
        }
      }
    });

    return errors;
  };

  const importData = async (data: Array<Record<string, any>>): Promise<void> => {
    const startTime = Date.now();
    const fileName = `tenant_bulk_import_${Date.now()}.csv`;
    
    try {
      // First, create profiles for tenants
      const profiles = data.map(row => ({
        id: crypto.randomUUID(),
        email: String(row["Email"]).toLowerCase().trim(),
        first_name: String(row["Full Name"]).split(' ')[0] || '',
        last_name: String(row["Full Name"]).split(' ').slice(1).join(' ') || '',
        phone: String(row["Phone"]).trim()
      }));

      const { data: createdProfiles, error: profileError } = await supabase
        .from("profiles")
        .insert(profiles)
        .select();

      if (profileError) {
        throw new Error(`Failed to create profiles: ${profileError.message}`);
      }

      // Get unit IDs from unit numbers
      const unitNumbers = data.map(row => String(row["Unit Number"]).trim());
      const { data: units, error: unitsError } = await supabase
        .from("units")
        .select("id, unit_number")
        .in("unit_number", unitNumbers);

      if (unitsError) {
        throw new Error(`Failed to fetch units: ${unitsError.message}`);
      }

      const unitMap = new Map(units?.map(unit => [unit.unit_number, unit.id]) || []);

      // Create tenants
      const tenants = data.map((row, index) => {
        const profile = createdProfiles?.[index];
        return {
          user_id: profile.id,
          first_name: String(row["Full Name"]).split(' ')[0] || '',
          last_name: String(row["Full Name"]).split(' ').slice(1).join(' ') || '',
          email: String(row["Email"]).toLowerCase().trim(),
          phone: String(row["Phone"]).trim(),
          unit_id: unitMap.get(String(row["Unit Number"]).trim()),
          move_in_date: row["Move In Date"] ? new Date(String(row["Move In Date"])) : null,
          emergency_contact_name: row["Emergency Contact Name"] ? String(row["Emergency Contact Name"]) : null,
          emergency_contact_phone: row["Emergency Contact Phone"] ? String(row["Emergency Contact Phone"]) : null,
          id_number: row["ID Number"] ? String(row["ID Number"]) : null,
          occupation: row["Occupation"] ? String(row["Occupation"]) : null
        };
      });

      const { error: tenantsError } = await supabase
        .from("tenants")
        .insert(tenants);

      if (tenantsError) {
        throw new Error(`Failed to create tenants: ${tenantsError.message}`);
      }

      // Assign tenant roles
      const userRoles = createdProfiles?.map(profile => ({
        user_id: profile.id,
        role: 'Tenant' as const
      })) || [];

      const { error: rolesError } = await supabase
        .from("user_roles")
        .insert(userRoles);

      if (rolesError) {
        throw new Error(`Failed to assign roles: ${rolesError.message}`);
      }

      await logBulkUploadOperation({
        operation_type: 'tenant',
        file_name: fileName,
        total_records: data.length,
        successful_records: data.length,
        failed_records: 0,
        processing_time_ms: Date.now() - startTime,
        user_id: user?.id || ''
      });

    } catch (error) {
      await logBulkUploadOperation({
        operation_type: 'tenant',
        file_name: fileName,
        total_records: data.length,
        successful_records: 0,
        failed_records: data.length,
        processing_time_ms: Date.now() - startTime,
        user_id: user?.id || ''
      });
      
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
        title="Bulk Upload Tenants"
        description="Upload multiple tenant records at once. Each tenant will be created with a user account."
        templateData={templateData}
        templateFileName="RentFlow_Tenants_Import_Template.xlsx"
        requiredFields={requiredFields}
        fieldMetadata={fieldMetadata}
        onValidateData={validateData}
        onImportData={importData}
        maxRecords={1000}
      />
    </div>
  );
}
