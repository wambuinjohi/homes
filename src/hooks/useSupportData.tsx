import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SupportTicket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  assigned_to?: string;
  resolution_notes?: string;
  // Joined data
  user?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  assigned_user?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  messages?: SupportMessage[];
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_staff_reply: boolean;
  created_at: string;
  // Joined data
  user?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface SystemLog {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  service: string;
  details?: any;
  user_id?: string;
  created_at: string;
}

export interface SupportStats {
  openTickets: number;
  inProgressTickets: number;
  resolvedToday: number;
  avgResponseTime: string;
  totalTickets: number;
  tickets: SupportTicket[];
  systemLogs: SystemLog[];
}

export function useSupportData() {
  const [data, setData] = useState<SupportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSupportData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch support tickets with user details
      const { data: tickets, error: ticketsError } = await supabase
        .from('support_tickets')
        .select(`
          *,
          user:profiles!support_tickets_user_id_fkey(first_name, last_name, email),
          assigned_user:profiles!support_tickets_assigned_to_fkey(first_name, last_name, email),
          messages:support_messages(
            *,
            user:profiles!support_messages_user_id_fkey(first_name, last_name, email)
          )
        `)
        .order('created_at', { ascending: false });

      if (ticketsError) {
        console.error('Error fetching tickets:', ticketsError);
        // If foreign key query fails, try simple query
        const { data: simpleTickets, error: simpleError } = await supabase
          .from('support_tickets')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (simpleError) throw simpleError;
        setData({
          openTickets: 0,
          inProgressTickets: 0,
          resolvedToday: 0,
          avgResponseTime: "0h",
          totalTickets: 0,
          tickets: simpleTickets as SupportTicket[],
          systemLogs: []
        });
        return;
      }

      // Fetch system logs (admin only)
      const { data: logs, error: logsError } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (logsError) throw logsError;

      // Calculate stats
      const ticketData = tickets || [];
      const openCount = ticketData.filter(t => t.status === 'open').length;
      const inProgressCount = ticketData.filter(t => t.status === 'in_progress').length;
      
      // Count resolved tickets from today
      const today = new Date().toISOString().split('T')[0];
      const resolvedTodayCount = ticketData.filter(
        t => t.status === 'resolved' && t.updated_at.startsWith(today)
      ).length;

      // Calculate average response time (simplified)
      const avgResponseTime = "2.5h"; // TODO: Calculate based on actual message response times

      const supportStats: SupportStats = {
        openTickets: openCount,
        inProgressTickets: inProgressCount,
        resolvedToday: resolvedTodayCount,
        avgResponseTime,
        totalTickets: ticketData.length,
        tickets: ticketData as any[],
        systemLogs: (logs || []) as any[]
      };

      setData(supportStats);
    } catch (err) {
      console.error('Error fetching support data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch support data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupportData();
  }, []);

  const updateTicketStatus = async (ticketId: string, status: SupportTicket['status'], resolutionNotes?: string) => {
    try {
      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (resolutionNotes) {
        updateData.resolution_notes = resolutionNotes;
      }

      const { error } = await supabase
        .from('support_tickets')
        .update(updateData)
        .eq('id', ticketId);

      if (error) throw error;
      
      // Log the status change
      await supabase.rpc('log_system_event', {
        _type: 'info',
        _message: `Support ticket ${ticketId} status changed to ${status}`,
        _service: 'Support System'
      });

      // Refresh data
      await fetchSupportData();
      return { success: true };
    } catch (err) {
      console.error('Error updating ticket status:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update ticket' };
    }
  };

  const addMessage = async (ticketId: string, message: string, isStaffReply: boolean = true) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: ticketId,
          user_id: user.id,
          message,
          is_staff_reply: isStaffReply
        });

      if (error) throw error;

      // Create notification for the user if it's a staff reply
      if (isStaffReply) {
        const { data: ticket } = await supabase
          .from('support_tickets')
          .select('user_id, title')
          .eq('id', ticketId)
          .single();

        if (ticket) {
          await supabase
            .from('notifications')
            .insert({
              user_id: ticket.user_id,
              title: 'Support Ticket Reply',
              message: `You have a new reply on your ticket: ${ticket.title}`,
              type: 'support',
              related_id: ticketId,
              related_type: 'support_ticket'
            });
        }
      }
      
      // Refresh data
      await fetchSupportData();
      return { success: true };
    } catch (err) {
      console.error('Error adding message:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to add message' };
    }
  };

  const assignTicket = async (ticketId: string, assignedTo: string | null) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ 
          assigned_to: assignedTo,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) throw error;

      // Log the assignment
      await supabase.rpc('log_system_event', {
        _type: 'info',
        _message: `Support ticket ${ticketId} assigned to ${assignedTo || 'unassigned'}`,
        _service: 'Support System'
      });

      await fetchSupportData();
      return { success: true };
    } catch (err) {
      console.error('Error assigning ticket:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to assign ticket' };
    }
  };

  return {
    data,
    loading,
    error,
    refetch: fetchSupportData,
    updateTicketStatus,
    addMessage,
    assignTicket
  };
}