import React, { useState, useEffect, useRef } from "react";
import { Bell, Check, CheckCheck, ExternalLink, X, AlertTriangle, CreditCard, FileText, Settings, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NotificationsPopoverProps {
  className?: string;
}

export function NotificationsPopover({ className }: NotificationsPopoverProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    getNotificationTargetUrl
  } = useNotifications();

  // Handle popover open/close
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      // Refresh notifications when opening
      fetchNotifications({ limit: 20 });
    }
  };

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    
    const filters = value === "all" ? {} : { types: [value] };
    fetchNotifications({ ...filters, limit: 20 });
  };

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if unread
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    
    // Navigate to target URL
    const targetUrl = getNotificationTargetUrl(notification);
    setOpen(false);
    navigate(targetUrl);
  };

  // Handle "View all" click
  const handleViewAll = () => {
    setOpen(false);
    const filterParam = activeTab !== "all" ? `?filter=${activeTab}` : "";
    navigate(`/notifications${filterParam}`);
  };

  // Filter notifications based on active tab
  const filteredNotifications = activeTab === "all" 
    ? notifications 
    : notifications.filter(n => n.type === activeTab);

  // Get notification icon
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "payment":
        return <CreditCard className="h-4 w-4 text-green-500" />;
      case "maintenance":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case "lease":
        return <FileText className="h-4 w-4 text-blue-500" />;
      case "system":
        return <Settings className="h-4 w-4 text-gray-500" />;
      default:
        return <Home className="h-4 w-4 text-gray-500" />;
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setOpen(false);
    }
  };

  // Notification content component for reuse
  const NotificationContent = () => (
    <div className="p-4 border-b">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Notifications</h3>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllAsRead}
              className="text-sm"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleViewAll}
            className="text-sm"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            View all
          </Button>
        </div>
      </div>
    </div>
  );

  const NotificationTabs = () => (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
      <div className="px-4 pt-2">
        <TabsList className="grid w-full grid-cols-5 h-8">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          <TabsTrigger value="payment" className="text-xs">Pay</TabsTrigger>
          <TabsTrigger value="maintenance" className="text-xs">Maint</TabsTrigger>
          <TabsTrigger value="lease" className="text-xs">Lease</TabsTrigger>
          <TabsTrigger value="system" className="text-xs">Sys</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value={activeTab} className="mt-2">
        <ScrollArea className={cn("max-h-[400px]", isMobile ? "h-[50vh]" : "h-[60vh]")}>
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">
              Loading notifications...
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">You're all caught up!</p>
              <p className="text-sm text-muted-foreground mt-1">
                No {activeTab === "all" ? "" : activeTab} notifications at the moment.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredNotifications.map((notification, index) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 hover:bg-muted/50 cursor-pointer transition-colors relative",
                    !notification.read && "bg-primary/5 border-l-2 border-l-primary"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleNotificationClick(notification);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${notification.title}: ${notification.message}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          "font-medium text-sm line-clamp-1",
                          !notification.read && "text-primary"
                        )}>
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-muted-foreground">
                          {formatTime(notification.created_at)}
                        </p>
                        <Badge 
                          variant="outline" 
                          className="text-xs capitalize"
                        >
                          {notification.type}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );

  // Format relative time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return formatDistanceToNow(date, { addSuffix: true });
    } else {
      return format(date, "MMM dd, HH:mm");
    }
  };

  // Mobile drawer implementation
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn("text-white hover:bg-white/20 relative", className)}
            aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs font-bold min-w-[20px]"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </Button>
        </DrawerTrigger>
        
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center justify-between">
              <span>Notifications</span>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={markAllAsRead}
                    className="text-sm"
                  >
                    <CheckCheck className="h-4 w-4 mr-1" />
                    Mark all read
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleViewAll}
                  className="text-sm"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View all
                </Button>
              </div>
            </DrawerTitle>
          </DrawerHeader>
          <NotificationTabs />
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop popover implementation
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn("text-white hover:bg-white/20 relative", className)}
          aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs font-bold min-w-[20px]"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent 
        className="w-80 md:w-96 p-0 mr-4 bg-popover border border-border" 
        align="end" 
        side="bottom"
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-label="Notifications"
      >
        <NotificationContent />
        <NotificationTabs />
      </PopoverContent>
    </Popover>
  );
}