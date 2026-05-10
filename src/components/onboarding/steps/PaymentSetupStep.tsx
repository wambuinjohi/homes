import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Building2, Smartphone, CheckCircle2 } from "lucide-react";

interface PaymentSetupStepProps {
  step: any;
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

export function PaymentSetupStep({ step, onNext }: PaymentSetupStepProps) {
  const [selectedMethod, setSelectedMethod] = useState('');

  const paymentMethods = [
    {
      id: 'bank_transfer',
      name: 'Bank Transfer',
      description: 'Direct bank transfers from tenants',
      icon: Building2,
      popular: true
    },
    {
      id: 'mpesa',
      name: 'M-Pesa',
      description: 'Mobile money payments via M-Pesa',
      icon: Smartphone,
      popular: true
    },
    {
      id: 'credit_card',
      name: 'Credit/Debit Cards',
      description: 'Accept card payments online',
      icon: CreditCard,
      popular: false
    }
  ];

  const handleContinue = () => {
    // In a real implementation, this would save the payment preferences
    onNext();
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="p-4 bg-primary/10 rounded-full">
            <CreditCard className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-primary">Configure Payment Methods</h2>
        <p className="text-muted-foreground">
          Choose how you'd like to receive rent payments from your tenants.
        </p>
      </div>

      <div className="space-y-4">
        {paymentMethods.map((method) => (
          <Card 
            key={method.id}
            className={`cursor-pointer transition-all border-2 ${
              selectedMethod === method.id 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'
            }`}
            onClick={() => setSelectedMethod(method.id)}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <method.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span>{method.name}</span>
                      {method.popular && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          Popular
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground font-normal">
                      {method.description}
                    </p>
                  </div>
                </div>
                {selectedMethod === method.id && (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                )}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="bg-muted/30 rounded-lg p-4">
        <h4 className="font-medium mb-2 flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            Note
          </Badge>
          Payment Configuration
        </h4>
        <p className="text-sm text-muted-foreground">
          You can enable multiple payment methods and configure the details later in your payment settings. 
          This step helps us understand your preferred payment collection method.
        </p>
      </div>

      <div className="flex justify-center">
        <Button
          onClick={handleContinue}
          size="lg"
        >
          Continue with Setup
        </Button>
      </div>
    </div>
  );
}