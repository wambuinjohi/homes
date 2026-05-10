import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface NotificationRealtimeData {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  user_id: string;
  related_id?: string;
  related_type?: string;
}

interface UseNotificationsRealtimeProps {
  onNewNotification?: (notification: NotificationRealtimeData) => void;
  onNotificationUpdate?: (notification: NotificationRealtimeData) => void;
}

export function useNotificationsRealtime({ 
  onNewNotification, 
  onNotificationUpdate 
}: UseNotificationsRealtimeProps) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Subscribe to notifications changes for the current user
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
          const newNotification = payload.new as NotificationRealtimeData;
          
          // Show toast notification for new unread notifications
          if (!newNotification.read) {
            toast.info(newNotification.title, {
              description: newNotification.message,
              action: {
                label: "View",
                onClick: () => {
                  // Navigate to notification or mark as read
                  window.location.href = "/notifications";
                }
              }
            });
          }
          
          onNewNotification?.(newNotification);
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
          const updatedNotification = payload.new as NotificationRealtimeData;
          onNotificationUpdate?.(updatedNotification);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Connected to notifications realtime channel');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Error connecting to notifications realtime channel');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, onNewNotification, onNotificationUpdate]);

  return null;
}