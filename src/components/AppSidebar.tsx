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
import { SidebarSkeleton } from "@/components/ui/SidebarSkeleton";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/context/RoleContext";
import { prefetchRoute } from "@/utils/routePrefetch";
import { adminNav, landlordNav, accountNav } from "@/config/navigation";
import { usePlanFeatureAccess, FEATURES } from "@/hooks/usePlanFeatureAccess";
import { LockedMenuItem } from "@/components/ui/locked-menu-item";
import { useTrialManagement } from "@/hooks/useTrialManagement";

export function AppSidebar() {
  const { signOut } = useAuth();
  const { open } = useSidebar();
  const { isAdmin, isLandlord, isManager, isAgent, isSubUser, isTenant, assignedRoles, subUserPermissions, isOnLandlordTrial, loading } = useRole();
  const { trialStatus } = useTrialManagement();

  // Check if user is tenant-only (has tenant role but no other roles)
  const isTenantOnly = isTenant && assignedRoles.length === 1 && assignedRoles[0] === "tenant";

  // Feature access hooks
  const { allowed: hasReports } = usePlanFeatureAccess(FEATURES.BASIC_REPORTING);
  const { allowed: hasSubUsers } = usePlanFeatureAccess(FEATURES.SUB_USERS);
  const { allowed: hasCustomTemplates } = usePlanFeatureAccess(FEATURES.CUSTOM_EMAIL_TEMPLATES);
  const { allowed: hasAdvancedReports } = usePlanFeatureAccess(FEATURES.ADVANCED_REPORTING);
  const { allowed: hasExpenseTracking } = usePlanFeatureAccess(FEATURES.EXPENSE_TRACKING);
  const { allowed: hasSmsFeatures } = usePlanFeatureAccess(FEATURES.SMS_NOTIFICATIONS);

  // Check if user has Professional, Enterprise, Admin plan, OR is on trial - no locks for these
  const isPremiumPlan = (trialStatus?.planName && 
    ['Professional', 'Enterprise', 'Admin', 'Pro'].includes(trialStatus.planName)) ||
    trialStatus?.isActive || // TRIAL USERS GET FULL ACCESS
    isAdmin;

  // Show skeleton while role is loading
  if (loading) {
    return <SidebarSkeleton />;
  }

  return (
    <Sidebar variant="sidebar">
      <SidebarHeader>
        <NavLink 
          to={isAdmin ? "/admin" : "/"}
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
        {isAdmin && adminNav.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="text-orange-500 h-8 py-1">{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items
                  .filter((item) => {
                    // Hide "Sub Users" for non-landlords
                    if (!isLandlord && item.title === "Sub Users") {
                      return false;
                    }
                    return true;
                  })
                  .map((item) => {
                    // Check feature access for specific items
                    const isReportsItem = item.title === "Reports";
                    const isSubUsersItem = item.title === "Sub Users";
                    const isEmailTemplatesItem = item.title === "Email Templates";
                    const isMessageTemplatesItem = item.title === "Message Templates";
                    
                    // Skip locks for premium plans and admins
                    const isLocked = !isPremiumPlan && (
                      (isReportsItem && !hasReports && !hasAdvancedReports) || 
                      (isSubUsersItem && !hasSubUsers) ||
                      (isEmailTemplatesItem && !hasCustomTemplates) ||
                      (isMessageTemplatesItem && !hasCustomTemplates)
                    );

                    return (
                      <SidebarMenuItem key={item.title}>
                        <LockedMenuItem 
                          isLocked={isLocked}
                          requiredPlan={
                            isReportsItem ? "Professional" :
                            isSubUsersItem ? "Professional" :
                            (isEmailTemplatesItem || isMessageTemplatesItem) ? "Professional" :
                            "Professional"
                          }
                          featureTier={
                            isReportsItem ? "professional" :
                            isSubUsersItem ? "professional" :
                            (isEmailTemplatesItem || isMessageTemplatesItem) ? "professional" :
                            "professional"
                          }
                          lockMessage={
                            isReportsItem ? "Upgrade to Professional for advanced reporting" :
                            isSubUsersItem ? "Upgrade to Professional to manage team members" :
                            (isEmailTemplatesItem || isMessageTemplatesItem) ? "Upgrade to Professional for custom templates" :
                            "Upgrade to Professional to access this feature"
                          }
                        >
                          <SidebarMenuButton asChild size="sm">
                            <NavLink 
                              to={item.url}
                              onMouseEnter={() => prefetchRoute(item.url)}
                              className={`flex items-center gap-2 ${isLocked ? 'opacity-75' : ''}`}
                            >
                              <item.icon className="h-4 w-4" />
                              {open && (
                                <div className="flex items-center justify-between w-full">
                                  <span>{item.title}</span>
                                </div>
                              )}
                            </NavLink>
                          </SidebarMenuButton>
                        </LockedMenuItem>
                      </SidebarMenuItem>
                    );
                  })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {(isLandlord || isManager || isAgent || isSubUser) && !isAdmin && landlordNav.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="text-orange-500 h-8 py-1">{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.filter((item) => {
                  // Always hide administrative items from sub-users
                  if (isSubUser) {
                    const subUserBlockedItems = [
                      "Sub Users",
                      "Billing Panel", 
                      "Payment Settings"
                    ];
                    
                    if (subUserBlockedItems.includes(item.title)) {
                      return false;
                    }
                  }

                  // Filter navigation for sub-users based on permissions (SECURE BY DEFAULT)
                  if (isSubUser) {
                    // Whitelist of always-visible items for sub-users
                    const alwaysVisibleForSubUsers = ["Dashboard", "Settings", "Support", "Knowledge Base"];
                    
                    // Always show whitelisted items
                    if (alwaysVisibleForSubUsers.includes(item.title)) {
                      return true;
                    }
                    
                    // Map menu items to required permissions
                    const permissionMap: Record<string, string> = {
                      "Properties": "manage_properties",
                      "Units": "manage_properties",
                      "Tenants": "manage_tenants",
                      "Leases": "manage_leases",
                      "Payments": "manage_payments",
                      "Invoices": "manage_payments",
                      "Reports": "view_reports",
                      "Maintenance": "manage_maintenance",
                      "Expenses": "manage_expenses",
                      "Email Templates": "send_messages",
                      "Message Templates": "send_messages",
                      "Notifications": "view_reports",
                      "Sub Users": "never", // Never show this to sub-users
                      "Billing Panel": "never",
                      "Payment Settings": "never",
                      "Upgrade": "never",
                    };
                    
                    const requiredPermission = permissionMap[item.title];
                    
                    // SECURE BY DEFAULT: If item has no permission mapping or marked as "never", hide it
                    if (!requiredPermission || requiredPermission === "never") {
                      return false;
                    }
                    
                    // FAIL CLOSED: If permissions not loaded yet or permission is false, hide item
                    if (!subUserPermissions || subUserPermissions[requiredPermission] !== true) {
                      return false;
                    }
                  }
                  return true;
                }).map((item) => {
                  // Check feature access for specific items
                  const isReportsItem = item.title === "Reports";
                  const isSubUsersItem = item.title === "Sub Users";
                  const isEmailTemplatesItem = item.title === "Email Templates";
                  const isMessageTemplatesItem = item.title === "Message Templates";
                  const isExpensesItem = item.title === "Expenses";
                  const isBulkSMSItem = item.title === "Bulk SMS";
                  const isSMSUsageItem = item.title === "SMS Usage";
                  
                   // Show partial lock for Reports since some reports are locked (skip for premium plans)
                   const isPartiallyLocked = !isPremiumPlan && isReportsItem && (hasReports || hasAdvancedReports) && !hasAdvancedReports;
                   const isFullyLocked = !isPremiumPlan && (
                     (isReportsItem && !hasReports && !hasAdvancedReports) || 
                     (isSubUsersItem && !hasSubUsers) ||
                     (isEmailTemplatesItem && !hasCustomTemplates) ||
                     (isMessageTemplatesItem && !hasCustomTemplates) ||
                     (isExpensesItem && !hasExpenseTracking) ||
                     (isBulkSMSItem && !hasSmsFeatures) ||
                     (isSMSUsageItem && !hasSmsFeatures)
                   );

                   return (
                     <SidebarMenuItem key={item.title}>
                       <LockedMenuItem 
                         isLocked={isFullyLocked}
                         isPartiallyLocked={isPartiallyLocked}
                         requiredPlan={
                           isReportsItem && isPartiallyLocked ? "Professional" :
                           isReportsItem ? "Starter" :
                           isSubUsersItem ? "Professional" :
                           (isEmailTemplatesItem || isMessageTemplatesItem) ? "Professional" :
                           isExpensesItem ? "Starter" :
                           (isBulkSMSItem || isSMSUsageItem) ? "Professional" :
                           "Professional"
                         }
                         featureTier={
                           isReportsItem && !isPartiallyLocked ? "starter" :
                           isReportsItem ? "professional" :
                           isSubUsersItem ? "professional" :
                           (isEmailTemplatesItem || isMessageTemplatesItem) ? "professional" :
                           isExpensesItem ? "starter" :
                           (isBulkSMSItem || isSMSUsageItem) ? "professional" :
                           "professional"
                         }
                         lockMessage={
                           isReportsItem && isPartiallyLocked ? "Some reports require Professional plan" :
                           isReportsItem ? "Upgrade to Starter for reporting features" :
                           isSubUsersItem ? "Upgrade to Professional to manage team members" :
                           (isEmailTemplatesItem || isMessageTemplatesItem) ? "Upgrade to Professional for custom templates" :
                           isExpensesItem ? "Upgrade to Starter for expense tracking" :
                           isBulkSMSItem ? "Upgrade to Professional for bulk SMS messaging" :
                           isSMSUsageItem ? "Upgrade to Professional to view SMS usage analytics" :
                           "Upgrade to Professional to access this feature"
                         }
                       >
                         <SidebarMenuButton asChild size="sm">
                           <NavLink 
                             to={item.url}
                             onMouseEnter={() => prefetchRoute(item.url)}
                             className="flex items-center gap-2"
                           >
                             <item.icon className="h-4 w-4" />
                             {open && (
                               <div className="flex items-center justify-between w-full">
                                 <span>{item.title}</span>
                               </div>
                             )}
                           </NavLink>
                         </SidebarMenuButton>
                       </LockedMenuItem>
                     </SidebarMenuItem>
                   );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarGroup>
          <SidebarGroupLabel className="text-orange-500 h-8 py-1">{accountNav.title}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {accountNav.items
                .filter((item) => {
                  // Hide upgrade for admins, sub-users, and tenant-only users
                  if ((isAdmin || isSubUser || isTenantOnly) && item.title === "Upgrade") {
                    return false;
                  }
                  // Hide settings for tenant-only users (they use tenant portal settings)
                  if (isTenantOnly && item.title === "Settings") {
                    return false;
                  }
                  return true;
                })
                .map((item) => (
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