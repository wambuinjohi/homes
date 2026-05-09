import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import SMSProviderConfig from "@/components/admin/SMSProviderConfig";
import WhatsAppBusinessConfig from "@/components/admin/WhatsAppBusinessConfig";
import { SMSHealthCheck } from "@/components/admin/SMSHealthCheck";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";

const CommunicationSettings = () => {
  const { user } = useAuth();
  const [testPhone, setTestPhone] = useState("254722241745");
  const [isSending, setIsSending] = useState(false);

  const handleSendTestSMS = async () => {
    if (!testPhone) {
      toast.error("Please enter a phone number");
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-sms', {
        body: { 
          phone_number: testPhone,
          landlord_id: user?.id 
        }
      });

      if (error) throw error;

      toast.success(`Test SMS sent to ${testPhone}! Check SMS logs.`, {
        description: data?.message || 'SMS sent successfully'
      });
    } catch (error: any) {
      console.error('Test SMS error:', error);
      toast.error('Failed to send test SMS', {
        description: error.message
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Communication Settings</h1>
        <p className="text-muted-foreground">
          Configure SMS providers, WhatsApp Business, and monitor communication health
        </p>
      </div>

      <Tabs defaultValue="sms" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sms">SMS Configuration</TabsTrigger>
          <TabsTrigger value="health">SMS Health Check</TabsTrigger>
          <TabsTrigger value="test">Test SMS</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp Business</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sms" className="space-y-4">
          <SMSProviderConfig />
        </TabsContent>
        
        <TabsContent value="health" className="space-y-4">
          <SMSHealthCheck />
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Send Test SMS</CardTitle>
              <CardDescription>
                Send a test SMS to verify the system is working. This will be logged under your (Admin) account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-phone">Phone Number (E.164 format)</Label>
                <Input
                  id="test-phone"
                  placeholder="254722241745"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                />
              </div>
              <Button onClick={handleSendTestSMS} disabled={isSending}>
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Test SMS
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="whatsapp" className="space-y-4">
          <WhatsAppBusinessConfig />
        </TabsContent>
      </Tabs>
    </div>
    </DashboardLayout>
  );
};

export default CommunicationSettings;
