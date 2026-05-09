import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

export async function checkBackendReady(signal?: AbortSignal): Promise<{ ok: boolean; reason?: string }> {
  try {
    // Try a lightweight edge function if available; fall back to root fetch
    const fnUrl = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/pdf-health`;
    const res = await fetch(fnUrl, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, reason: `Edge function check failed: ${res.status} ${res.statusText} ${text || ''}`.trim() };
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || String(e) };
  }
}
