import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Building2, 
  Smartphone, 
  ChevronDown, 
  Copy, 
  Check,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLandlordPaymentMethods } from "@/hooks/useLandlordPaymentMethods";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface BankPaymentGuideProps {
  variant?: "card" | "inline" | "collapsible";
  defaultOpen?: boolean;
}

export function BankPaymentGuide({ 
  variant = "collapsible", 
  defaultOpen = false 
}: BankPaymentGuideProps) {
  const { data, isLoading, error } = useLandlordPaymentMethods();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { toast } = useToast();

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({
        title: "Copied!",
        description: `${field} copied to clipboard`,
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({
        title: "Copy failed",
        description: "Please copy manually",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-4 w-48 mb-2" />
          <Skeleton className="h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data?.hasActivePaymentMethods) {
    return null; // Don't show if no payment methods configured
  }

  const content = (
    <div className="space-y-4">
      {data.paymentMethods.map((method, index) => (
        <div 
          key={index} 
          className="p-4 rounded-lg border bg-card"
        >
          <div className="flex items-center gap-2 mb-3">
            {method.type === "jenga" || method.type === "bank" ? (
              <Building2 className="h-5 w-5 text-primary" />
            ) : (
              <Smartphone className="h-5 w-5 text-green-600" />
            )}
            <span className="font-semibold">{method.name}</span>
            <Badge variant="secondary" className="ml-auto">Active</Badge>
          </div>

          <div className="space-y-3 text-sm">
            {(method.type === "jenga" || method.type === "bank") && method.config && (
              <>
                <div className="flex items-center justify-between p-2 bg-muted rounded">
                  <div>
                    <p className="text-muted-foreground text-xs">Paybill Number</p>
                    <p className="font-mono font-bold text-lg">{method.config.paybillNumber}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(method.config!.paybillNumber!, "Paybill")}
                  >
                    {copiedField === "Paybill" ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="flex items-center justify-between p-2 bg-muted rounded">
                  <div>
                    <p className="text-muted-foreground text-xs">Account Number</p>
                    <p className="font-mono font-bold text-lg">
                      {method.config.accountFormat}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => 
                      copyToClipboard(method.config!.accountFormat!, "Account")
                    }
                  >
                    {copiedField === "Account" ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <Alert className="border-blue-200 bg-blue-50">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-xs text-blue-800">
                    Use this exact Account Number format when paying via M-Pesa to Paybill {method.config.paybillNumber}. 
                    Your payment will be automatically matched to your invoice.
                  </AlertDescription>
                </Alert>
              </>
            )}

            {method.type === "mpesa" && method.config && (
              <>
                <div className="flex items-center justify-between p-2 bg-muted rounded">
                  <div>
                    <p className="text-muted-foreground text-xs">
                      {method.config.accountFormat ? "Paybill" : "Till"} Number
                    </p>
                    <p className="font-mono font-bold text-lg">
                      {method.config.paybillNumber}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => 
                      copyToClipboard(method.config!.paybillNumber!, "M-Pesa Number")
                    }
                  >
                    {copiedField === "M-Pesa Number" ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {method.config.accountFormat && (
                  <div className="flex items-center justify-between p-2 bg-muted rounded">
                    <div>
                      <p className="text-muted-foreground text-xs">Account Number</p>
                      <p className="font-mono font-bold text-lg">
                        {method.config.accountFormat}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => 
                        copyToClipboard(method.config!.accountFormat!, "Account")
                      }
                    >
                      {copiedField === "Account" ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ))}

      {data.propertyName && (
        <p className="text-xs text-muted-foreground text-center">
          Payment methods for {data.propertyName} - Unit {data.unitNumber}
        </p>
      )}
    </div>
  );

  if (variant === "inline") {
    return content;
  }

  if (variant === "collapsible") {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between text-base">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  How to Pay
                </div>
                <ChevronDown 
                  className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`} 
                />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">{content}</CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-5 w-5 text-primary" />
          How to Pay
        </CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
