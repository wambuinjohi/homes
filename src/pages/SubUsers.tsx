import SubUserManagement from "@/components/landlord/SubUserManagement";
import { DashboardLayout } from "@/components/DashboardLayout";

export default function SubUsers() {
  return (
    <DashboardLayout>
      <div className="bg-tint-gray p-3 sm:p-4 lg:p-6 space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Sub-User Management</h1>
          <p className="text-muted-foreground">
            Manage sub-users and their permissions for your organization.
          </p>
        </div>
        <SubUserManagement />
      </div>
    </DashboardLayout>
  );
}