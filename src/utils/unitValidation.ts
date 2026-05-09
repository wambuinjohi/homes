import { supabase } from "@/integrations/supabase/client";

interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingProperty?: string;
  existingUnitId?: string;
}

/**
 * Check if a unit number already exists for any property owned by the same landlord
 * This ensures global uniqueness of unit numbers per landlord for payment matching
 */
export async function checkDuplicateUnitNumber(
  unitNumber: string,
  landlordId: string,
  excludeUnitId?: string
): Promise<DuplicateCheckResult> {
  try {
    // Get all properties owned by this landlord
    const { data: properties, error: propertiesError } = await supabase
      .from("properties")
      .select("id, name")
      .eq("owner_id", landlordId);

    if (propertiesError) {
      console.error("Error fetching properties:", propertiesError);
      return { isDuplicate: false };
    }

    if (!properties || properties.length === 0) {
      return { isDuplicate: false };
    }

    const propertyIds = properties.map((p) => p.id);

    // Check if unit number exists in any of these properties
    let query = supabase
      .from("units")
      .select("id, unit_number, property_id")
      .in("property_id", propertyIds)
      .ilike("unit_number", unitNumber.trim());

    if (excludeUnitId) {
      query = query.neq("id", excludeUnitId);
    }

    const { data: existingUnits, error: unitsError } = await query;

    if (unitsError) {
      console.error("Error checking existing units:", unitsError);
      return { isDuplicate: false };
    }

    if (existingUnits && existingUnits.length > 0) {
      const existingUnit = existingUnits[0];
      const existingProperty = properties.find(
        (p) => p.id === existingUnit.property_id
      );

      return {
        isDuplicate: true,
        existingProperty: existingProperty?.name || "Unknown Property",
        existingUnitId: existingUnit.id,
      };
    }

    return { isDuplicate: false };
  } catch (error) {
    console.error("Error in checkDuplicateUnitNumber:", error);
    return { isDuplicate: false };
  }
}

/**
 * Check multiple unit numbers for duplicates at once (for bulk operations)
 */
export async function checkDuplicateUnitNumbers(
  unitNumbers: string[],
  landlordId: string
): Promise<Map<string, DuplicateCheckResult>> {
  const results = new Map<string, DuplicateCheckResult>();

  try {
    // Get all properties owned by this landlord
    const { data: properties, error: propertiesError } = await supabase
      .from("properties")
      .select("id, name")
      .eq("owner_id", landlordId);

    if (propertiesError || !properties || properties.length === 0) {
      // No properties, no duplicates possible
      unitNumbers.forEach((num) => results.set(num.toLowerCase(), { isDuplicate: false }));
      return results;
    }

    const propertyIds = properties.map((p) => p.id);

    // Get all units for these properties
    const { data: existingUnits, error: unitsError } = await supabase
      .from("units")
      .select("id, unit_number, property_id")
      .in("property_id", propertyIds);

    if (unitsError) {
      console.error("Error checking existing units:", unitsError);
      unitNumbers.forEach((num) => results.set(num.toLowerCase(), { isDuplicate: false }));
      return results;
    }

    // Create a map of existing unit numbers (lowercase for case-insensitive matching)
    const existingUnitMap = new Map<string, { id: string; propertyId: string }>();
    existingUnits?.forEach((unit) => {
      existingUnitMap.set(unit.unit_number.toLowerCase().trim(), {
        id: unit.id,
        propertyId: unit.property_id,
      });
    });

    // Check each requested unit number
    unitNumbers.forEach((unitNumber) => {
      const normalized = unitNumber.toLowerCase().trim();
      const existing = existingUnitMap.get(normalized);

      if (existing) {
        const property = properties.find((p) => p.id === existing.propertyId);
        results.set(normalized, {
          isDuplicate: true,
          existingProperty: property?.name || "Unknown Property",
          existingUnitId: existing.id,
        });
      } else {
        results.set(normalized, { isDuplicate: false });
      }
    });

    return results;
  } catch (error) {
    console.error("Error in checkDuplicateUnitNumbers:", error);
    unitNumbers.forEach((num) => results.set(num.toLowerCase(), { isDuplicate: false }));
    return results;
  }
}
