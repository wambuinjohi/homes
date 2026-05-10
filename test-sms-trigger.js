// Test SMS Trigger Script
// This script will send a test SMS to 254722241745
// Run this in the browser console on your app

(async () => {
  console.log('🧪 Starting SMS test...');
  
  try {
    // Get Supabase client from window (available in the app)
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    
    const supabase = createClient(
      'https://tbmzwmgsvshfdxdoyrcr.supabase.co',
      'sb_publishable_d9PzsYP9E6qVHj1T2njHXw_HY0QJS45'
    );
    
    console.log('📱 Invoking test-sms function...');
    
    const { data, error } = await supabase.functions.invoke('test-sms');
    
    if (error) {
      console.error('❌ Error:', error);
      throw error;
    }
    
    console.log('✅ Success! Response:', data);
    console.log('📧 SMS sent to: 254722241745');
    console.log('🔍 Check SMS logs for delivery status');
    
    return data;
    
  } catch (error) {
    console.error('💥 Failed to send test SMS:', error);
    throw error;
  }
})();
