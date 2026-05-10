import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;
  const targetEmail = process.env.TARGET_USER_EMAIL || 'gichukisimon@gmail.com';

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE env vars. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE are set.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });

  try {
    console.log(`Looking up profile for email: ${targetEmail}`);
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .ilike('email', targetEmail)
      .maybeSingle();

    if (profileError) throw profileError;
    let userId = null;
    if (profile && profile.id) {
      userId = profile.id;
      console.log('Found profile id:', userId);
    } else {
      console.log('No profile row found, trying auth admin lookup...');
      const { data: userResult, error: userError } = await supabase.auth.admin.getUserByEmail(targetEmail);
      if (userError) {
        console.error('Auth admin lookup failed:', userError);
        process.exit(2);
      }
      if (!userResult || !userResult.data) {
        console.error('No auth user found for email:', targetEmail);
        process.exit(2);
      }
      userId = userResult.data.id;
      console.log('Found auth user id:', userId);
    }

    console.log('Searching for Professional plan...');
    const { data: plans, error: plansError } = await supabase
      .from('billing_plans')
      .select('*')
      .ilike('name', '%professional%')
      .eq('is_active', true)
      .limit(1);

    if (plansError) throw plansError;
    if (!plans || plans.length === 0) {
      console.error('No active Professional plan found');
      process.exit(3);
    }

    const plan = plans[0];
    console.log('Using plan:', plan.id, plan.name);

    const upsertPayload = {
      landlord_id: profile.id,
      billing_plan_id: plan.id,
      status: 'active',
      subscription_start_date: new Date().toISOString(),
      trial_end_date: null,
      auto_renewal: true,
      sms_credits_balance: plan.sms_credits_included || 0
    };

    console.log('Upserting subscription:', upsertPayload);
    const { data: upsertData, error: upsertError } = await supabase
      .from('landlord_subscriptions')
      .upsert(upsertPayload, { onConflict: 'landlord_id' })
      .select()
      .single();

    if (upsertError) throw upsertError;

    console.log('Subscription upsert successful:', upsertData);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(99);
  }
}

main();
