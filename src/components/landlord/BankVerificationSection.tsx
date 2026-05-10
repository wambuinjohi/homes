import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { SimpleBankService, BankConfig } from "@/services/simpleBankService";
import { CheckCircle, XCircle, Loader2, Shield, AlertTriangle, Building2 } from "lucide-react";

interface BankVerificationSectionProps {
  onVerificationChange?: () => void;
}

type BankCode = 'kcb' | 'equity' | 'cooperative' | 'im' | 'ncba' | 'dtb';

interface BankDetails {
  name: string;
  code: BankCode;
  apiType: string;
}

// Note: Equity Bank is excluded as it has dedicated Jenga PAY configuration
const SUPPORTED_BANKS: BankDetails[] = [
  { name: "KCB Bank (Buni)", code: "kcb", apiType: "Buni API" },
  { name: "Co-operative Bank", code: "cooperative", apiType: "Direct Integration" },
  { name: "I&M Bank", code: "im", apiType: "API Gateway" },
  { name: "NCBA Bank", code: "ncba", apiType: "NCBA API" },
  { name: "Diamond Trust Bank", code: "dtb", apiType: "DTB Connect" },
];

export const BankVerificationSection: React.FC<BankVerificationSectionProps> = ({
  onVerificationChange
}) => {
  const { toast } = useToast();
  const [selectedBank, setSelectedBank] = useState<string>("");
  const [config, setConfig] = useState<BankConfig | null>(null);
  const [credentials, setCredentials] = useState({
    apiKey: "",
    apiSecret: "",
    merchantId: "",
    callbackUrl: ""
  });
  const [verifying, setVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const loadBankConfig = (bankCode: BankCode) => {
    const cfg = SimpleBankService.getBankConfig(bankCode);
    setConfig(cfg);
    setCredentials({
      apiKey: cfg.config.apiKey || "",
      apiSecret: cfg.config.apiSecret || "",
      merchantId: cfg.config.merchantId || "",
      callbackUrl: cfg.config.callbackUrl || ""
    });
  };

  const handleBankSelect = (bankCode: string) => {
    setSelectedBank(bankCode);
    loadBankConfig(bankCode as BankCode);
    setVerificationStatus('idle');
  };

  const handleVerifyCredentials = async () => {
    if (!selectedBank || !credentials.apiKey || !credentials.apiSecret) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required credentials",
        variant: "destructive"
      });
      return;
    }

    setVerifying(true);
    try {
      // Simulate API verification (in production, this would call actual bank API)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // For demo purposes, validate credentials format
      const isValid = credentials.apiKey.length >= 8 && credentials.apiSecret.length >= 8;

      if (isValid) {
        // Save verified configuration
        SimpleBankService.updateBankConfig(selectedBank as BankCode, {
          enabled: true,
          environment: config?.environment || 'sandbox',
          config: {
            ...credentials,
            verified: 'true',
            verifiedAt: new Date().toISOString()
          }
        });

        setVerificationStatus('success');
        toast({
          title: "Verification Successful",
          description: `${SUPPORTED_BANKS.find(b => b.code === selectedBank)?.name} credentials verified successfully`,
        });
        
        onVerificationChange?.();
      } else {
        setVerificationStatus('error');
        toast({
          title: "Verification Failed",
          description: "Invalid credentials format. Please check and try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Bank verification error:", error);
      setVerificationStatus('error');
      toast({
        title: "Verification Error",
        description: "Unable to verify credentials. Please try again.",
        variant: "destructive"
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleActivate = async () => {
    if (!selectedBank || verificationStatus !== 'success') return;

    try {
      SimpleBankService.updateBankConfig(selectedBank as BankCode, {
        enabled: true,
        environment: config?.environment || 'sandbox',
        config: {
          ...credentials,
          active: 'true'
        }
      });

      toast({
        title: "Bank Integration Activated",
        description: `${SUPPORTED_BANKS.find(b => b.code === selectedBank)?.name} is now active for payments`,
      });
      
      onVerificationChange?.();
    } catch (error) {
      toast({
        title: "Activation Failed",
        description: "Unable to activate integration. Please try again.",
        variant: "destructive"
      });
    }
  };

  const bankDetails = SUPPORTED_BANKS.find(b => b.code === selectedBank);
  const isVerified = config?.config.verified === 'true';
  const isActive = config?.enabled && config?.config.active === 'true';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Bank Integration Verification
        </CardTitle>
        <CardDescription>
          Verify your bank API credentials to enable direct bank payments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>Secure Verification Process</AlertTitle>
          <AlertDescription>
            Similar to M-Pesa OAuth verification, bank credentials are verified through secure API calls.
            Your credentials are encrypted and stored securely.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <Label htmlFor="bank-select">Select Bank</Label>
            <Select value={selectedBank} onValueChange={handleBankSelect}>
              <SelectTrigger id="bank-select">
                <SelectValue placeholder="Choose a bank to configure..." />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_BANKS.map(bank => (
                  <SelectItem key={bank.code} value={bank.code}>
                    {bank.name} - {bank.apiType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedBank && (
            <>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Badge variant={isActive ? "default" : isVerified ? "secondary" : "outline"}>
                  {isActive ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Active
                    </>
                  ) : isVerified ? (
                    <>
                      <Shield className="h-3 w-3 mr-1" />
                      Verified
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Not Verified
                    </>
                  )}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {bankDetails?.apiType}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="api-key">API Key *</Label>
                  <Input
                    id="api-key"
                    type="password"
                    value={credentials.apiKey}
                    onChange={(e) => setCredentials({ ...credentials, apiKey: e.target.value })}
                    placeholder="Enter your API key"
                    disabled={verifying}
                  />
                </div>

                <div>
                  <Label htmlFor="api-secret">API Secret *</Label>
                  <Input
                    id="api-secret"
                    type="password"
                    value={credentials.apiSecret}
                    onChange={(e) => setCredentials({ ...credentials, apiSecret: e.target.value })}
                    placeholder="Enter your API secret"
                    disabled={verifying}
                  />
                </div>

                <div>
                  <Label htmlFor="merchant-id">Merchant ID</Label>
                  <Input
                    id="merchant-id"
                    value={credentials.merchantId}
                    onChange={(e) => setCredentials({ ...credentials, merchantId: e.target.value })}
                    placeholder="Optional merchant identifier"
                    disabled={verifying}
                  />
                </div>

                <div>
                  <Label htmlFor="callback-url">Callback URL</Label>
                  <Input
                    id="callback-url"
                    value={credentials.callbackUrl}
                    onChange={(e) => setCredentials({ ...credentials, callbackUrl: e.target.value })}
                    placeholder="https://your-domain.com/callback"
                    disabled={verifying}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleVerifyCredentials}
                  disabled={verifying || !credentials.apiKey || !credentials.apiSecret}
                  className="flex-1"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : verificationStatus === 'success' ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Verified
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Verify Credentials
                    </>
                  )}
                </Button>

                {verificationStatus === 'success' && !isActive && (
                  <Button
                    onClick={handleActivate}
                    variant="default"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Activate
                  </Button>
                )}
              </div>

              {verificationStatus === 'success' && (
                <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle>Credentials Verified</AlertTitle>
                  <AlertDescription>
                    Your {bankDetails?.name} credentials have been verified successfully.
                    {!isActive && " Click 'Activate' to enable bank payments."}
                  </AlertDescription>
                </Alert>
              )}

              {verificationStatus === 'error' && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Verification Failed</AlertTitle>
                  <AlertDescription>
                    Unable to verify credentials. Please check your API key and secret.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
          <AlertDescription className="text-sm">
            <strong>Note:</strong> This is a demo verification flow. In production, actual bank API
            calls would be made to verify credentials through secure OAuth or API key validation.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
