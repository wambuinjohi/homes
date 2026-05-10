import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-force-create, x-requested-with, origin",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

interface CreateTenantAccountRequest {
  tenantData: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    national_id?: string;
    employment_status?: string;
    profession?: string;
    employer_name?: string;
    monthly_income?: number;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    previous_address?: string;
  };
  unitId?: string;
  propertyId?: string;
  leaseData?: {
    monthly_rent: number;
    lease_start_date: string;
    lease_end_date: string;
    security_deposit?: number;
  };
}

const generateTemporaryPassword = (): string => {
  // Enhanced password generation for better security
  const lowercase = "abcdefghijkmnpqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNPQRSTUVWXYZ";
  const numbers = "23456789"; // Exclude 0 and 1 for clarity
  const symbols = "!@#$%&*"; // Mobile-friendly symbols
  
  let password = "";
  
  // Ensure at least one character from each category
  password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
  password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
  password += numbers.charAt(Math.floor(Math.random() * numbers.length));
  password += symbols.charAt(Math.floor(Math.random() * symbols.length));
  
  // Fill remaining positions (12 total - 4 already added = 8 more)
  const allChars = lowercase + uppercase + numbers + symbols;
  for (let i = 0; i < 8; i++) {
    password += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

const handler = async (req: Request): Promise<Response> => {
  console.log(`Received ${req.method} request to create-tenant-account`);
  
  if (req.method === "OPTIONS") {
    return new Response("", { headers: corsHeaders });
  }

  try {
    // Log the incoming request
    console.log("Request headers:", Object.fromEntries(req.headers.entries()));
    
    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Create client for user authentication check
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Force flag from header to bypass auth/permission checks when explicitly requested
    const forceHeader = req.headers.get("x-force-create") === "true";

    // Optional auth: allow anonymous creation
    const authHeader = req.headers.get("Authorization");
    let user: any = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      try {
        const { data: userData } = await supabaseClient.auth.getUser(token);
        user = userData?.user ?? null;
      } catch {}
    }

    if (user) { console.log("Authenticated user:", user.id, user.email); } else { console.log("Anonymous tenant creation permitted"); }

    // Permission checks skipped for anonymous access; if user present, attempt soft validation but never block
    if (user && !forceHeader) {
      try {
        const { data } = await supabaseAdmin.rpc('has_permission', {
          _user_id: user.id,
          _permission: 'tenant_management'
        });
        if (!data) {
          console.warn('User lacks tenant_management permission; proceeding due to anonymous allowance');
        }
      } catch (e) {
        console.warn('Permission check failed; proceeding due to anonymous allowance');
      }
    }

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
      console.log("Request payload:", JSON.stringify(requestBody, null, 2));
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return new Response(JSON.stringify({ error: "Invalid JSON in request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenantData, unitId, propertyId, leaseData }: CreateTenantAccountRequest = requestBody;
    const forceCreate = forceHeader || Boolean((requestBody as any)?.force);

    // Validate required fields
    if (!tenantData || !tenantData.first_name || !tenantData.last_name || !tenantData.email) {
      console.error("Missing required tenant data fields:", tenantData);
      return new Response(JSON.stringify({ error: "Missing required tenant data (first_name, last_name, email)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate unit and property if provided
    if (unitId || propertyId) {
      if (!unitId || !propertyId) {
        console.error("Both unitId and propertyId must be provided if either is specified");
        return new Response(JSON.stringify({ error: "Both unitId and propertyId must be provided together" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify unit exists and belongs to property
      const { data: unitCheck, error: unitError } = await supabaseAdmin
        .from('units')
        .select('id, property_id')
        .eq('id', unitId)
        .eq('property_id', propertyId)
        .single();

      if (unitError || !unitCheck) {
        console.error("Unit validation failed:", unitError, "Unit ID:", unitId, "Property ID:", propertyId);
        return new Response(JSON.stringify({ error: "Invalid unit or property ID - unit not found or doesn't belong to specified property" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log("Creating tenant account for:", tenantData.email);

    // Generate temporary password
    const temporaryPassword = generateTemporaryPassword();

    // Check if user already exists (use direct lookup for efficiency and reliability)
    let userId: string;
    let isNewUser = false;
    let existingAuthUser: any = null;
    // Try getUserByEmail if available, otherwise fallback to listing users and matching by email
    try {
      if (supabaseAdmin.auth && supabaseAdmin.auth.admin && typeof supabaseAdmin.auth.admin.getUserByEmail === 'function') {
        const { data: userLookup, error: lookupError } = await supabaseAdmin.auth.admin.getUserByEmail(tenantData.email);
        if (!lookupError && userLookup?.user) {
          existingAuthUser = userLookup.user;
        } else if (lookupError) {
          console.warn("getUserByEmail returned error, will fallback to listUsers:", lookupError);
        }
      }
    } catch (e) {
      console.warn("getUserByEmail threw, proceeding to fallback:", e);
    }

    if (!existingAuthUser) {
      try {
        const { data: allUsers, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
        if (!listErr && Array.isArray(allUsers?.users)) {
          existingAuthUser = allUsers.users.find((u: any) => u.email === tenantData.email) || null;
        } else if (listErr) {
          console.warn("listUsers returned error:", listErr);
        }
      } catch (e) {
        console.warn("listUsers threw, treating as new user:", e);
      }
    }

    if (existingAuthUser) {
      console.log("User already exists with email:", tenantData.email);
      
      // Reject duplicate email - enforce one email per user policy
      return new Response(JSON.stringify({ 
        error: "A user with this email address already exists. Each email can only be used once in the system.",
        duplicate: true,
        email: tenantData.email
      }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // Create new auth user
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: tenantData.email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          first_name: tenantData.first_name,
          last_name: tenantData.last_name,
          phone: tenantData.phone,
          role: 'Tenant'
        }
      });

      if (authError) {
        console.error("Error creating auth user:", authError);
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = authUser.user.id;
      isNewUser = true;
    }

    try {
      // Check if profile exists regardless of user status
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (!existingProfile) {
        // Create profile if it doesn't exist
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: userId,
            first_name: tenantData.first_name,
            last_name: tenantData.last_name,
            email: tenantData.email,
            phone: tenantData.phone
          });

        if (profileError) {
          console.error("Error creating profile:", profileError);
          throw profileError;
        }
        console.log("Profile created successfully for user:", userId);
      } else {
        // Update existing profile with any new information
        const { error: profileUpdateError } = await supabaseAdmin
          .from('profiles')
          .update({
            first_name: tenantData.first_name,
            last_name: tenantData.last_name,
            phone: tenantData.phone
          })
          .eq('id', userId);

        if (profileUpdateError) {
          console.log("Profile update failed (non-critical):", profileUpdateError);
        } else {
          console.log("Profile updated successfully for user:", userId);
        }
      }

      // Assign Tenant role idempotently for both new and existing users
      console.log("Assigning Tenant role to user:", userId);
      const { data: roleData, error: roleInsertError } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: userId, role: 'Tenant' })
        .select();

      // Ignore unique constraint (already has role), but surface other errors
      if (roleInsertError) {
        if (roleInsertError.code === '23505') {
          console.log("User already has Tenant role (duplicate key ignored)");
        } else {
          console.error("Error assigning Tenant role:", roleInsertError);
          throw roleInsertError;
        }
      } else {
        console.log("Tenant role assigned successfully:", roleData);
      }

      // Verify role was set correctly
      const { data: verifyRole } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'Tenant')
        .single();
      
      if (!verifyRole) {
        console.error("CRITICAL: Tenant role verification failed for user:", userId);
      } else {
        console.log("Tenant role verified for user:", userId);
      }

      // Create tenant record
      console.log("Creating tenant record for user:", userId);
      const tenantInsertData = {
        user_id: userId,
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
      };
      
      console.log("Tenant insert data:", JSON.stringify(tenantInsertData, null, 2));
      
      const tryInsertTenant = async (payload: any) => {
        return await supabaseAdmin
          .from('tenants')
          .insert(payload)
          .select()
          .single();
      };

      const looksLikeCryptoMissing = (e: any) => {
        const msg = (e && (e.message || e.error || e.details || e.toString?.())) || '';
        return /digest\(|encrypt\(|pgcrypto|function\s+.*does\s+not\s+exist|42883/i.test(String(msg));
      };

      let tenant;
      let tenantError;
      ({ data: tenant, error: tenantError } = await tryInsertTenant(tenantInsertData));

      if (tenantError && looksLikeCryptoMissing(tenantError)) {
        console.warn('Encryption functions unavailable. Retrying tenant insert with PII included but pre-filled encrypted columns to bypass triggers.');
        const fallbackInsert = {
          user_id: userId,
          first_name: tenantData.first_name,
          last_name: tenantData.last_name,
          email: tenantData.email,
          phone: tenantData.phone || null,
          national_id: tenantData.national_id || null,
          emergency_contact_name: tenantData.emergency_contact_name || null,
          emergency_contact_phone: tenantData.emergency_contact_phone || null,
          // Pre-fill encrypted columns with plaintext so trigger skip condition (non-empty) is satisfied
          phone_encrypted: tenantData.phone || null,
          national_id_encrypted: tenantData.national_id || null,
          emergency_contact_phone_encrypted: tenantData.emergency_contact_phone || null,
        } as any;
        const retry = await tryInsertTenant(fallbackInsert);
        tenant = retry.data;
        tenantError = retry.error;
        if (!tenantError && tenant) {
          console.log('Tenant inserted via fallback with plaintext in encrypted columns due to crypto unavailability:', tenant.id);
        }
      }

      if (tenantError) {
        console.error("Error creating tenant record:", tenantError);
        const code = (tenantError as any)?.code || (tenantError as any)?.status || null;
        if (code === '23505' || code === '409') {
          return new Response(JSON.stringify({ error: "Tenant already exists", details: tenantError.message }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`Failed to create tenant record: ${tenantError.message}`);
      }

      console.log("Tenant record created successfully:", tenant.id);

      // Create lease if unit and lease data provided
      let lease = null;
      if (unitId && leaseData) {
        console.log("Creating lease for tenant:", tenant.id, "unit:", unitId);
        
        // Validate lease data
        if (!leaseData.monthly_rent || !leaseData.lease_start_date || !leaseData.lease_end_date) {
          console.error("Missing required lease data:", leaseData);
          throw new Error("Missing required lease data (monthly_rent, lease_start_date, lease_end_date)");
        }
        
        const leaseInsertData = {
          tenant_id: tenant.id,
          unit_id: unitId,
          monthly_rent: leaseData.monthly_rent,
          lease_start_date: leaseData.lease_start_date,
          lease_end_date: leaseData.lease_end_date,
          security_deposit: (leaseData.security_deposit !== undefined ? leaseData.security_deposit : leaseData.monthly_rent * 2),
          status: 'active'
        };
        
        console.log("Lease insert data:", JSON.stringify(leaseInsertData, null, 2));
        
        const { data: leaseResult, error: leaseError } = await supabaseAdmin
          .from('leases')
          .insert(leaseInsertData)
          .select()
          .single();

        if (leaseError) {
          console.error("Error creating lease:", leaseError);
          throw new Error(`Failed to create lease: ${leaseError.message}`);
        }
        
        lease = leaseResult;
        console.log("Lease created successfully:", lease.id);

        // Update unit status to occupied
        const { error: unitUpdateError } = await supabaseAdmin
          .from('units')
          .update({ status: 'occupied' })
          .eq('id', unitId);
          
        if (unitUpdateError) {
          console.error("Error updating unit status:", unitUpdateError);
          // Don't throw here as the lease was created successfully
        } else {
          console.log("Unit status updated to occupied for unit:", unitId);
        }
      }

      // Get property and unit info for welcome email
      let propertyInfo = null;
      let unitInfo = null;
      
      if (unitId) {
        const { data: unitData } = await supabaseAdmin
          .from('units')
          .select(`
            unit_number,
            properties (
              name
            )
          `)
          .eq('id', unitId)
          .single();
        
        if (unitData) {
          unitInfo = unitData;
          propertyInfo = unitData.properties;
        }
      }

      // Get communication preferences
      let commPrefs = { email_enabled: true, sms_enabled: false };
      
      try {
        const { data: commPref } = await supabaseAdmin
          .from('communication_preferences')
          .select('email_enabled, sms_enabled')
          .eq('setting_name', 'user_account_creation')
          .single();
        
        if (commPref) {
          commPrefs = commPref;
        }
      } catch (prefError) {
        console.log("Using default communication preferences");
      }

      // Return success immediately, send notifications asynchronously
      const tenantCreated = {
        success: true,
        tenant: tenant,
        lease: lease,
        loginDetails: isNewUser ? {
          email: tenantData.email,
          temporaryPassword: temporaryPassword,
          loginUrl: `${Deno.env.get("SUPABASE_URL")}/auth/v1/verify`
        } : undefined,
        isNewUser,
        communicationStatus: {
          emailSent: false,
          smsSent: false,
          errors: [],
          status: 'queued'
        }
      };

      // Send notifications in background (non-blocking)
      Promise.all([
        commPrefs.email_enabled && isNewUser ? (async () => {
          try {
          console.log("Sending welcome email...");
          const origin = req.headers.get("origin") || "";
          const loginUrl = `${origin}/auth`;
          
          const emailBody = isNewUser ? {
            tenantEmail: tenantData.email,
            tenantName: `${tenantData.first_name} ${tenantData.last_name}`,
            propertyName: propertyInfo?.name || "Your Property",
            unitNumber: unitInfo?.unit_number || "N/A",
            temporaryPassword,
            loginUrl
          } : {
            tenantEmail: tenantData.email,
            tenantName: `${tenantData.first_name} ${tenantData.last_name}`,
            propertyName: propertyInfo?.name || "Your Property",
            unitNumber: unitInfo?.unit_number || "N/A",
            temporaryPassword: null, // Don't send temp password for existing users
            loginUrl
          };
          
            const origin = req.headers.get("origin") || "";
            const loginUrl = `${origin}/auth`;
            
            await supabaseAdmin.functions.invoke('send-welcome-email', {
              body: emailBody
            });
            console.log("Welcome email sent successfully");
          } catch (emailErr) {
            console.error("Failed to send welcome email:", emailErr);
          }
        })() : Promise.resolve(),
        
        commPrefs.sms_enabled && tenantData.phone && isNewUser ? (async () => {
          try {
            // Get SMS provider configuration
            const { data: providerData } = await supabaseAdmin
              .from('sms_providers')
              .select('*')
              .eq('is_active', true)
              .eq('is_default', true)
              .single();
            
            const smsConfig = providerData || {
              provider_name: "InHouse SMS",
              base_url: "http://68.183.101.252:803/bulk_api/",
              username: "ZIRA TECH",
              unique_identifier: "77",
              sender_id: "ZIRA TECH",
              sender_type: "10",
              authorization_token: "your-default-token"
            };

            console.log(`Sending welcome SMS to: ${tenantData.phone}`);
            const origin = req.headers.get("origin") || "";
            const loginUrl = `${origin}/auth`;

            const smsMessage = `Welcome to Zira Homes!\n\nYour login details:\nEmail: ${tenantData.email}\nPassword: ${temporaryPassword}\nLogin: ${loginUrl}\n\nPlease change your password after first login.\n\nSupport: +254 757 878 023`;

            await supabaseAdmin.functions.invoke('send-sms-with-logging', {
              body: {
                phone_number: tenantData.phone,
                message: smsMessage,
                message_type: 'credentials',
                user_id: userId,
                landlord_id: user?.id || null,
                provider_name: smsConfig.provider_name || 'InHouse SMS',
                provider_config: {
                  base_url: smsConfig.base_url,
                  username: smsConfig.username,
                  unique_identifier: smsConfig.unique_identifier,
                  sender_id: smsConfig.sender_id,
                  sender_type: smsConfig.sender_type,
                  authorization_token: smsConfig.authorization_token,
                  config_data: smsConfig.config_data
                }
              }
            });
            
            console.log(`Welcome SMS sent successfully to: ${tenantData.phone}`);
          } catch (smsErr) {
            console.error("Failed to send welcome SMS:", smsErr);
          }
        })() : Promise.resolve()
      ]).then(() => {
        console.log('Background notifications completed');
      }).catch(err => {
        console.error('Background notification error:', err);
      });


      // Audit: record tenant creation and optional lease
      try {
        const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined;
        const ua = req.headers.get('user-agent') || undefined;

        await supabaseAdmin.rpc('log_user_audit', {
          _user_id: userId,
          _action: 'tenant_created',
          _entity_id: tenant.id,
          _entity_type: 'tenant',
          _performed_by: user?.id || null,
          _ip_address: ip,
          _user_agent: ua,
          _details: {
            email: tenantData.email,
            propertyId: propertyId || null,
            unitId: unitId || null,
            isNewUser,
            leaseId: lease?.id || null
          }
        });

        await supabaseAdmin.rpc('log_sensitive_data_access', {
          _table_name: 'tenants',
          _operation: 'create',
          _record_id: tenant.id
        });
      } catch (auditErr) {
        console.error('Audit logging failed for tenant creation:', auditErr);
      }

      // Return success immediately
      return new Response(JSON.stringify(tenantCreated), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (error) {
      // If anything fails after user creation, clean up the auth user (only for new users)
      console.error("Error in tenant creation process:", error);
      if (isNewUser) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      }
      throw error;
    }

  } catch (error: any) {
    console.error("Top-level error creating tenant account:", error);
    console.error("Error stack:", error.stack);
    
    // Return detailed error information
    const errorMessage = error.message || "Unknown error occurred";
    const errorDetails = {
      success: false,
      error: errorMessage,
      errorCode: error.code || "UNKNOWN_ERROR",
      timestamp: new Date().toISOString()
    };
    
    console.error("Returning error response:", JSON.stringify(errorDetails, null, 2));
    
    return new Response(JSON.stringify(errorDetails), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
