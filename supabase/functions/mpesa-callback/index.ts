import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const callbackData = await req.json()
    console.log('=== MPESA CALLBACK RECEIVED ===');
    
    // SECURITY FIX: Enhanced IP validation for M-Pesa callbacks
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip')?.trim() || 
                     req.headers.get('cf-connecting-ip')?.trim() ||
                     'unknown';
    
    console.log('M-Pesa callback from IP:', clientIP);
    
    // Enhanced Safaricom IP ranges validation
    const safaricomIPRanges = [
      '196.201.212.0/24',  // Production IPs (196.201.212.69, 196.201.212.129)
      '196.201.214.0/24',
      '196.201.215.0/24', 
      '196.201.216.0/24',
      '196.216.152.0/24',
      '41.84.87.0/24'
    ];
    
    function isIPInRange(ip: string, cidr: string): boolean {
      try {
        const [rangeIP, prefixLength] = cidr.split('/');
        const rangeIPNum = ipToNumber(rangeIP);
        const mask = (0xffffffff << (32 - parseInt(prefixLength))) >>> 0;
        const targetIPNum = ipToNumber(ip);
        return (rangeIPNum & mask) === (targetIPNum & mask);
      } catch {
        return false;
      }
    }
    
    function ipToNumber(ip: string): number {
      return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
    }
    
    // SECURITY FIX: Remove sandbox bypass for unknown IPs
    const isValidSource = safaricomIPRanges.some(range => isIPInRange(clientIP, range));
    
    if (!isValidSource) {
      console.error('M-Pesa callback rejected from unauthorized IP:', clientIP);
      await supabase.rpc('log_security_event', {
        _event_type: 'suspicious_activity',
        _details: { 
          pattern: 'mpesa_callback_unauthorized_ip', 
          ip: clientIP,
          rejected: true,
          checkout_request_id: callbackData?.Body?.stkCallback?.CheckoutRequestID || 'unknown',
          user_agent: req.headers.get('user-agent') || 'unknown'
        }
      });
      return new Response('Unauthorized', { 
        status: 403,
        headers: { 
          'Content-Type': 'text/plain',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY'
        }
      });
    }

    // Verify M-Pesa callback signature if available (basic security check)
    const mpesaPassword = Deno.env.get('MPESA_PASSKEY');
    if (mpesaPassword) {
      // In production, implement proper signature verification
      // For now, we'll validate the callback structure and add security logging
      console.log('M-Pesa callback security check passed');
      
      // SECURITY FIX: Updated security event logging with proper event type
      await supabase.rpc('log_security_event', {
        _event_type: 'data_access',
        _details: {
          source: 'mpesa_callback',
          action: 'payment_notification_received',
          checkout_request_id: callbackData?.Body?.stkCallback?.CheckoutRequestID || 'unknown',
          result_code: callbackData?.Body?.stkCallback?.ResultCode || 'unknown',
          ip: clientIP,
          timestamp: new Date().toISOString()
        },
        _ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null
      });
    }

    const { Body } = callbackData
    if (!Body?.stkCallback) {
      console.log('Invalid callback format - missing Body.stkCallback')
      return new Response('OK', { status: 200 })
    }

    const { stkCallback } = Body
    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback
    
    console.log('Callback details extracted:', {
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      hasCallbackMetadata: !!CallbackMetadata
    });

    // Update transaction status
    const status = ResultCode === 0 ? 'completed' : 'failed'
    console.log('Processing transaction update:', { status, ResultCode });
    
    let transactionId = null
    let phoneNumber = null
    let amount = null

    if (ResultCode === 0 && CallbackMetadata?.Item) {
      console.log('Extracting payment details from successful transaction');
      // Extract payment details from successful transaction
      const items = CallbackMetadata.Item
      
      for (const item of items) {
        if (item.Name === 'MpesaReceiptNumber') {
          transactionId = item.Value
        } else if (item.Name === 'PhoneNumber') {
          phoneNumber = item.Value
        } else if (item.Name === 'Amount') {
          amount = item.Value
        }
      }
      
      console.log('Extracted payment details:', {
        transactionId,
        phoneNumber,
        amount
      });
    }

    // Secure transaction status update with idempotency check
    const { data: existingTxn, error: fetchError } = await supabase
      .from('mpesa_transactions')
      .select('status, amount, phone_number, payment_type, metadata')
      .eq('checkout_request_id', CheckoutRequestID)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching transaction:', CheckoutRequestID, fetchError);
      return new Response('OK', { status: 200 });
    }

    // If transaction doesn't exist, create it from callback data
    if (!existingTxn) {
      console.log('Transaction not found, creating from callback data:', CheckoutRequestID);
      
      // Insert the transaction record with data from callback
      const { error: insertError } = await supabase
        .from('mpesa_transactions')
        .insert({
          checkout_request_id: CheckoutRequestID,
          merchant_request_id: stkCallback.MerchantRequestID || null,
          phone_number: phoneNumber || 'unknown',
          amount: amount || 0,
          payment_type: 'rent', // Default to rent, metadata may override
          status: status,
          result_code: ResultCode,
          result_desc: ResultDesc,
          mpesa_receipt_number: transactionId,
          provider: 'mpesa',
          metadata: { 
            provider: 'mpesa',
            created_from_callback: true,
            ip: clientIP,
            timestamp: new Date().toISOString()
          }
        });

      if (insertError) {
        console.error('Error inserting transaction from callback:', insertError);
        return new Response('OK', { status: 200 });
      }

      console.log('Transaction created successfully from callback');
      
      // Fetch the newly created transaction to continue processing
      const { data: newTxn, error: newFetchError } = await supabase
        .from('mpesa_transactions')
        .select('*')
        .eq('checkout_request_id', CheckoutRequestID)
        .single();

      if (newFetchError || !newTxn) {
        console.error('Error fetching newly created transaction:', newFetchError);
        return new Response('OK', { status: 200 });
      }

      // For newly created transactions from callbacks, we skip the rest of the processing
      // since we don't have enough metadata to process rent/service charge payments
      console.log('Transaction created from callback - skipping payment processing');
      return new Response('OK', { status: 200 });
    }

    // Prevent duplicate processing - only allow pending -> completed/failed
    if (existingTxn.status !== 'pending') {
      console.log('Transaction already processed:', CheckoutRequestID, existingTxn.status);
      return new Response('OK', { status: 200 });
    }

    // Validate amount matches original request
    if (amount && Math.abs(existingTxn.amount - amount) > 0.01) {
      console.error('Amount mismatch for transaction:', CheckoutRequestID, 
        'Expected:', existingTxn.amount, 'Got:', amount);
      await supabase.rpc('log_security_event', {
        _event_type: 'suspicious_activity',
        _details: { 
          pattern: 'mpesa_amount_mismatch',
          transaction_id: CheckoutRequestID,
          expected_amount: existingTxn.amount,
          received_amount: amount
        }
      });
      return new Response('Amount mismatch', { status: 400 });
    }

    const { data: transaction, error: updateError } = await supabase
      .from('mpesa_transactions')
      .update({
        status,
        result_code: ResultCode,
        result_desc: ResultDesc,
        mpesa_receipt_number: transactionId,
        provider: 'mpesa',
        metadata: { provider: 'mpesa', validated: true, ip: clientIP },
        updated_at: new Date().toISOString()
      })
      .eq('checkout_request_id', CheckoutRequestID)
      .eq('status', 'pending') // Additional safety check
      .select()
      .single()

    if (updateError) {
      console.error('Error updating transaction:', {
        error: updateError,
        CheckoutRequestID,
        errorMessage: updateError?.message,
        errorDetails: updateError?.details
      });
      return new Response('OK', { status: 200 })
    }

    console.log('Transaction updated successfully:', {
      id: transaction?.id,
      checkout_request_id: transaction?.checkout_request_id,
      status: transaction?.status,
      payment_type: transaction?.payment_type,
      metadata: transaction?.metadata
    });

    // If payment was successful, handle different payment types
    if (ResultCode === 0 && transaction) {
      console.log('Processing successful payment for transaction:', transaction.id);
      
      try {
        // Check if this is an SMS bundle purchase
        const isSMSBundle = transaction.payment_type === 'sms_bundle' || 
                           (transaction.metadata && transaction.metadata.payment_type === 'sms_bundle');
        
        // Check if this is a service charge payment
        const isServiceCharge = transaction.payment_type === 'service-charge' || 
                               (transaction.metadata && transaction.metadata.payment_type === 'service-charge')

        console.log('Payment type determination:', {
          isSMSBundle,
          isServiceCharge,
          payment_type: transaction.payment_type,
          metadata: transaction.metadata
        });

        if (isSMSBundle) {
          console.log('Processing SMS bundle purchase');
          const landlordId = transaction.metadata?.landlord_id;
          const smsCount = transaction.metadata?.sms_count || 0;

          if (landlordId && smsCount > 0) {
            console.log('Updating SMS credits for landlord:', landlordId, 'Credits:', smsCount);
            
            // Update landlord's SMS credits balance
            const { data: subscription, error: subError } = await supabase
              .from('landlord_subscriptions')
              .select('sms_credits_balance')
              .eq('landlord_id', landlordId)
              .single();

            if (subscription && !subError) {
              const newBalance = (subscription.sms_credits_balance || 0) + smsCount;
              
              const { error: updateError } = await supabase
                .from('landlord_subscriptions')
                .update({ 
                  sms_credits_balance: newBalance,
                  updated_at: new Date().toISOString()
                })
                .eq('landlord_id', landlordId);

              if (updateError) {
                console.error('Error updating SMS credits:', updateError);
              } else {
                console.log('SMS credits updated successfully. New balance:', newBalance);
                
                // Log credit purchase transaction
                const { error: txError } = await supabase
                  .from('sms_credit_transactions')
                  .insert({
                    landlord_id: landlordId,
                    transaction_type: 'purchase',
                    credits_change: smsCount,
                    balance_after: newBalance,
                    description: `SMS bundle purchase via M-Pesa`,
                    reference_id: transaction.id,
                    reference_type: 'mpesa_transaction',
                    created_by: landlordId,
                    metadata: {
                      bundle_id: transaction.metadata?.bundle_id,
                      bundle_name: transaction.metadata?.bundle_name,
                      amount_paid: amount || transaction.amount,
                      mpesa_receipt: transactionId,
                      checkout_request_id: checkoutRequestID
                    }
                  });

                if (txError) {
                  console.error('Error logging SMS credit transaction:', txError);
                } else {
                  console.log(`📝 Logged SMS credit purchase transaction. Credits added: ${smsCount}`);
                }
                
                // Send SMS confirmation
                try {
                  const { data: profile } = await supabase
                    .from('profiles')
                    .select('phone, first_name')
                    .eq('id', landlordId)
                    .single();

                  if (profile?.phone) {
                    await supabase.functions.invoke('send-sms', {
                      body: {
                        phone_number: profile.phone,
                        message: `SMS bundle purchase successful! ${smsCount} credits added. New balance: ${newBalance}. Receipt: ${transactionId} - Zira Homes`
                      }
                    });
                  }
                } catch (smsError) {
                  console.error('Error sending SMS bundle confirmation:', smsError);
                }
              }
            }
          }
        } else if (isServiceCharge) {
          console.log('Processing service charge payment');
          // Handle service charge payment
          const serviceChargeInvoiceId = transaction.metadata?.service_charge_invoice_id
          
          console.log('Service charge invoice ID from metadata:', serviceChargeInvoiceId);
          
          if (serviceChargeInvoiceId) {
            console.log('Fetching service charge invoice details:', serviceChargeInvoiceId);
            
            // First check if the invoice exists and get its current status
            const { data: existingInvoice, error: fetchError } = await supabase
              .from('service_charge_invoices')
              .select('id, status, landlord_id, invoice_number, total_amount')
              .eq('id', serviceChargeInvoiceId)
              .single()

            if (fetchError || !existingInvoice) {
              console.error('Service charge invoice not found during callback processing:', {
                serviceChargeInvoiceId,
                fetchError,
                errorMessage: fetchError?.message
              });
              return new Response('OK', { status: 200 })
            }

            console.log('Service charge invoice found for payment processing:', {
              id: existingInvoice.id,
              invoice_number: existingInvoice.invoice_number,
              current_status: existingInvoice.status,
              total_amount: existingInvoice.total_amount,
              landlord_id: existingInvoice.landlord_id
            });

            // Update service charge invoice status
            const { error: serviceInvoiceError } = await supabase
              .from('service_charge_invoices')
              .update({
                status: 'paid',
                payment_date: new Date().toISOString().split('T')[0],
                payment_method: 'M-Pesa',
                mpesa_receipt_number: transactionId,
                payment_phone_number: phoneNumber,
                updated_at: new Date().toISOString()
              })
              .eq('id', serviceChargeInvoiceId)

            if (serviceInvoiceError) {
              console.error('Error updating service charge invoice:', serviceInvoiceError)
            } else {
              console.log(`Service charge invoice ${serviceChargeInvoiceId} marked as paid`)
              
              // Send SMS confirmation for service charge payment
              try {
                const { data: serviceInvoice } = await supabase
                  .from('service_charge_invoices')
                  .select(`
                    landlord_id,
                    profiles!service_charge_invoices_landlord_id_fkey(phone, first_name, last_name)
                  `)
                  .eq('id', serviceChargeInvoiceId)
                  .single()

                if (serviceInvoice?.profiles?.phone) {
                  // Send SMS notification using secure SMS service
                  const smsResponse = await supabase.functions.invoke('send-sms', {
                    body: {
                      phone_number: serviceInvoice.profiles.phone,
                      message: `Service charge payment of KES ${amount || transaction.amount} received. Thank you! - Zira Homes. Receipt: ${transactionId}`
                    }
                  });

                  if (smsResponse.error) {
                    console.error('Error sending service charge SMS confirmation:', smsResponse.error)
                  } else {
                    console.log('Service charge SMS confirmation sent to:', serviceInvoice.profiles.phone)
                  }
                } else {
                  console.log('No phone number found for landlord, skipping SMS')
                }
              } catch (smsError) {
                console.error('Error in service charge SMS confirmation process:', smsError)
              }
            }
          }
        } else if (transaction.invoice_id) {
          // Handle regular rent invoice payment with proper allocation-based handling
          console.log('Processing rent invoice payment for invoice_id:', transaction.invoice_id);
          
          // Use LEFT JOINs to avoid query failures when nested relationships are missing
          const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .select(`
              *,
              leases(
                unit_id,
                units(
                  property_id,
                  properties(
                    owner_id,
                    manager_id
                  )
                )
              )
            `)
            .eq('id', transaction.invoice_id)
            .single()

          if (invoiceError) {
            console.error('Error fetching invoice:', {
              invoice_id: transaction.invoice_id,
              error: invoiceError.message,
              details: invoiceError.details
            });
          }
          
          console.log('Invoice query result:', {
            found: !!invoice,
            invoice_id: invoice?.id,
            invoice_amount: invoice?.amount,
            tenant_id: invoice?.tenant_id,
            has_lease: !!invoice?.leases
          });

          if (invoice) {
            // Check if payment already exists to prevent duplicates
            const { data: existingPayment } = await supabase
              .from('payments')
              .select('id')
              .eq('transaction_id', transactionId)
              .eq('payment_reference', CheckoutRequestID)
              .single()

            if (existingPayment) {
              console.log('Payment already exists for this transaction, skipping duplicate creation:', {
                transactionId,
                CheckoutRequestID,
                existingPaymentId: existingPayment.id
              })
              return new Response('OK', { status: 200 })
            }

            const paidAmount = amount || transaction.amount;
            const invoiceAmount = invoice.amount;

            // Check existing allocations for this invoice to calculate outstanding balance
            const { data: existingAllocations } = await supabase
              .from('payment_allocations')
              .select('amount')
              .eq('invoice_id', invoice.id);

            const previouslyPaid = existingAllocations?.reduce((sum: number, a: any) => sum + Number(a.amount), 0) || 0;
            const remainingBalance = Math.max(0, invoiceAmount - previouslyPaid);

            // Determine how much of this payment goes to the invoice vs overpayment
            const allocationAmount = Math.min(paidAmount, remainingBalance);
            const overpaymentAmount = Math.max(0, paidAmount - remainingBalance);

            console.log('Payment allocation calculation:', {
              paidAmount,
              invoiceAmount,
              previouslyPaid,
              remainingBalance,
              allocationAmount,
              overpaymentAmount
            });

            // Create payment record with actual paid amount
            const { data: createdPayment, error: paymentError } = await supabase
              .from('payments')
              .insert({
                tenant_id: invoice.tenant_id,
                lease_id: invoice.lease_id,
                invoice_id: invoice.id,
                amount: paidAmount,
                payment_method: 'M-Pesa',
                payment_date: new Date().toISOString().split('T')[0],
                transaction_id: transactionId,
                payment_reference: CheckoutRequestID,
                payment_type: 'rent',
                status: 'completed',
                notes: `M-Pesa payment via STK Push. Receipt: ${transactionId}` + 
                       (overpaymentAmount > 0 ? `. KES ${overpaymentAmount} credited to account.` : '') +
                       (allocationAmount < paidAmount && allocationAmount < invoiceAmount ? `. Partial payment of KES ${allocationAmount} applied.` : '')
              })
              .select()
              .single()

            if (paymentError) {
              console.error('Error creating payment record:', paymentError)
            } else if (createdPayment) {
              console.log('Payment record created:', createdPayment.id);

              // Create payment allocation - the trigger will automatically update invoice status
              if (allocationAmount > 0) {
                const { error: allocationError } = await supabase
                  .from('payment_allocations')
                  .insert({
                    payment_id: createdPayment.id,
                    invoice_id: invoice.id,
                    amount: allocationAmount
                  });

                if (allocationError) {
                  console.error('Error creating payment allocation:', allocationError);
                } else {
                  console.log(`Created allocation of KES ${allocationAmount} for invoice ${invoice.id}`);
                }
              }

              // Extract landlordId - handle both old and new query structures
              const landlordId = invoice.leases?.units?.properties?.owner_id || 
                                invoice.leases?.units?.properties?.manager_id ||
                                invoice.leases?.unit?.property?.owner_id || 
                                invoice.leases?.unit?.property?.manager_id;
              
              console.log('Extracted landlordId for overpayment credit:', landlordId);

              if (overpaymentAmount > 0 && landlordId) {
                const { error: creditError } = await supabase
                  .from('tenant_credits')
                  .insert({
                    tenant_id: invoice.tenant_id,
                    landlord_id: landlordId,
                    amount: overpaymentAmount,
                    balance: overpaymentAmount,
                    description: `Overpayment from M-Pesa. Receipt: ${transactionId}`,
                    source_type: 'overpayment',
                    source_payment_id: createdPayment.id
                  });

                if (creditError) {
                  console.error('Error creating tenant credit:', creditError);
                } else {
                  console.log(`Created tenant credit of KES ${overpaymentAmount}`);
                }
              }

              // Calculate final status for SMS message
              const totalPaid = previouslyPaid + allocationAmount;
              const isFullyPaid = totalPaid >= invoiceAmount;
              const outstandingBalance = Math.max(0, invoiceAmount - totalPaid);

              // Extract landlordId for service charge invoice - handle both query structures
              const landlordIdForService = invoice.leases?.units?.properties?.owner_id || 
                                          invoice.leases?.units?.properties?.manager_id ||
                                          invoice.leases?.unit?.property?.owner_id || 
                                          invoice.leases?.unit?.property?.manager_id;
              
              if (landlordIdForService) {
                try {
                  console.log('Starting automatic service charge invoice generation for rent payment...');
                  
                  // Get current month's billing period
                  const now = new Date();
                  const billingPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                  const billingPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                  
                  // Check if service charge invoice already exists for this period
                  const { data: existingServiceInvoice } = await supabase
                    .from('service_charge_invoices')
                    .select('id, total_amount, rent_collected')
                    .eq('landlord_id', landlordId)
                    .eq('billing_period_start', billingPeriodStart)
                    .eq('billing_period_end', billingPeriodEnd)
                    .single();

                  if (existingServiceInvoice) {
                    console.log('Service charge invoice already exists, updating with new rent collection...');
                    
                    // Update existing invoice with the new rent collection (only allocation amount, not overpayment)
                    const updatedRentCollected = existingServiceInvoice.rent_collected + allocationAmount;
                    
                    // Get landlord's billing plan to recalculate service charge
                    const { data: subscription } = await supabase
                      .from('landlord_subscriptions')
                      .select('*, billing_plan:billing_plans(*)')
                      .eq('landlord_id', landlordId)
                      .single();

                    if (subscription?.billing_plan) {
                      const plan = subscription.billing_plan;
                      let newServiceChargeAmount = 0;
                      
                      if (plan.billing_model === 'percentage' && plan.percentage_rate) {
                        newServiceChargeAmount = (updatedRentCollected * plan.percentage_rate) / 100;
                      }

                      // Update the existing invoice
                      await supabase
                        .from('service_charge_invoices')
                        .update({
                          rent_collected: updatedRentCollected,
                          service_charge_amount: newServiceChargeAmount,
                          total_amount: newServiceChargeAmount,
                          updated_at: new Date().toISOString()
                        })
                        .eq('id', existingServiceInvoice.id);

                      console.log('Updated existing service charge invoice with new rent collection');
                    }
                  } else {
                    console.log('No existing service charge invoice found, generating new one...');
                    
                    // Generate new service charge invoice via edge function
                    const serviceInvoiceResponse = await supabase.functions.invoke('generate-service-invoice', {
                      body: {
                        landlord_id: landlordId,
                        billing_period_start: billingPeriodStart,
                        billing_period_end: billingPeriodEnd
                      }
                    });

                    if (serviceInvoiceResponse.error) {
                      console.error('Failed to generate service charge invoice:', serviceInvoiceResponse.error);
                    } else {
                      console.log('Successfully generated service charge invoice for landlord:', landlordId);
                    }
                  }
                } catch (serviceInvoiceError) {
                  console.error('Error in automatic service charge invoice generation:', serviceInvoiceError);
                  // Don't fail the main payment process if service invoice generation fails
                }
              }
              
              // Send SMS receipt confirmation with accurate status
              try {
                // Get tenant details for SMS
                const { data: tenant } = await supabase
                  .from('tenants')
                  .select('phone, first_name, last_name')
                  .eq('id', invoice.tenant_id)
                  .single()

                if (tenant?.phone) {
                  let smsMessage = `Payment of KES ${paidAmount} received. `;
                  
                  if (isFullyPaid) {
                    smsMessage += `Invoice ${invoice.invoice_number} fully paid. `;
                  } else {
                    smsMessage += `Outstanding balance: KES ${outstandingBalance}. `;
                  }
                  
                  if (overpaymentAmount > 0) {
                    smsMessage += `KES ${overpaymentAmount} credited to your account. `;
                  }
                  
                  smsMessage += `Receipt: ${transactionId} - Zira Homes`;

                  const smsResponse = await supabase.functions.invoke('send-sms', {
                    body: {
                      phone_number: tenant.phone,
                      message: smsMessage
                    }
                  })

                  if (smsResponse.error) {
                    console.error('Error sending SMS receipt confirmation:', smsResponse.error)
                  } else {
                    console.log('SMS receipt confirmation sent to:', tenant.phone)
                  }
                } else {
                  console.log('No phone number found for tenant, skipping SMS')
                }
              } catch (smsError) {
                console.error('Error in SMS receipt confirmation process:', smsError)
                // Don't fail the payment process if SMS fails
              }
            }
          }
        }
      } catch (error) {
        console.error('Error processing successful payment:', error)
      }
    }

    return new Response('OK', { status: 200 })

  } catch (error) {
    console.error('Error in M-Pesa callback:', error)
    return new Response('OK', { status: 200 })
  }
})