import React from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { User, Bell, Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/context/RoleContext";
import { useRouteTitle } from "@/hooks/useRouteTitle";
import { supabase } from "@/integrations/supabase/client";
import { UpgradeButton } from "@/components/billing";
import { HeaderTrialCountdown } from "@/components/trial/HeaderTrialCountdown";
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
import { useState, useEffect } from "react";

export function Header() {
  const { user, signOut } = useAuth();
  const { effectiveRole, assignedRoles } = useRole();
  const { theme, setTheme } = useTheme();
  const routeTitle = useRouteTitle();
  const isDev = import.meta.env.DEV;
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const getUserDisplayName = () => {
    // Use user metadata first for performance, then fallback to email
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name;
    }
    if (user?.user_metadata?.first_name && user?.user_metadata?.last_name) {
      return `${user.user_metadata.first_name} ${user.user_metadata.last_name}`;
    }
    return user?.email || "User";
  };
  return (
    <header className="header-gradient sticky top-0 z-20 w-full flex h-16 shrink-0 items-center px-0 border-b">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="text-white hover:bg-white/20" />
        <Separator orientation="vertical" className="mr-2 h-4 bg-white/30" />
      </div>
      
      <div className="flex flex-1 items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
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
              <p className="hidden sm:block text-xs text-white/80 -mt-0.5">Property Management</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Dev role debug badge */}
          {isDev && (
            <div className="hidden lg:flex items-center gap-1 px-2 py-1 bg-white/10 rounded text-xs text-white/80 font-mono">
              <span className="font-semibold">Role:</span>
              <span>{effectiveRole || 'null'}</span>
            </div>
          )}

          {/* Trial countdown and upgrade button grouped together */}
          <div className="flex items-center gap-2">
            <HeaderTrialCountdown />
            <UpgradeButton variant="outline" size="sm" className="hidden sm:inline-flex bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white" />
          </div>
          
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
              <DropdownMenuItem className="cursor-pointer" onClick={() => window.location.href = '/settings'}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={() => window.location.href = '/settings'}>
                <Bell className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer text-red-600" onClick={handleSignOut}>
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}