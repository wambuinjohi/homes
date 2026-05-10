import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AppRoutes } from "@/routes/AppRoutes";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/hooks/useAuth";
import { RoleProvider } from "@/context/RoleContext";
import { ImpersonationBanner } from "@/components/security/ImpersonationBanner";
import { queryClient } from "@/config/queryClient";
import "./App.css";
import React from "react";
import { createSampleTenantNoLease } from "@/utils/createSampleTenant";

function App() {
  React.useEffect(() => {
    const key = "autoTenantCreated_v1";
    const already = typeof window !== 'undefined' && window.localStorage?.getItem(key);
    const autoSeed = import.meta.env.VITE_AUTO_SEED_SAMPLE === 'true';
    if (already || !autoSeed) return;

    createSampleTenantNoLease()
      .then((data) => {
        try { window.localStorage?.setItem(key, "1"); } catch {}
        console.log("Sample tenant created:", data?.tenant?.id || data);
      })
      .catch((e) => {
        console.error("Auto-create sample tenant failed:", e);
      });
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        <AuthProvider>
          <RoleProvider>
            <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <BrowserRouter basename={import.meta.env.VITE_BASE_PATH || "/"}>
                <ImpersonationBanner />
                <AppRoutes />
                <Toaster />
              </BrowserRouter>
            </TooltipProvider>
            </QueryClientProvider>
          </RoleProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
