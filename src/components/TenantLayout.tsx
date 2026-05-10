import React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TenantSidebar } from "@/components/TenantSidebar";
import { TenantHeader } from "@/components/TenantHeader";

interface TenantLayoutProps {
  children: React.ReactNode;
}

export function TenantLayout({ children }: TenantLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <TenantSidebar />
        <SidebarInset className="flex flex-1 flex-col min-w-0">
          <TenantHeader />
          <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-x-hidden">
            <div className="max-w-full">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}