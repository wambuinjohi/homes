import { DashboardLayout } from "@/components/DashboardLayout";
import { FlowTester } from "@/components/comprehensive-test/FlowTester";

export default function FlowTestPage() {
  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-primary">System Flow Testing</h1>
          <p className="text-muted-foreground">
            Comprehensive testing suite for property management flow validation
          </p>
        </div>
        <FlowTester />
      </div>
    </DashboardLayout>
  );
}