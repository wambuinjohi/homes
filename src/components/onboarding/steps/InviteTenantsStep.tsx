import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Mail, MessageSquare, CheckCircle2, Users } from "lucide-react";

interface InviteTenantsStepProps {
  step: any;
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

export function InviteTenantsStep({ step, onNext }: InviteTenantsStepProps) {
  const [selectedMethod, setSelectedMethod] = useState('');

  const inviteMethods = [
    {
      id: 'email',
      name: 'Email Invitations',
      description: 'Send email invites to tenants to join the platform',
      icon: Mail,
      recommended: true
    },
    {
      id: 'sms',
      name: 'SMS Invitations',
      description: 'Send SMS invites with login instructions',
      icon: MessageSquare,
      recommended: false
    },
    {
      id: 'manual',
      name: 'Manual Setup',
      description: 'Add tenant information manually without invites',
      icon: UserPlus,
      recommended: false
    }
  ];

  const handleContinue = () => {
    // In a real implementation, this would save the invitation preferences
    onNext();
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="p-4 bg-primary/10 rounded-full">
            <Users className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-primary">Invite Your Tenants</h2>
        <p className="text-muted-foreground">
          Choose how you'd like to onboard your tenants to the platform.
        </p>
      </div>

      <div className="space-y-4">
        {inviteMethods.map((method) => (
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
                      {method.recommended && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          Recommended
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

      <div className="bg-muted/30 rounded-lg p-4 space-y-3">
        <h4 className="font-medium mb-2 flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            Benefits
          </Badge>
          Tenant Platform Access
        </h4>
        <div className="grid md:grid-cols-2 gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span>View and pay rent online</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span>Submit maintenance requests</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span>Access lease documents</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span>Receive important notifications</span>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <Button
          onClick={handleContinue}
          size="lg"
        >
          Continue Setup
        </Button>
      </div>
    </div>
  );
}