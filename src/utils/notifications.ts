import { supabase } from "@/integrations/supabase/client";

interface NotificationRequest {
  maintenance_request_id: string;
  notification_type: "status_change" | "assignment" | "resolution";
  tenant_id: string;
  old_status?: string;
  new_status?: string;
  service_provider_name?: string;
  message?: string;
}

export const sendMaintenanceNotification = async (request: NotificationRequest) => {
  try {
    console.log("Sending maintenance notification:", request);

    const { data, error } = await supabase.functions.invoke('send-maintenance-notification', {
      body: request,
    });

    if (error) {
      console.error("Error sending notification:", error);
      throw error;
    }

    console.log("Notification sent successfully:", data);
    return data;
  } catch (error) {
    console.error("Failed to send notification:", error);
    throw error;
  }
};

export default sendMaintenanceNotification;