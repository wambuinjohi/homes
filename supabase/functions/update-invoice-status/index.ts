import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { invoiceIds, status } = await req.json()

    if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      throw new Error('invoiceIds array is required')
    }

    if (!status || !['pending', 'unpaid', 'paid', 'overdue', 'cancelled'].includes(status)) {
      throw new Error('Valid status is required')
    }

    // Update invoice statuses
    const { data, error } = await supabaseClient
      .from('invoices')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .in('id', invoiceIds)
      .select()

    if (error) throw error

    return new Response(
      JSON.stringify({ 
        success: true, 
        updated: data.length,
        invoices: data 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
