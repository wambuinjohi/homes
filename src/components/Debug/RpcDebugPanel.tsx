import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const RPCS = [
  { key: 'get_landlord_dashboard_data', label: 'Dashboard' },
  { key: 'get_landlord_tenants_summary', label: 'Tenants', params: { p_limit: 50, p_offset: 0 } },
  { key: 'get_lease_expiry_report', label: 'Lease Expiry', params: { p_start_date: null, p_end_date: null } },
  { key: 'get_expense_summary_report', label: 'Expense Summary', params: { p_start_date: null, p_end_date: null } },
];

export const RpcDebugPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [lastError, setLastError] = useState<string | null>(null);
  const [sessionInfo, setSessionInfo] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!mounted) return;
        setSessionInfo(sessionData ?? null);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  const formatError = (e: any) => {
    try {
      if (!e) return 'Unknown error';
      if (typeof e === 'string') return e;
      const parts: string[] = [];
      if (e.message) parts.push(e.message);
      if (e.details) parts.push(e.details);
      if (e.hint) parts.push(`hint: ${e.hint}`);
      if (parts.length === 0) return JSON.stringify(e);
      return parts.join(' | ');
    } catch (err) {
      return String(e);
    }
  };

  const copyToClipboard = (text: string) => {
    try { navigator.clipboard.writeText(text); } catch (e) { /* ignore */ }
  };

  const fetchAll = async () => {
    setLoading(true);
    setLastError(null);

    try {
      const promises = RPCS.map(rpc => {
        const params = (rpc as any).params ?? undefined;
        return (supabase as any).rpc(rpc.key, params).then((res: any) => ({ key: rpc.key, res })).catch((err: any) => ({ key: rpc.key, res: { error: err } }));
      });

      const results = await Promise.all(promises);
      const next: Record<string, any> = {};

      for (const r of results) {
        const raw = r.res;
        if (!raw) {
          next[r.key] = { error: 'No response' };
          continue;
        }

        // preserve full raw response including status/error/data
        if ((raw as any).error) {
          next[r.key] = { raw, error: formatError((raw as any).error) };
        } else {
          next[r.key] = { raw, data: (raw as any).data ?? (raw as any) };
        }
      }

      setResponses(next);
    } catch (err) {
      setLastError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 9999 }}>
        <button
          onClick={() => {
            const next = !open;
            setOpen(next);
            if (next && Object.keys(responses).length === 0) fetchAll();
          }}
          title="Toggle RPC Debug Panel"
          className="bg-white/10 hover:bg-white/20 text-white rounded-full px-3 py-2 shadow-md border border-white/10"
        >
          RPC
        </button>
      </div>

      {open && (
        <div style={{ position: 'fixed', right: 16, bottom: 64, zIndex: 9999, width: 'min(1100px, 95vw)', maxHeight: '70vh', overflow: 'auto' }}>
          <div className="bg-card border border-border rounded-lg p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">RPC Debug Panel</h3>
              <div className="flex gap-2">
                <Button onClick={fetchAll} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</Button>
                <Button onClick={() => { setResponses({}); setLastError(null); }}>Clear</Button>
                <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
              </div>
            </div>

            {sessionInfo && (
              <div className="mb-3 text-sm">
                <strong>Auth session:</strong>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }} className="text-xs bg-muted/10 p-2 rounded">{JSON.stringify(sessionInfo, null, 2)}</pre>
              </div>
            )}

            {lastError && (
              <div className="mb-3 text-sm text-destructive">Last error: {lastError}</div>
            )}

            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {RPCS.map(rpc => (
                <div key={rpc.key}>
                  <div className="flex items-center justify-between mb-2">
                    <strong>{rpc.label} RPC ({rpc.key})</strong>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => copyToClipboard(JSON.stringify(responses[rpc.key] ?? {}, null, 2))}>Copy</Button>
                    </div>
                  </div>

                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '50vh', overflow: 'auto' }} className="text-sm bg-muted/10 p-2 rounded">
                    {responses[rpc.key] ? JSON.stringify(responses[rpc.key], null, 2) : 'No data fetched yet'}
                  </pre>
                </div>
              ))}
            </div>

            <div className="mt-3 text-xs text-muted-foreground">
              Note: This panel performs RPC calls using the browser session and therefore data returned respects RLS and the current auth.
              To run RPCs with elevated privileges or to inspect policies directly you must run checks from a trusted backend using the Supabase service_role key or connect the Supabase MCP. Do not expose service_role keys in the browser.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RpcDebugPanel;
