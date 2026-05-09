
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SelfHostedInstancesManager } from '@/components/admin/SelfHostedInstancesManager';
import { TelemetryDashboard } from '@/components/admin/TelemetryDashboard';
import { useRouteTitle } from '@/hooks/useRouteTitle';
import { DashboardLayout } from '@/components/DashboardLayout';

export default function SelfHostedMonitoring() {
  useRouteTitle();

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Self-Hosted Monitoring</h1>
          <p className="text-muted-foreground mt-2">
            Monitor and manage self-hosted deployments
          </p>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="instances">Instances</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <TelemetryDashboard />
          </TabsContent>

          <TabsContent value="instances" className="space-y-6">
            <SelfHostedInstancesManager />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
