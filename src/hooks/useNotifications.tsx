import { useState, useEffect, useCallback } from "react";
import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'payment' | 'lease' | 'maintenance' | 'system' | 'support';
  read: boolean;
  created_at: string;
  related_id?: string;
  related_type?: string;
}

interface NotificationFilters {
  types?: string[];
  limit?: number;
  unreadOnly?: boolean;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async (filters: NotificationFilters = {}) => {
    if (!user) return;

    try {
      let query = supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (filters.types && filters.types.length > 0) {
        query = query.in("type", filters.types);
      }

      if (filters.unreadOnly) {
        query = query.eq("read", false);
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      const typedData = (data || []).map(item => ({
        ...item,
        type: item.type as Notification["type"]
      })) as Notification[];

      setNotifications(typedData);
      updateUnreadCount(typedData);
    } catch (error) {
      // Better serialize errors for logging
      let serialized;
      try {
        serialized = JSON.stringify(error, Object.getOwnPropertyNames(error));
      } catch (e) {
        serialized = String(error);
      }

      const message = String((error as any)?.message || serialized).toLowerCase();
      if (message.includes('failed to fetch')) {
        console.error('Error fetching notifications: network/fetch failed. Falling back to server proxy...', serialized);
        try {
          const { data: session } = await supabase.auth.getSession();
          const access = session?.session?.access_token;
          // Build PostgREST URL with filters
          const params: string[] = [
            'select=*',
            `user_id=eq.${encodeURIComponent(user.id)}`,
            'order=created_at.desc'
          ];
          if (filters.unreadOnly) params.push('read=eq.false');
          if (filters.types && filters.types.length > 0) {
            const inList = filters.types.map(t => `'${t}'`).join(',');
            params.push(`type=in.(${encodeURIComponent(inList)})`);
          }
          if (filters.limit) params.push(`limit=${filters.limit}`);

          const targetUrl = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/notifications?${params.join('&')}`;
          const res = await fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(access ? { Authorization: `Bearer ${access}` } : {}) },
            body: JSON.stringify({ url: targetUrl, method: 'GET' })
          });
          const proxyData = await res.json();
          if (res.ok && Array.isArray(proxyData)) {
            const typedData = proxyData.map((item: any) => ({ ...item, type: item.type as Notification["type"] })) as Notification[];
            setNotifications(typedData);
            updateUnreadCount(typedData);
            return;
          }
        } catch (proxyErr) {
          console.error('Proxy fallback for notifications failed:', proxyErr);
        }
      } else {
        console.error('Error fetching notifications:', serialized);
      }

      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updateUnreadCount = useCallback((notificationList: Notification[]) => {
    const unread = notificationList.filter(n => !n.read).length;
    setUnreadCount(unread);
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      // Optimistic update
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) throw error;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      // Revert optimistic update
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;

    try {
      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);

      if (error) throw error;
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      // Revert optimistic update
      fetchNotifications();
    }
  }, [user, fetchNotifications]);

  const getNotificationTargetUrl = useCallback((notification: Notification): string => {
    switch (notification.related_type) {
      case 'payment':
        return '/payments';
      case 'invoice':
        return '/invoices';
      case 'lease':
        return '/leases';
      case 'maintenance_request':
        return '/maintenance';
      case 'support_ticket':
        return '/support';
      default:
        return '/notifications';
    }
  }, []);

  // Set up realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          
          // Add to notifications list
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Show toast for new unread notifications
          if (!newNotification.read) {
            toast.info(newNotification.title, {
              description: newNotification.message,
              action: {
                label: "View",
                onClick: () => {
                  window.location.href = getNotificationTargetUrl(newNotification);
                }
              }
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const updatedNotification = payload.new as Notification;
          setNotifications(prev => 
            prev.map(n => 
              n.id === updatedNotification.id ? updatedNotification : n
            )
          );
          
          // Update unread count
          setNotifications(currentNotifications => {
            updateUnreadCount(currentNotifications);
            return currentNotifications;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, getNotificationTargetUrl, updateUnreadCount]);

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user, fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    getNotificationTargetUrl
  };
}
