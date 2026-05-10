import { toast } from 'sonner';

// Test utility to check PDF generation health
export const testPDFHealth = async () => {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const res = await fetch(`${supabaseUrl}/functions/v1/pdf-health`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
      }
    });

    const ct = res.headers.get('content-type') || '';
    
    console.log('PDF Health Check Results:');
    console.log('Status:', res.status);
    console.log('Content-Type:', ct);
    console.log('Response Size:', res.headers.get('content-length') || 'unknown');

    if (!res.ok) {
      const text = await res.text();
      console.error('Health check failed:', text);
      toast.error(`PDF Health Check Failed: ${text}`);
      return false;
    }

    if (!ct.includes('application/pdf')) {
      const text = await res.text();
      console.error('Expected PDF but got:', ct, text);
      toast.error(`Expected PDF but received: ${ct}`);
      return false;
    }

    const blob = await res.blob();
    console.log('Actual blob size:', blob.size);

    if (blob.size < 100) {
      toast.error('PDF too small - likely an error');
      return false;
    }

    // Download the test PDF
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pdf-health-check.pdf';
    a.click();
    URL.revokeObjectURL(url);

    toast.success('PDF Health Check Passed! Test file downloaded.');
    return true;
  } catch (error) {
    console.error('PDF health check error:', error);
    toast.error(`Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

// Add this to window for debugging in browser console
if (typeof window !== 'undefined') {
  (window as any).testPDFHealth = testPDFHealth;
}