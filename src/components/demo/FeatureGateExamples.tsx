import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FeatureGate } from "@/components/ui/feature-gate";
import { PlanUpgradePrompt } from "@/components/ui/plan-upgrade-prompt";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, BarChart3, Settings, Crown } from "lucide-react";

export function FeatureGateExamples() {
  const [unitCount, setUnitCount] = useState(5);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Feature Gate Demo</h1>
        <p className="text-muted-foreground">
          Examples of how features are gated based on your current plan
        </p>
      </div>

      <Tabs defaultValue="basic" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic Features</TabsTrigger>
          <TabsTrigger value="limits">Usage Limits</TabsTrigger>
          <TabsTrigger value="premium">Premium Features</TabsTrigger>
          <TabsTrigger value="prompts">Upgrade Prompts</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <FeatureGate feature={FEATURES.BASIC_REPORTING}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Basic Reports
                  </CardTitle>
                  <CardDescription>
                    Basic reporting features available in all plans
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Occupancy Rate</span>
                      <Badge>85%</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Properties</span>
                      <Badge>3</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Active Leases</span>
                      <Badge>12</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </FeatureGate>

            <FeatureGate feature={FEATURES.TENANT_PORTAL}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Tenant Portal
                  </CardTitle>
                  <CardDescription>
                    Self-service portal for tenants
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Button className="w-full" variant="outline">
                      View Payment History
                    </Button>
                    <Button className="w-full" variant="outline">
                      Submit Maintenance Request
                    </Button>
                    <Button className="w-full" variant="outline">
                      Download Lease Agreement
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </FeatureGate>
          </div>
        </TabsContent>

        <TabsContent value="limits" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Unit Limit Demo</CardTitle>
              <CardDescription>
                Test how the system responds to unit limits
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <label htmlFor="unit-count" className="text-sm font-medium">
                  Current Units:
                </label>
                <Input
                  id="unit-count"
                  type="number"
                  value={unitCount}
                  onChange={(e) => setUnitCount(parseInt(e.target.value) || 0)}
                  className="w-24"
                />
              </div>
              
              <FeatureGate feature={FEATURES.UNITS_MAX} currentCount={unitCount}>
                <Card>
                  <CardHeader>
                    <CardTitle>Add New Property Unit</CardTitle>
                    <CardDescription>
                      Add a new unit to your property portfolio
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full">
                      Add Unit #{unitCount + 1}
                    </Button>
                  </CardContent>
                </Card>
              </FeatureGate>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="premium" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <FeatureGate 
              feature={FEATURES.ADVANCED_REPORTING}
              fallbackTitle="Advanced Analytics"
              fallbackDescription="Get detailed insights and custom reporting capabilities"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Advanced Analytics
                    <Badge variant="secondary">Pro</Badge>
                  </CardTitle>
                  <CardDescription>
                    Detailed insights and custom reports
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Button className="w-full">Generate Custom Report</Button>
                    <Button className="w-full" variant="outline">
                      Financial Forecasting
                    </Button>
                    <Button className="w-full" variant="outline">
                      Market Analysis
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </FeatureGate>

            <FeatureGate 
              feature={FEATURES.API_ACCESS}
              allowReadOnly
              readOnlyMessage="API access requires a Professional plan or higher"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    API Integration
                    <Badge variant="secondary">Enterprise</Badge>
                  </CardTitle>
                  <CardDescription>
                    Connect with third-party applications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Input placeholder="API Key" value="pk_test_..." readOnly />
                    <Button className="w-full">Regenerate Key</Button>
                    <Button className="w-full" variant="outline">
                      View Documentation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </FeatureGate>
          </div>
        </TabsContent>

        <TabsContent value="prompts" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <PlanUpgradePrompt
              currentPlan="Starter"
              title="Team Management"
              description="Add team members and manage permissions across your organization"
              benefits={[
                "Add unlimited team members",
                "Role-based access control",
                "Activity tracking & audit logs",
                "Custom permission levels"
              ]}
            />

            <PlanUpgradePrompt
              currentPlan="Professional"
              title="White Label Solution"
              description="Customize the platform with your company branding"
              benefits={[
                "Custom logo & colors",
                "Branded tenant portals",
                "Custom domain support",
                "Remove Zira branding"
              ]}
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="text-center p-6 bg-muted/50 rounded-lg">
        <Crown className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Ready to unlock all features?</h3>
        <p className="text-muted-foreground mb-4">
          Upgrade your plan to access premium functionality and remove all limitations
        </p>
        <Button>View All Plans</Button>
      </div>
    </div>
  );
}