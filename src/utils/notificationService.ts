import { supabase } from "@/integrations/supabase/client";

export interface CreateNotificationParams {
  user_id: string;
  title: string;
  message: string;
  type: 'payment' | 'lease' | 'maintenance' | 'system' | 'support';
  related_id?: string;
  related_type?: string;
}

export const createNotification = async (params: CreateNotificationParams) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert([params])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

export const createPaymentNotification = async (
  userId: string, 
  paymentAmount: number, 
  paymentStatus: string,
  paymentId?: string
) => {
  const title = paymentStatus === 'completed' 
    ? 'Payment Received' 
    : 'Payment Status Update';
  
  const message = paymentStatus === 'completed'
    ? `Your payment of ${paymentAmount} has been successfully processed.`
    : `Your payment status has been updated to ${paymentStatus}.`;

  return createNotification({
    user_id: userId,
    title,
    message,
    type: 'payment',
    related_id: paymentId,
    related_type: 'payment'
  });
};

export const createLeaseNotification = async (
  userId: string,
  message: string,
  leaseId?: string
) => {
  return createNotification({
    user_id: userId,
    title: 'Lease Update',
    message,
    type: 'lease',
    related_id: leaseId,
    related_type: 'lease'
  });
};

export const createMaintenanceNotification = async (
  userId: string,
  requestTitle: string,
  status: string,
  requestId?: string
) => {
  const title = 'Maintenance Request Update';
  const message = `Your maintenance request "${requestTitle}" has been ${status}.`;

  return createNotification({
    user_id: userId,
    title,
    message,
    type: 'maintenance',
    related_id: requestId,
    related_type: 'maintenance_request'
  });
};

export const createSystemNotification = async (
  userId: string,
  title: string,
  message: string
) => {
  return createNotification({
    user_id: userId,
    title,
    message,
    type: 'system'
  });
};

export const createSupportNotification = async (
  userId: string,
  ticketTitle: string,
  status: string,
  ticketId?: string
) => {
  const title = 'Support Ticket Update';
  const message = `Your support ticket "${ticketTitle}" has been ${status}.`;

  return createNotification({
    user_id: userId,
    title,
    message,
    type: 'support',
    related_id: ticketId,
    related_type: 'support_ticket'
  });
};

// Bulk notification for multiple users
export const createBulkNotifications = async (
  userIds: string[],
  title: string,
  message: string,
  type: 'payment' | 'lease' | 'maintenance' | 'system' | 'support'
) => {
  try {
    const notifications = userIds.map(userId => ({
      user_id: userId,
      title,
      message,
      type
    }));

    const { data, error } = await supabase
      .from('notifications')
      .insert(notifications)
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating bulk notifications:', error);
    throw error;
  }
};