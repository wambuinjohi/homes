import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RealtimeChannel } from "@supabase/supabase-js";

interface UseRealtimeDashboardProps {
  onPaymentUpdate?: () => void;
  onMaintenanceUpdate?: () => void;
  onTenantUpdate?: () => void;
  onPropertyUpdate?: () => void;
  onInvoiceUpdate?: () => void;
}

export function useRealtimeDashboard({
  onPaymentUpdate,
  onMaintenanceUpdate,
  onTenantUpdate,
  onPropertyUpdate,
  onInvoiceUpdate,
}: UseRealtimeDashboardProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    // Create a single channel for all realtime updates
    channelRef.current = supabase
      .channel('dashboard-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments'
        },
        (payload) => {
          console.log('Payment change detected:', payload);
          onPaymentUpdate?.();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'maintenance_requests'
        },
        (payload) => {
          console.log('Maintenance change detected:', payload);
          onMaintenanceUpdate?.();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenants'
        },
        (payload) => {
          console.log('Tenant change detected:', payload);
          onTenantUpdate?.();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'properties'
        },
        (payload) => {
          console.log('Property change detected:', payload);
          onPropertyUpdate?.();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices'
        },
        (payload) => {
          console.log('Invoice change detected:', payload);
          onInvoiceUpdate?.();
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [onPaymentUpdate, onMaintenanceUpdate, onTenantUpdate, onPropertyUpdate, onInvoiceUpdate]);

  return {
    isConnected: channelRef.current?.state === 'joined'
  };
}