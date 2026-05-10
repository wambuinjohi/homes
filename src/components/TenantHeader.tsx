import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/context/RoleContext";
import { useRouteTitle } from "@/hooks/useRouteTitle";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Bell, User, Sun, Moon, Monitor, Settings, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { NotificationsPopover } from "@/components/notifications/NotificationsPopover";
import { TourLauncher } from "@/components/onboarding/TourLauncher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Prefetch tenant routes for faster navigation (explicit paths for build compatibility)
const routePrefetchMap: Record<string, () => Promise<any>> = {
  TenantProfile: () => import("@/pages/tenant/TenantProfile.tsx"),
  TenantPaymentPreferences: () => import("@/pages/tenant/TenantPaymentPreferences.tsx"),
};
const prefetchTenantRoute = (path: string) => {
  const loader = routePrefetchMap[path];
  if (loader) loader().catch(() => {});
};

export function TenantHeader() {
  const { user, signOut } = useAuth();
  const { assignedRoles, effectiveRole } = useRole();
  const routeTitle = useRouteTitle();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState<{ first_name: string; last_name: string; avatar_url?: string } | null>(null);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();
      setUserProfile(data);
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const getUserDisplayName = () => {
    if (userProfile?.first_name && userProfile?.last_name) {
      return `${userProfile.first_name} ${userProfile.last_name}`;
    }
    return user?.email || "User";
  };

  return (
    <header className="header-gradient sticky top-0 z-20 w-full flex h-16 shrink-0 items-center border-b">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="text-white hover:bg-white/20" />
        <Separator orientation="vertical" className="mr-2 h-4 bg-white/30" />
      </div>
      
      <div className="flex flex-1 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm p-1">
            <img 
              src="/lovable-uploads/5143fc86-0273-406f-b5f9-67cc9d4bc7f6.png" 
              alt="Zira Homes Logo" 
              className="w-6 h-6 object-contain"
            />
          </div>
            <div className="flex flex-col leading-none">
              <h1 className="text-[11px] sm:text-lg font-bold text-white whitespace-nowrap tracking-tight">{routeTitle}</h1>
              <p className="hidden sm:block text-xs text-white/80 -mt-0.5">Your Home Management</p>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
          <NotificationsPopover />
          
          <TourLauncher />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                <div className="w-6 h-6 bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm">
                  {theme === 'light' ? <Sun className="h-3 w-3" /> : 
                   theme === 'dark' ? <Moon className="h-3 w-3" /> : 
                   <Monitor className="h-3 w-3" />}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel className="font-medium text-xs">Theme</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="cursor-pointer" 
                onClick={() => setTheme('light')}
              >
                <Sun className="mr-2 h-4 w-4" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer" 
                onClick={() => setTheme('dark')}
              >
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer" 
                onClick={() => setTheme('system')}
              >
                <Monitor className="mr-2 h-4 w-4" />
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                <div className="w-6 h-6 bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <User className="h-3 w-3" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-medium">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{getUserDisplayName()}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => navigate("/tenant/profile")}
                onMouseEnter={() => prefetchTenantRoute("TenantProfile")}
                className="cursor-pointer"
              >
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate("/tenant/payment-preferences")}
                onMouseEnter={() => prefetchTenantRoute("TenantPaymentPreferences")}
                className="cursor-pointer"
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer text-red-600" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
