import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

export function SidebarSkeleton() {
  const { open } = useSidebar();

  return (
    <Sidebar variant="sidebar">
      <SidebarHeader>
        <div className="flex items-center space-x-2 p-2">
          <Skeleton className="h-8 w-8 rounded" />
          {open && (
            <Skeleton className="h-5 w-24" />
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent className="gap-0.5 py-2">
        {/* Main navigation skeleton */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground h-8 py-1">
            <Skeleton className="h-3 w-16" />
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <SidebarMenuItem key={i}>
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <Skeleton className="h-4 w-4" />
                    {open && <Skeleton className="h-3 w-20" />}
                  </div>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Secondary navigation skeleton */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground h-8 py-1">
            <Skeleton className="h-3 w-20" />
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <SidebarMenuItem key={i}>
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <Skeleton className="h-4 w-4" />
                    {open && <Skeleton className="h-3 w-16" />}
                  </div>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <Skeleton className="h-4 w-4" />
              {open && <Skeleton className="h-3 w-16" />}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}