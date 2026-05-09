
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts'

console.log("Telemetry heartbeat function started")

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
      app_version, 
      environment, 
      online_users, 
      metrics 
    } = await req.json()

    if (!instance_id || !write_key) {
      return new Response(
        JSON.stringify({ error: 'Missing instance_id or write_key' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the instance and write key
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

    // Insert heartbeat
    const { error: heartbeatError } = await supabase
      .from('telemetry_heartbeats')
      .insert({
        instance_id,
        app_version,
        environment,
        online_users: online_users || 0,
        metrics: metrics || {}
      })

    if (heartbeatError) {
      console.error('Failed to insert heartbeat:', heartbeatError)
      return new Response(
        JSON.stringify({ error: 'Failed to record heartbeat' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update last_seen_at
    await supabase
      .from('self_hosted_instances')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', instance_id)

    console.log(`Heartbeat recorded for instance: ${instance_id}`)
    
    return new Response(
      JSON.stringify({ success: true, message: 'Heartbeat recorded' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in telemetry-heartbeat:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
