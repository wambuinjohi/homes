import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to decode Base64 Basic Auth credentials
function decodeBasicAuth(authHeader: string): { username: string; password: string } | null {
  try {
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return null;
    }
    const base64Credentials = authHeader.substring(6);
    const credentials = atob(base64Credentials);
    const [username, password] = credentials.split(':');
    return { username, password };
  } catch (error) {
    console.error('Error decoding Basic Auth:', error);
    return null;
  }
}

// Helper to validate IPN authentication against landlord config
async function validateIpnAuth(
  supabase: any, 
  credentials: { username: string; password: string },
  landlordId: string
): Promise<boolean> {
  try {
    const { data: config, error } = await supabase
      .from('landlord_jenga_configs')
      .select('ipn_username, ipn_password_encrypted')
      .eq('landlord_id', landlordId)
      .eq('is_active', true)
      .single();

    if (error || !config) {
      console.log('No landlord config found for IPN validation');
      return false;
    }

    // If no IPN auth configured, allow (backwards compatibility)
    if (!config.ipn_username && !config.ipn_password_encrypted) {
      console.log('No IPN auth configured for landlord, allowing request');
      return true;
    }

    // Validate credentials
    const usernameMatch = config.ipn_username === credentials.username;
    // Note: In production, decrypt ipn_password_encrypted before comparison
    const passwordMatch = config.ipn_password_encrypted === credentials.password;

    return usernameMatch && passwordMatch;
  } catch (error) {
    console.error('Error validating IPN auth:', error);
    return false;
  }
}

// Helper to normalize unit number for matching (case-insensitive, trim whitespace)
function normalizeUnitNumber(unitNumber: string): string {
  return unitNumber.trim().toLowerCase().replace(/\s+/g, '');
}

// NEW: Resolve by unit number (MERCHANTCODE-UNITNUMBER format)
async function resolveByUnitNumber(
  supabase: any,
  billNumber: string,
  amount: number
): Promise<{ 
  landlordId: string | null; 
  invoiceId: string | null; 
  invoice: any; 
  matchType: string;
  lease: any;
}> {
  let landlordId: string | null = null;
  let invoiceId: string | null = null;
  let invoice: any = null;
  let matchType = 'none';
  let lease: any = null;

  if (!billNumber) {
    return { landlordId, invoiceId, invoice, matchType, lease };
  }

  console.log('Resolving by unit number from bill number:', billNumber);

  // Parse MERCHANTCODE-UNITNUMBER format
  let merchantCode: string | null = null;
  let unitNumber: string = billNumber;

  if (billNumber.includes('-')) {
    const parts = billNumber.split('-');
    merchantCode = parts[0];
    unitNumber = parts.slice(1).join('-'); // Handle unit numbers with dashes
  }

  console.log('Parsed:', { merchantCode, unitNumber });

  // Step 1: Find landlord by merchant code
  if (merchantCode) {
    const { data: landlordConfig, error: configError } = await supabase
      .from('landlord_jenga_configs')
      .select('landlord_id')
      .eq('merchant_code', merchantCode)
      .eq('is_active', true)
      .single();

    if (!configError && landlordConfig) {
      landlordId = landlordConfig.landlord_id;
      console.log('Found landlord by merchant code:', landlordId);
    } else {
      console.log('No landlord found for merchant code:', merchantCode);
      return { landlordId, invoiceId, invoice, matchType: 'no_merchant', lease };
    }
  }

  // Step 2: Find unit by unit number (within landlord's properties)
  const normalizedUnitNumber = normalizeUnitNumber(unitNumber);
  
  let unitQuery = supabase
    .from('units')
    .select(`
      id,
      unit_number,
      properties!inner(
        id,
        owner_id,
        name
      )
    `)
    .ilike('unit_number', unitNumber);

  // If we have a landlord, filter by their properties
  if (landlordId) {
    unitQuery = unitQuery.eq('properties.owner_id', landlordId);
  }

  const { data: units, error: unitError } = await unitQuery;

  if (unitError || !units || units.length === 0) {
    console.log('No unit found for unit number:', unitNumber);
    return { landlordId, invoiceId, invoice, matchType: 'no_unit', lease };
  }

  // Handle multiple units with same number (shouldn't happen if landlord is specified)
  const unit = units[0];
  if (!landlordId) {
    landlordId = unit.properties?.owner_id || null;
  }

  console.log('Found unit:', unit.id, 'for property:', unit.properties?.name);

  // Step 3: Find active lease for this unit
  const { data: leases, error: leaseError } = await supabase
    .from('leases')
    .select(`
      id,
      tenant_id,
      monthly_rent,
      status
    `)
    .eq('unit_id', unit.id)
    .eq('status', 'active')
    .limit(1);

  if (leaseError || !leases || leases.length === 0) {
    console.log('No active lease found for unit:', unit.id);
    return { landlordId, invoiceId, invoice, matchType: 'no_lease', lease };
  }

  lease = leases[0];
  console.log('Found active lease:', lease.id, 'for tenant:', lease.tenant_id);

  // Step 4: Find pending invoices for this tenant/lease
  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select(`
      id,
      tenant_id,
      lease_id,
      invoice_number,
      amount,
      status,
      due_date
    `)
    .eq('lease_id', lease.id)
    .eq('status', 'pending')
    .order('due_date', { ascending: true });

  if (invoicesError || !invoices || invoices.length === 0) {
    console.log('No pending invoices found for lease:', lease.id);
    return { landlordId, invoiceId, invoice, matchType: 'no_pending_invoices', lease };
  }

  console.log('Found', invoices.length, 'pending invoices');

  // Step 5: Match by amount or take oldest pending invoice
  if (invoices.length === 1) {
    invoice = invoices[0];
    invoiceId = invoice.id;
    matchType = 'unit_single_invoice';
    console.log('Single pending invoice matched:', invoiceId);
  } else {
    // Multiple invoices - try to match by exact amount
    const exactMatch = invoices.find((inv: any) => parseFloat(inv.amount) === parseFloat(amount.toString()));
    
    if (exactMatch) {
      invoice = exactMatch;
      invoiceId = exactMatch.id;
      matchType = 'unit_amount_match';
      console.log('Invoice matched by exact amount:', invoiceId);
    } else {
      // Take oldest pending invoice (first due)
      invoice = invoices[0];
      invoiceId = invoice.id;
      matchType = 'unit_oldest_invoice';
      console.log('Using oldest pending invoice:', invoiceId);
    }
  }

  return { landlordId, invoiceId, invoice, matchType, lease };
}

// Legacy: Resolve landlord and invoice from invoice number (bill number)
async function resolveFromInvoiceNumber(
  supabase: any,
  billNumber: string
): Promise<{ landlordId: string | null; invoiceId: string | null; invoice: any }> {
  let landlordId: string | null = null;
  let invoiceId: string | null = null;
  let invoice: any = null;

  if (!billNumber) {
    return { landlordId, invoiceId, invoice };
  }

  console.log('Resolving by invoice number:', billNumber);

  // Try to find invoice by invoice_number (exact match)
  const { data: invoiceData, error: invoiceError } = await supabase
    .from('invoices')
    .select(`
      id, 
      tenant_id, 
      lease_id, 
      invoice_number,
      amount,
      status,
      leases!inner(
        id,
        units!inner(
          id,
          properties!inner(
            id,
            owner_id
          )
        )
      )
    `)
    .eq('invoice_number', billNumber)
    .single();

  if (!invoiceError && invoiceData) {
    invoiceId = invoiceData.id;
    landlordId = invoiceData.leases?.units?.properties?.owner_id || null;
    invoice = invoiceData;
    console.log('Found invoice by exact match:', { invoiceId, landlordId });
    return { landlordId, invoiceId, invoice };
  }

  // Try partial match - bill number might contain invoice number
  const { data: invoices, error: searchError } = await supabase
    .from('invoices')
    .select(`
      id, 
      tenant_id, 
      lease_id, 
      invoice_number,
      amount,
      status,
      leases!inner(
        id,
        units!inner(
          id,
          properties!inner(
            id,
            owner_id
          )
        )
      )
    `)
    .ilike('invoice_number', `%${billNumber}%`)
    .eq('status', 'pending')
    .limit(1);

  if (!searchError && invoices && invoices.length > 0) {
    const foundInvoice = invoices[0];
    invoiceId = foundInvoice.id;
    landlordId = foundInvoice.leases?.units?.properties?.owner_id || null;
    invoice = foundInvoice;
    console.log('Found invoice by partial match:', { invoiceId, landlordId });
    return { landlordId, invoiceId, invoice };
  }

  return { landlordId, invoiceId, invoice };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get client IP for security logging
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip')?.trim() || 
                     req.headers.get('cf-connecting-ip')?.trim() ||
                     'unknown';
    
    console.log('=== JENGA IPN CALLBACK RECEIVED ===');
    console.log('Jenga IPN from IP:', clientIP);

    // Parse request body
    const ipnData = await req.json()
    console.log('Raw IPN Data:', JSON.stringify(ipnData, null, 2));

    // Validate IPN structure
    if (!ipnData.callbackType || !ipnData.transaction) {
      console.error('Invalid IPN format - missing required fields');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid IPN format' 
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract IPN data
    const { callbackType, customer, transaction, bank } = ipnData;
    
    const billNumber = transaction.billNumber || '';
    const customerRef = customer?.reference || '';
    const transactionAmount = parseFloat(transaction.amount) || 0;
    
    console.log('Parsing references:', { billNumber, customerRef, transactionAmount });
    
    // NEW MATCHING PRIORITY:
    // 1. Try unit-based matching (MERCHANTCODE-UNITNUMBER)
    // 2. Fall back to invoice number matching (legacy)
    
    let landlordId: string | null = null;
    let invoiceId: string | null = null;
    let invoice: any = null;
    let matchType = 'none';
    let lease: any = null;

    // Try unit-based matching first
    const unitResult = await resolveByUnitNumber(supabase, billNumber, transactionAmount);
    
    if (unitResult.invoiceId) {
      landlordId = unitResult.landlordId;
      invoiceId = unitResult.invoiceId;
      invoice = unitResult.invoice;
      matchType = unitResult.matchType;
      lease = unitResult.lease;
      console.log('Matched by unit:', { matchType, invoiceId, landlordId });
    } else if (unitResult.landlordId && !unitResult.invoiceId) {
      // We found landlord/unit but no invoice - store for manual allocation
      landlordId = unitResult.landlordId;
      matchType = unitResult.matchType;
      lease = unitResult.lease;
      console.log('Partial match by unit (no invoice):', { matchType, landlordId });
    } else {
      // Fall back to invoice number matching
      const invoiceResult = await resolveFromInvoiceNumber(supabase, billNumber);
      
      if (invoiceResult.invoiceId) {
        landlordId = invoiceResult.landlordId;
        invoiceId = invoiceResult.invoiceId;
        invoice = invoiceResult.invoice;
        matchType = 'invoice_number';
        console.log('Matched by invoice number:', { invoiceId, landlordId });
      } else if (customerRef) {
        // Try customer reference as invoice number
        const refResult = await resolveFromInvoiceNumber(supabase, customerRef);
        landlordId = refResult.landlordId;
        invoiceId = refResult.invoiceId;
        invoice = refResult.invoice;
        if (refResult.invoiceId) {
          matchType = 'customer_reference';
        }
      }
    }

    // Validate Basic Auth if landlord is identified
    const authHeader = req.headers.get('Authorization');
    const credentials = decodeBasicAuth(authHeader || '');
    
    if (landlordId && credentials) {
      const isValidAuth = await validateIpnAuth(supabase, credentials, landlordId);
      if (!isValidAuth) {
        console.error('IPN authentication failed for landlord:', landlordId);
        await supabase.rpc('log_security_event', {
          _event_type: 'unauthorized_access',
          _details: {
            source: 'jenga_ipn_callback',
            action: 'auth_failed',
            landlord_id: landlordId,
            ip: clientIP,
            timestamp: new Date().toISOString()
          },
          _ip_address: clientIP
        });
        
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Unauthorized' 
        }), { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      console.log('IPN authentication validated successfully');
    } else if (!credentials && landlordId) {
      const { data: config } = await supabase
        .from('landlord_jenga_configs')
        .select('ipn_username')
        .eq('landlord_id', landlordId)
        .eq('is_active', true)
        .single();
      
      if (config?.ipn_username) {
        console.error('IPN authentication required but not provided');
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Authentication required' 
        }), { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Store the IPN callback with full data
    const { data: callback, error: insertError } = await supabase
      .from('jenga_ipn_callbacks')
      .insert({
        callback_type: callbackType,
        customer_name: customer?.name,
        customer_mobile: customer?.mobileNumber,
        customer_reference: customerRef,
        transaction_date: transaction.date,
        transaction_reference: transaction.reference,
        payment_mode: transaction.paymentMode,
        amount: transactionAmount,
        bill_number: billNumber,
        served_by: transaction.servedBy,
        additional_info: transaction.additionalInfo,
        order_amount: transaction.orderAmount,
        service_charge: transaction.serviceCharge,
        status: transaction.status,
        remarks: transaction.remarks,
        bank_reference: bank?.reference,
        transaction_type: bank?.transactionType,
        bank_account: bank?.account,
        landlord_id: landlordId,
        invoice_id: invoiceId,
        raw_data: ipnData,
        ip_address: clientIP,
        processed: false
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error storing IPN callback:', insertError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to store callback' 
      }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('IPN callback stored successfully:', callback.id, 'matchType:', matchType);

    // Process successful payments
    if (transaction.status === 'SUCCESS' && invoiceId) {
      console.log('Processing successful payment for invoice:', invoiceId);
      
      try {
        // Update invoice status
        const { error: updateError } = await supabase
          .from('invoices')
          .update({
            status: 'paid',
            updated_at: new Date().toISOString()
          })
          .eq('id', invoiceId)
          .eq('status', 'pending');

        if (updateError) {
          console.error('Error updating invoice:', updateError);
        } else {
          console.log('Invoice marked as paid:', invoiceId);
          
          // Create payment record
          if (invoice) {
            await supabase
              .from('payments')
              .insert({
                tenant_id: invoice.tenant_id,
                lease_id: invoice.lease_id,
                invoice_id: invoiceId,
                amount: transactionAmount,
                payment_date: new Date().toISOString().split('T')[0],
                payment_method: 'Jenga PAY',
                payment_reference: transaction.reference,
                transaction_id: bank?.reference || transaction.reference,
                status: 'completed',
                payment_type: 'rent',
                notes: `Jenga PAY via ${transaction.paymentMode || 'bank'}. Match: ${matchType}. Receipt: ${transaction.reference}`
              });
            
            console.log('Payment record created for invoice:', invoiceId);
          }

          // Mark callback as processed
          await supabase
            .from('jenga_ipn_callbacks')
            .update({
              processed: true,
              processed_at: new Date().toISOString()
            })
            .eq('id', callback.id);
        }

        // Send notification to landlord
        if (landlordId) {
          await supabase
            .from('notifications')
            .insert({
              user_id: landlordId,
              title: 'Payment Received via Jenga PAY',
              message: `Payment of KES ${transactionAmount.toLocaleString()} received. Customer: ${customer?.name || 'Unknown'}. Invoice: ${invoice?.invoice_number || 'N/A'}. Receipt: ${transaction.reference}`,
              type: 'payment',
              related_id: invoiceId,
              related_type: 'invoice'
            });
          console.log('Notification sent to landlord:', landlordId);
        }
      } catch (processingError) {
        console.error('Error processing payment:', processingError);
      }
    } else if (transaction.status !== 'SUCCESS') {
      console.log('Transaction not successful:', transaction.status, transaction.remarks);
      
      await supabase
        .from('jenga_ipn_callbacks')
        .update({
          processed: true,
          processed_at: new Date().toISOString()
        })
        .eq('id', callback.id);

      if (landlordId) {
        await supabase
          .from('notifications')
          .insert({
            user_id: landlordId,
            title: 'Payment Failed - Jenga PAY',
            message: `Payment of KES ${transactionAmount.toLocaleString()} failed. Status: ${transaction.status}. Reason: ${transaction.remarks || 'Unknown'}`,
            type: 'payment',
            related_id: invoiceId,
            related_type: 'invoice'
          });
      }
    } else {
      // Payment successful but no invoice matched - notify landlord for manual allocation
      console.log('Payment successful but no invoice matched. Bill number:', billNumber, 'Match type:', matchType);
      
      if (landlordId) {
        await supabase
          .from('notifications')
          .insert({
            user_id: landlordId,
            title: 'Unmatched Payment - Manual Allocation Required',
            message: `Payment of KES ${transactionAmount.toLocaleString()} received via Jenga PAY but needs manual allocation. Bill Number: ${billNumber}. Customer: ${customer?.name || 'Unknown'}. Please allocate in Unmatched Payments.`,
            type: 'payment',
            related_id: callback.id,
            related_type: 'jenga_callback'
          });
      }
    }

    // Log security event
    await supabase.rpc('log_security_event', {
      _event_type: 'data_access',
      _details: {
        source: 'jenga_ipn_callback',
        action: 'payment_notification_received',
        transaction_reference: transaction.reference,
        status: transaction.status,
        amount: transactionAmount,
        landlord_id: landlordId,
        invoice_id: invoiceId,
        bill_number: billNumber,
        match_type: matchType,
        ip: clientIP,
        timestamp: new Date().toISOString()
      },
      _ip_address: clientIP
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: 'IPN processed successfully',
      callback_id: callback.id,
      match_type: matchType
    }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Jenga IPN callback error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
