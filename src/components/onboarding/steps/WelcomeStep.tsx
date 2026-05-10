import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Rocket, Users, Building, BarChart3, Clock } from "lucide-react";

interface WelcomeStepProps {
  step: any;
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

export function WelcomeStep({ step, onNext }: WelcomeStepProps) {
  const features = [
    {
      icon: Building,
      title: "Property Management",
      description: "Organize and track all your properties in one place"
    },
    {
      icon: Users,
      title: "Tenant Management",
      description: "Manage tenant information, leases, and communications"
    },
    {
      icon: BarChart3,
      title: "Financial Tracking",
      description: "Monitor payments, expenses, and generate reports"
    },
    {
      icon: Clock,
      title: "Maintenance Requests",
      description: "Handle maintenance efficiently with our tracking system"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="p-4 bg-primary/10 rounded-full">
            <Rocket className="h-12 w-12 text-primary" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-primary">Welcome to Your Property Management Platform!</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          We're excited to help you streamline your property management. This quick setup will get you started 
          with the essential features to manage your properties efficiently.
        </p>
        <Badge variant="secondary" className="bg-primary/10 text-primary">
          Setup takes about 5-10 minutes
        </Badge>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {features.map((feature, index) => (
          <Card key={index} className="border-2 border-border hover:border-primary/50 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                {feature.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-muted/30 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold">What we'll set up together:</h3>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span>Your profile and preferences</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span>Your first property</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span>Property units</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span>Payment methods</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span>Tenant invitations</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span>Platform tour</span>
          </div>
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Don't worry - you can always modify these settings later in your dashboard.
        </p>
      </div>
    </div>
  );
}