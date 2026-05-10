
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts'

console.log("Telemetry errors function started")

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { 
      instance_id, 
      write_key, 
      errors 
    } = await req.json()

    if (!instance_id || !write_key || !Array.isArray(errors)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields or invalid errors array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the instance and write key (same verification as other endpoints)
    const { data: instance, error: instanceError } = await supabase
      .from('self_hosted_instances')
      .select('id, write_key_hash, status')
      .eq('id', instance_id)
      .single()

    if (instanceError || !instance) {
      console.error('Instance not found:', instanceError)
      return new Response(
        JSON.stringify({ error: 'Invalid instance' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify write key hash
    const encoder = new TextEncoder()
    const keyData = encoder.encode(write_key)
    const hashBuffer = await crypto.subtle.digest('SHA-256', keyData)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    if (hashHex !== instance.write_key_hash) {
      console.error('Invalid write key')
      return new Response(
        JSON.stringify({ error: 'Invalid write key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (instance.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Instance suspended' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Process errors
    const errorsToInsert = errors.map(error => ({
      instance_id,
      message: error.message,
      stack: error.stack,
      url: error.url,
      severity: error.severity || 'error',
      fingerprint: error.fingerprint,
      user_id_hash: error.user_id_hash,
      context: error.context || {}
    }))

    const { error: insertError } = await supabase
      .from('telemetry_errors')
      .insert(errorsToInsert)

    if (insertError) {
      console.error('Failed to insert errors:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to record errors' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Recorded ${errors.length} errors for instance: ${instance_id}`)
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Recorded ${errors.length} errors`,
        processed_count: errors.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in telemetry-errors:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
