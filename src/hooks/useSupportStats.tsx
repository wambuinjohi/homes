import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SupportStats {
  openTickets: number;
  inProgressTickets: number;
  resolvedToday: number;
  avgResponseTime: string;
  tickets: any[];
  systemLogs: any[];
}

export function useSupportStats() {
  const [stats, setStats] = useState<SupportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Mock data for support tickets until types are regenerated
      const mockTickets = [
        {
          id: 1,
          title: "Cannot upload property images",
          user: "John Smith",
          email: "john@example.com",
          priority: "high",
          status: "open",
          category: "Technical",
          created: "2024-01-15",
          lastUpdate: "2024-01-16",
          description: "I'm unable to upload images for my property listing. The upload button doesn't respond.",
          messages: [
            { sender: "John Smith", message: "I'm having trouble uploading images", time: "10:30 AM" },
            { sender: "Support", message: "Let me help you with that. Can you try clearing your browser cache?", time: "10:45 AM" }
          ]
        },
        {
          id: 2,
          title: "Payment not reflecting in account",
          user: "Jane Doe", 
          email: "jane@example.com",
          priority: "urgent",
          status: "in_progress",
          category: "Billing",
          created: "2024-01-14",
          lastUpdate: "2024-01-16",
          description: "Made a payment 3 days ago but it's not showing in my account balance.",
          messages: [
            { sender: "Jane Doe", message: "My payment is not showing up", time: "9:15 AM" },
            { sender: "Support", message: "Checking with our billing team", time: "9:30 AM" }
          ]
        }
      ];

      const openTickets = mockTickets.filter(t => t.status === 'open').length;
      const inProgressTickets = mockTickets.filter(t => t.status === 'in_progress').length;
      const resolvedToday = 42; // Mock resolved count

      // Mock system logs (would come from logging service)
      const systemLogs = [
        { id: 1, type: "error", message: "Database connection timeout", timestamp: "2024-01-16 10:45:23", service: "API" },
        { id: 2, type: "warning", message: "High memory usage detected", timestamp: "2024-01-16 10:30:15", service: "Server" },
        { id: 3, type: "info", message: "Backup completed successfully", timestamp: "2024-01-16 09:00:00", service: "Backup" },
        { id: 4, type: "error", message: "Failed to send email notification", timestamp: "2024-01-16 08:15:42", service: "Email" },
      ];

      setStats({
        openTickets,
        inProgressTickets,
        resolvedToday,
        avgResponseTime: "2.3h",
        tickets: mockTickets,
        systemLogs
      });
    } catch (err) {
      console.error('Error fetching support stats:', err);
      setError('Failed to fetch support statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats
  };
}