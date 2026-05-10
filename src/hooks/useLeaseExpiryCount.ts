import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function useLeaseExpiryCount() {
  const [expiringCount, setExpiringCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchExpiringLeases = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        // Try the Supabase RPC first (client-side). If it fails due to RLS or type errors, fallback to server endpoint.
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_lease_expiry_report', { p_start_date: null, p_end_date: null })
          .maybeSingle();

        if (rpcError) {
          // Log RPC error and attempt client-side fallback
          const formatted = (() => {
            try {
              if (!rpcError) return 'Unknown RPC error';
              if (typeof rpcError === 'string') return rpcError;
              const parts: string[] = [];
              if ((rpcError as any).message) parts.push((rpcError as any).message);
              if ((rpcError as any).details) parts.push((rpcError as any).details);
              if ((rpcError as any).hint) parts.push(`hint: ${(rpcError as any).hint}`);
              if (parts.length === 0) return JSON.stringify(rpcError);
              return parts.join(' | ');
            } catch (e) {
              return String(rpcError);
            }
          })();

          console.warn('RPC failed, attempting client-side fallback:', formatted);
          console.debug('Full RPC error object:', rpcError);

          try {
            const startDate = new Date().toISOString().slice(0, 10);
            const endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            const { data, error } = await (supabase as any)
              .from('leases')
              .select('lease_end_date')
              .gte('lease_end_date', startDate)
              .lte('lease_end_date', endDate);
            if (error) throw error;
            const today = new Date();
            const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const count = (data || []).filter((l: any) => {
              const end = l?.lease_end_date ? new Date(l.lease_end_date) : null;
              if (!end) return false;
              const days = Math.max(0, Math.ceil((end.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24)));
              return days >= 0 && days <= 90;
            }).length;
            setExpiringCount(count);
          } catch (fallbackErr) {
            console.error('Client-side fallback failed:', fallbackErr);
            setExpiringCount(0);
          }
        } else {
          const kpis = (rpcData as any)?.kpis || null;
          const count = kpis?.expiring_leases ?? 0;
          setExpiringCount(Number(count) || 0);
        }
      } catch (err) {
        console.error('Error fetching lease expiry count (unexpected):', err && ((err as any).message || JSON.stringify(err)));
        console.debug('Full unexpected error object:', err);
        // Final fallback: try server endpoint
        try {
          const res = await fetch('/api/leases/expiring');
          const payload = await res.json();
          let count = 0;
          if (Array.isArray(payload) && payload.length > 0 && payload[0].expiring_leases != null) count = Number(payload[0].expiring_leases) || 0;
          else if (payload.kpis && payload.kpis.expiring_leases != null) count = Number(payload.kpis.expiring_leases) || 0;
          setExpiringCount(count);
        } catch (e) {
          setExpiringCount(0);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchExpiringLeases();
  }, [user?.id]);

  return { expiringCount, loading };
}
