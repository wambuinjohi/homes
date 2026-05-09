import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function UpgradeSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionId = searchParams.get('session_id');
  const planId = searchParams.get('plan_id');

  useEffect(() => {
    if (sessionId && planId) {
      confirmUpgrade();
    } else {
      setError("Missing session or plan information");
      setIsProcessing(false);
    }
  }, [sessionId, planId]);

  const confirmUpgrade = async () => {
    try {
      console.log('🔄 Confirming upgrade...', { sessionId, planId });
      
      const { data, error } = await supabase.functions.invoke('confirm-billing-upgrade', {
        body: { sessionId, planId }
      });

      if (error) {
        console.error('❌ Confirmation error:', error);
        throw error;
      }

      if (data?.success) {
        console.log('✅ Upgrade confirmed successfully');
        setSuccess(true);
        toast.success("Upgrade completed successfully!");
      } else {
        throw new Error("Failed to confirm upgrade");
      }
    } catch (error) {
      console.error('❌ Upgrade confirmation failed:', error);
      setError(error instanceof Error ? error.message : "Unknown error occurred");
      toast.error("Failed to complete upgrade");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleContinue = () => {
    // Reload to refresh trial status across the app
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {isProcessing ? (
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
            ) : success ? (
              <CheckCircle className="h-12 w-12 text-green-500" />
            ) : (
              <XCircle className="h-12 w-12 text-destructive" />
            )}
          </div>
          
          <CardTitle className="text-2xl">
            {isProcessing ? "Processing Upgrade..." : 
             success ? "Upgrade Successful!" : 
             "Upgrade Failed"}
          </CardTitle>
          
          <CardDescription>
            {isProcessing ? "Please wait while we confirm your upgrade" : 
             success ? "Welcome to your new plan! You now have access to all features." : 
             error || "Something went wrong during the upgrade process"}
          </CardDescription>
        </CardHeader>

        <CardContent className="text-center space-y-4">
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-medium text-green-800 mb-2">What's Next?</h3>
              <ul className="text-sm text-green-700 space-y-1 text-left">
                <li>• Access to unlimited properties and units</li>
                <li>• Priority customer support</li>
                <li>• Advanced reporting features</li>
                <li>• Enhanced tenant management tools</li>
              </ul>
            </div>
          )}
          
          <div className="flex gap-3 justify-center">
            {success ? (
              <Button onClick={handleContinue} className="w-full">
                Continue to Dashboard
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => navigate('/')}>
                  Back to Dashboard
                </Button>
                {error && (
                  <Button onClick={() => navigate('/upgrade')} variant="default">
                    Try Again
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}