import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, X } from "lucide-react";

export function MpesaTest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testMpesaSTK = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const testReference = `TEST-${Date.now()}`;
      
      const { data, error: invokeError } = await supabase.functions.invoke(
        'mpesa-stk-push',
        {
          body: {
            phone: '254722241745',
            amount: 5,
            accountReference: testReference,
            transactionDesc: 'Test STK Push - 5 KES',
            paymentType: 'rent',
            dryRun: false
          }
        }
      );

      if (invokeError) {
        setError(invokeError.message);
        return;
      }

      if (data?.success) {
        setResult({
          success: true,
          checkoutRequestID: data.data?.CheckoutRequestID,
          merchantRequestID: data.data?.MerchantRequestID,
          message: data.message,
          shortcode: data.data?.BusinessShortCode
        });
      } else {
        setError(data?.error || 'STK Push failed');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>M-Pesa STK Push Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 p-3 rounded text-sm text-blue-700">
            <p><strong>Phone:</strong> 254722241745</p>
            <p><strong>Amount:</strong> 5 KES</p>
            <p><strong>Type:</strong> Test STK Push</p>
          </div>

          <Button
            onClick={testMpesaSTK}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              'Send STK Push'
            )}
          </Button>

          {result && (
            <div className="bg-green-50 border border-green-200 rounded p-4 space-y-2">
              <div className="flex items-center gap-2 text-green-700">
                <Check className="h-5 w-5" />
                <span className="font-medium">Success!</span>
              </div>
              <div className="text-sm text-green-600 space-y-1">
                <p><strong>Message:</strong> {result.message}</p>
                <p><strong>Shortcode:</strong> {result.shortcode}</p>
                <p><strong>Checkout ID:</strong> {result.checkoutRequestID}</p>
                <p className="text-xs text-green-500 mt-2">Check your phone for the STK prompt</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4 space-y-2">
              <div className="flex items-center gap-2 text-red-700">
                <X className="h-5 w-5" />
                <span className="font-medium">Error</span>
              </div>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
