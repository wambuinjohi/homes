import { useState } from "react";
import { TestSMSButton } from "@/components/admin/TestSMSButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, CheckCircle2, Phone } from "lucide-react";

const formatPhoneNumber = (phone: string): string => {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Handle local format (07XX or 01XX)
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return '254' + cleaned.substring(1);
  }
  
  // Handle international format with +
  if (cleaned.startsWith('254')) {
    return cleaned;
  }
  
  return cleaned;
};

const isValidPhoneNumber = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  // Valid if it's 254XXXXXXXXX (12 digits) or 07XX/01XX (10 digits)
  return (cleaned.startsWith('254') && cleaned.length === 12) || 
         (cleaned.startsWith('0') && cleaned.length === 10);
};

export default function TestSMS() {
  const [phoneNumber, setPhoneNumber] = useState("254722241745");
  const formattedNumber = formatPhoneNumber(phoneNumber);
  const isValid = isValidPhoneNumber(phoneNumber);

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageSquare className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-3xl">SMS Testing</CardTitle>
          <CardDescription>
            Send a test SMS to verify the SMS system is working
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="phone-number" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Phone Number
            </Label>
            <Input
              id="phone-number"
              type="text"
              placeholder="254722241745 or 0722241745"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className={!isValid && phoneNumber ? "border-destructive" : ""}
            />
            {!isValid && phoneNumber && (
              <p className="text-sm text-destructive">
                Please enter a valid Kenyan phone number (254XXXXXXXXX or 07XX/01XX)
              </p>
            )}
            {isValid && (
              <p className="text-sm text-muted-foreground">
                Will send to: <strong>{formattedNumber}</strong>
              </p>
            )}
          </div>

          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              This will send a test message to <strong>{formattedNumber}</strong> using the configured SMS provider.
              The message will be logged in the SMS Logs for tracking.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h3 className="font-semibold mb-2">Test Message Content:</h3>
              <p className="text-sm text-muted-foreground">
                "🧪 Test SMS from ZIRA Property Management System<br/>
                <br/>
                This is a test message sent at [current time].<br/>
                <br/>
                If you received this message, the SMS system is working correctly! ✅<br/>
                <br/>
                - ZIRA Tech Team"
              </p>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                What happens when you click the button:
              </h3>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
                <li>Phone number is formatted to E.164 format (254...)</li>
                <li>Message is sent via the configured SMS provider</li>
                <li>Full details are logged in the SMS Logs table</li>
                <li>You'll receive a success or error notification</li>
              </ul>
            </div>

            <TestSMSButton phoneNumber={formattedNumber} disabled={!isValid} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
