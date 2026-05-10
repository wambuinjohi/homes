import { z } from "zod";

// Core validation schemas for security and data integrity

export const propertySchema = z.object({
  name: z.string()
    .min(1, "Property name is required")
    .max(100, "Property name too long")
    .regex(/^[a-zA-Z0-9\s\-_.]+$/, "Invalid characters in property name"),
  address: z.string()
    .min(5, "Address is required")
    .max(200, "Address too long"),
  city: z.string()
    .min(1, "City is required")
    .max(50, "City name too long")
    .regex(/^[a-zA-Z\s\-']+$/, "Invalid characters in city name"),
  state: z.string()
    .min(1, "State is required")
    .max(50, "State name too long"),
  zip_code: z.string()
    .min(3, "ZIP code is required")
    .max(10, "ZIP code too long")
    .regex(/^[a-zA-Z0-9\-\s]+$/, "Invalid ZIP code format"),
  country: z.string()
    .min(2, "Country is required")
    .max(50, "Country name too long")
    .default("Kenya"),
  property_type: z.string()
    .min(1, "Property type is required"),
  description: z.string()
    .max(1000, "Description too long")
    .optional(),
  amenities: z.array(z.string()).optional(),
});

export const tenantSchema = z.object({
  first_name: z.string()
    .min(1, "First name is required")
    .max(50, "First name too long")
    .regex(/^[a-zA-Z\s\-']+$/, "Invalid characters in first name"),
  last_name: z.string()
    .min(1, "Last name is required")
    .max(50, "Last name too long")
    .regex(/^[a-zA-Z\s\-']+$/, "Invalid characters in last name"),
  email: z.string()
    .email("Invalid email format")
    .max(100, "Email too long"),
  phone: z.string()
    .min(10, "Phone number is required")
    .max(20, "Phone number too long")
    .regex(/^[\+]?[0-9\s\-\(\)]+$/, "Invalid phone number format")
    .optional(),
  national_id: z.string()
    .max(20, "National ID too long")
    .optional(),
  profession: z.string()
    .max(100, "Profession too long")
    .optional(),
  monthly_income: z.number()
    .min(0, "Income cannot be negative")
    .max(10000000, "Income too high")
    .optional(),
});

export const expenseSchema = z.object({
  description: z.string()
    .min(1, "Description is required")
    .max(500, "Description too long"),
  amount: z.number()
    .min(0.01, "Amount must be greater than 0")
    .max(1000000, "Amount too high"),
  category: z.string()
    .min(1, "Category is required")
    .max(50, "Category name too long"),
  expense_date: z.string()
    .min(1, "Date is required"),
  vendor_name: z.string()
    .max(100, "Vendor name too long")
    .optional(),
  receipt_url: z.string()
    .url("Invalid URL format")
    .optional(),
});

export const maintenanceRequestSchema = z.object({
  title: z.string()
    .min(1, "Title is required")
    .max(100, "Title too long"),
  description: z.string()
    .min(10, "Description must be at least 10 characters")
    .max(1000, "Description too long"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  category: z.string()
    .min(1, "Category is required")
    .max(50, "Category name too long"),
});

export const invoiceSchema = z.object({
  amount: z.number()
    .min(0.01, "Amount must be greater than 0")
    .max(1000000, "Amount too high"),
  due_date: z.string()
    .min(1, "Due date is required"),
  description: z.string()
    .max(500, "Description too long")
    .optional(),
});

// Sanitization helpers
export const sanitizeString = (input: string): string => {
  return input.trim().replace(/[<>]/g, "");
};

export const sanitizeNumber = (input: string | number): number => {
  const num = typeof input === "string" ? parseFloat(input) : input;
  return isNaN(num) ? 0 : num;
};

// Security validation for user inputs
export const validateAndSanitizeFormData = <T>(
  schema: z.ZodSchema<T>, 
  data: any
): { success: boolean; data?: T; errors?: string[] } => {
  try {
    // Sanitize string fields
    const sanitizedData = { ...data };
    Object.keys(sanitizedData).forEach(key => {
      if (typeof sanitizedData[key] === "string") {
        sanitizedData[key] = sanitizeString(sanitizedData[key]);
      }
    });

    const result = schema.parse(sanitizedData);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      };
    }
    return { 
      success: false, 
      errors: ["Validation failed"] 
    };
  }
};

export type PropertyFormData = z.infer<typeof propertySchema>;
export type TenantFormData = z.infer<typeof tenantSchema>;
export type ExpenseFormData = z.infer<typeof expenseSchema>;
export type MaintenanceRequestFormData = z.infer<typeof maintenanceRequestSchema>;
export type InvoiceFormData = z.infer<typeof invoiceSchema>;

// Unit schema - updated to match actual form fields
export const unitSchema = z.object({
  unit_number: z.string().min(1, "Unit number is required").max(20, "Unit number too long"),
  unit_type: z.string().min(1, "Unit type is required"),
  bedrooms: z.number().min(0, "Bedrooms must be non-negative").max(20, "Too many bedrooms"),
  bathrooms: z.number().min(0, "Bathrooms must be non-negative").max(20, "Too many bathrooms"),
  square_feet: z.number().min(1, "Square feet must be positive").max(50000, "Square feet too large").optional(),
  rent_amount: z.number().min(0, "Rent must be non-negative").max(10000000, "Rent amount too high"),
  security_deposit: z.number().min(0, "Security deposit must be non-negative").max(10000000, "Deposit too high").optional(),
  description: z.string().max(2000, "Description too long").optional(),
});

// User management schema  
export const userManagementSchema = z.object({
  email: z.string().email("Invalid email address"),
  first_name: z.string().min(1, "First name is required").max(50, "First name too long"),
  last_name: z.string().min(1, "Last name is required").max(50, "Last name too long"),
  phone: z.string().regex(/^(\+254|0)[17]\d{8}$/, "Invalid Kenyan phone number"),
  role: z.enum(["admin", "landlord", "manager", "agent"], {
    errorMap: () => ({ message: "Invalid user role" })
  }),
});

export type UnitFormData = z.infer<typeof unitSchema>;
export type UserManagementFormData = z.infer<typeof userManagementSchema>;