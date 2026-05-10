import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  Users, 
  Building, 
  CreditCard, 
  Settings, 
  MessageSquare, 
  FileText, 
  Calendar,
  CheckCircle2,
  Trophy
} from "lucide-react";

interface ExploreFeaturesStepProps {
  step: any;
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

export function ExploreFeaturesStep({ step, onNext }: ExploreFeaturesStepProps) {
  const features = [
    {
      icon: Building,
      name: "Property Management",
      description: "Add and manage multiple properties with detailed information",
      available: true
    },
    {
      icon: Users,
      name: "Tenant Management",
      description: "Track tenant information, leases, and communication history",
      available: true
    },
    {
      icon: CreditCard,
      name: "Payment Tracking",
      description: "Monitor rent payments, late fees, and payment history",
      available: true
    },
    {
      icon: BarChart3,
      name: "Financial Reports",
      description: "Generate income statements and financial analytics",
      available: true
    },
    {
      icon: Settings,
      name: "Maintenance Requests",
      description: "Handle and track maintenance issues efficiently",
      available: true
    },
    {
      icon: MessageSquare,
      name: "Communication Hub",
      description: "Send announcements and communicate with tenants",
      available: true
    },
    {
      icon: FileText,
      name: "Document Management",
      description: "Store and manage leases, contracts, and important documents",
      available: false
    },
    {
      icon: Calendar,
      name: "Calendar Integration",
      description: "Schedule property inspections and maintenance appointments",
      available: false
    }
  ];

  const availableFeatures = features.filter(f => f.available);
  const upgradeFeatures = features.filter(f => !f.available);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="p-4 bg-primary/10 rounded-full">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-primary">Congratulations! 🎉</h2>
        <p className="text-lg text-muted-foreground">
          You've successfully set up your property management account. Here's what you can do now:
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Available in Your Trial
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {availableFeatures.map((feature, index) => (
              <Card key={index} className="border-2 border-success/20 bg-success/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 text-base">
                    <div className="p-1.5 bg-success/10 rounded-lg">
                      <feature.icon className="h-4 w-4 text-success" />
                    </div>
                    {feature.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              Premium
            </Badge>
            Upgrade to Unlock
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {upgradeFeatures.map((feature, index) => (
              <Card key={index} className="border-2 border-border bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 text-base text-muted-foreground">
                    <div className="p-1.5 bg-muted rounded-lg">
                      <feature.icon className="h-4 w-4" />
                    </div>
                    {feature.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-primary">Ready to Get Started!</h3>
        <p className="text-sm text-muted-foreground">
          Your trial includes access to core property management features. You can start adding tenants, 
          tracking payments, and managing maintenance requests right away.
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">30-day free trial</Badge>
          <Badge variant="secondary">Up to 2 properties</Badge>
          <Badge variant="secondary">Up to 10 units</Badge>
          <Badge variant="secondary">Core features included</Badge>
        </div>
      </div>

      <div className="text-center">
        <Button onClick={onNext} size="lg" className="bg-primary hover:bg-primary/90">
          Complete Setup & Start Managing
        </Button>
      </div>
    </div>
  );
}