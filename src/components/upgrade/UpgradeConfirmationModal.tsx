import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Crown, Check, Shield, Smartphone } from "lucide-react";
import { formatAmount, getGlobalCurrencySync } from "@/utils/currency";

interface UpgradeConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (otp?: string) => void;
  selectedPlan?: {
    name: string;
    price: number;
    billing_cycle: string;
    currency?: string;
    features: string[];
    billing_model?: string;
    percentage_rate?: number;
    is_custom?: boolean;
  };
  isProcessing?: boolean;
  requireOtp?: boolean;
}

// Feature display mapping for user-friendly names
const FEATURE_DISPLAY_MAP: Record<string, { name: string; icon: React.ReactNode }> = {
  'reports.basic': { name: 'Basic Financial Reports', icon: <Check className="h-4 w-4" /> },
  'reports.advanced': { name: 'Advanced Analytics & Reports', icon: <Check className="h-4 w-4" /> },
  'reports.financial': { name: 'Comprehensive Financial Reports', icon: <Check className="h-4 w-4" /> },
  'maintenance.tracking': { name: 'Maintenance Request Management', icon: <Check className="h-4 w-4" /> },
  'tenant.portal': { name: 'Tenant Self-Service Portal', icon: <Check className="h-4 w-4" /> },
  'notifications.email': { name: 'Email Notifications', icon: <Check className="h-4 w-4" /> },
  'notifications.sms': { name: 'SMS Notifications', icon: <Check className="h-4 w-4" /> },
  'operations.bulk': { name: 'Bulk Operations & Imports', icon: <Check className="h-4 w-4" /> },
  'billing.automated': { name: 'Automated Billing & Invoicing', icon: <Check className="h-4 w-4" /> },
  'documents.templates': { name: 'Custom Document Templates', icon: <Check className="h-4 w-4" /> },
  'integrations.api': { name: 'API Access & Integrations', icon: <Check className="h-4 w-4" /> },
  'integrations.accounting': { name: 'Accounting Software Integration', icon: <Check className="h-4 w-4" /> },
  'team.roles': { name: 'Team & Role Management', icon: <Check className="h-4 w-4" /> },
  'team.sub_users': { name: 'Multiple User Accounts', icon: <Check className="h-4 w-4" /> },
  'branding.white_label': { name: 'White Label Solution', icon: <Crown className="h-4 w-4 text-yellow-500" /> },
  'branding.custom': { name: 'Custom Branding & Logos', icon: <Crown className="h-4 w-4 text-yellow-500" /> },
  'support.priority': { name: 'Priority Support', icon: <Shield className="h-4 w-4 text-blue-500" /> },
  'support.dedicated': { name: 'Dedicated Account Manager', icon: <Shield className="h-4 w-4 text-blue-500" /> },
};

export function UpgradeConfirmationModal({
  open,
  onOpenChange,
  onConfirm,
  selectedPlan,
  isProcessing = false,
  requireOtp = false
}: UpgradeConfirmationModalProps) {
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");

  const handleConfirm = () => {
    if (requireOtp) {
      if (!otp || otp.length !== 6) {
        setOtpError("Please enter a valid 6-digit OTP");
        return;
      }
      onConfirm(otp);
    } else {
      onConfirm();
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setOtp("");
      setOtpError("");
      onOpenChange(false);
    }
  };

  const getDisplayFeatures = (features: string[]) => {
    return features.map(feature => FEATURE_DISPLAY_MAP[feature] || { name: feature, icon: <Check className="h-4 w-4" /> });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            Confirm Upgrade
          </DialogTitle>
          <DialogDescription>
            Review your plan selection and confirm your upgrade
          </DialogDescription>
        </DialogHeader>

        {selectedPlan && (
          <div className="space-y-4">
            {/* Plan Summary */}
            <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
              <h3 className="font-semibold text-lg mb-1">{selectedPlan.name}</h3>
              <div className="text-2xl font-bold text-primary">
                {selectedPlan.is_custom ? (
                  'Custom pricing'
                ) : selectedPlan.billing_model === 'percentage' ? (
                  <>
                    {selectedPlan.percentage_rate}%
                    <span className="text-sm text-muted-foreground font-normal"> of rent collected</span>
                  </>
                ) : (
                  <>
                    {formatAmount(selectedPlan.price, selectedPlan.currency || getGlobalCurrencySync())}
                    <span className="text-sm text-muted-foreground font-normal">/{selectedPlan.billing_cycle}</span>
                  </>
                )}
              </div>
            </div>

            {/* Features List */}
            <div>
              <h4 className="font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wide">
                What's included:
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {getDisplayFeatures(selectedPlan.features).map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    {feature.icon}
                    <span>{feature.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* OTP Input if required */}
            {requireOtp && (
              <div className="space-y-2">
                <Label htmlFor="otp" className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  Verification Code
                </Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value);
                    setOtpError("");
                  }}
                  maxLength={6}
                  className={otpError ? "border-destructive" : ""}
                />
                {otpError && (
                  <Alert variant="destructive">
                    <AlertDescription>{otpError}</AlertDescription>
                  </Alert>
                )}
                <p className="text-xs text-muted-foreground">
                  We've sent a verification code to your registered email address
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isProcessing}
              >
                {isProcessing ? "Processing..." : "Confirm Upgrade"}
              </Button>
            </div>

            {/* M-Pesa Payment Notice */}
            <div className="bg-muted/50 rounded-lg p-3 border">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-green-500 mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium mb-1">M-Pesa Payment</p>
                  <p>You'll receive an M-Pesa prompt on your phone. Enter your PIN to complete the payment securely.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
