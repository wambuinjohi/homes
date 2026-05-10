import { supabase } from "@/integrations/supabase/client";

export async function createSampleTenantNoLease() {
  const ts = Date.now();
  const tenantData = {
    first_name: "Jane",
    last_name: "Test",
    email: `jane.test+${ts}@example.com`,
    phone: "+254700000111",
    national_id: "12345678",
    employment_status: "Employed",
    profession: "QA",
    employer_name: "Sample Co",
    monthly_income: 50000,
    emergency_contact_name: "John Test",
    emergency_contact_phone: "+254700000112",
    previous_address: "Nairobi"
  };

  const { data: inserted, error } = await supabase
    .from('tenants')
    .insert({
      first_name: tenantData.first_name,
      last_name: tenantData.last_name,
      email: tenantData.email,
      phone: tenantData.phone,
      national_id: tenantData.national_id,
      employment_status: tenantData.employment_status,
      profession: tenantData.profession,
      employer_name: tenantData.employer_name,
      monthly_income: tenantData.monthly_income,
      emergency_contact_name: tenantData.emergency_contact_name,
      emergency_contact_phone: tenantData.emergency_contact_phone,
      previous_address: tenantData.previous_address
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    success: true,
    tenant: inserted,
    isNewUser: false,
    communicationStatus: { emailSent: false, smsSent: false, errors: [] }
  } as const;
}
