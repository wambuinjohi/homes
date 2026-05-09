import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Home,
  CreditCard,
  Wrench,
  User,
  Settings,
  LogOut,
  HelpCircle,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { prefetchRoute } from "@/utils/routePrefetch";
import ziraLogo from "@/assets/zira-logo.png";

const tenantMainItems = [
  { title: "Dashboard", url: "/tenant", icon: Home },
  { title: "Payments", url: "/tenant/payments", icon: CreditCard },
  { title: "Maintenance", url: "/tenant/maintenance", icon: Wrench },
];

const tenantAccountItems = [
  { title: "Profile", url: "/tenant/profile", icon: User },
  { title: "Messages", url: "/tenant/messages", icon: MessageSquare },
  { title: "Payment Settings", url: "/tenant/payment-preferences", icon: Settings },
  { title: "Help & Support", url: "/tenant/support", icon: HelpCircle },
];

export function TenantSidebar() {
  const { user, signOut } = useAuth();
  const { open } = useSidebar();

  return (
    <Sidebar variant="sidebar">
      <SidebarHeader>
        <NavLink 
          to="/tenant"
          className="flex items-center space-x-2 p-2 hover:bg-accent rounded-lg transition-colors"
        >
          <img 
            src="/lovable-uploads/5143fc86-0273-406f-b5f9-67cc9d4bc7f6.png" 
            alt="Zira Homes" 
            className="h-8 w-8 flex-shrink-0 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/app-icon.png";
            }}
          />
          {open && (
            <span className="font-semibold text-lg text-white">
              Zira Homes
            </span>
          )}
        </NavLink>
      </SidebarHeader>
      
      <SidebarContent className="gap-0.5 py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-orange-500 h-8 py-1">Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {tenantMainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild size="sm">
                    <NavLink 
                      to={item.url} 
                      onMouseEnter={() => prefetchRoute(item.url)}
                      className="flex items-center gap-2"
                    >
                      <item.icon className="h-4 w-4" />
                      {open && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-orange-500 h-8 py-1">Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {tenantAccountItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild size="sm">
                    <NavLink 
                      to={item.url} 
                      onMouseEnter={() => prefetchRoute(item.url)}
                      className="flex items-center gap-2"
                    >
                      <item.icon className="h-4 w-4" />
                      {open && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut}>
              <LogOut className="h-4 w-4" />
              {open && <span>Sign Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}