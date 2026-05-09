import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseRealtimeOptions {
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  onUpdate?: () => void;
}

export function useRealtime({ table, event = '*', onUpdate }: UseRealtimeOptions) {
  const handleRealtimeUpdate = useCallback(() => {
    if (onUpdate) {
      onUpdate();
    }
  }, [onUpdate]);

  useEffect(() => {
    // Create a unique channel name
    const channelName = `realtime-${table}-${Date.now()}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as any,
        {
          event,
          schema: 'public',
          table
        } as any,
        handleRealtimeUpdate
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, event, handleRealtimeUpdate]);
}