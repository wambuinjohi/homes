// Test SMS Trigger Script
// This script will send a test SMS to 254722241745
// Run this in the browser console on your app

(async () => {
  console.log('🧪 Starting SMS test...');
  
  try {
    // Get Supabase client from window (available in the app)
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    
    const supabase = createClient(
      'https://kdpqimetajnhcqseajok.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkcHFpbWV0YWpuaGNxc2Vham9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwMDQxMTAsImV4cCI6MjA2OTU4MDExMH0.VkqXvocYAYO6RQeDaFv8wVrq2xoKKfQ8UVj41az7ZSk'
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
