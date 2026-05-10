import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getGlobalCurrencySync } from "@/utils/currency";
import { Loader2, TestTube2 } from "lucide-react";

interface Props {
  tenantNameQuery?: string; // e.g., "David" or "David Mwangi"
  onPaymentRecorded?: () => void;
}

export const TestPaymentButton: React.FC<Props> = ({ tenantNameQuery = "David", onPaymentRecorded }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const getErr = (e: any) => {
    try {
      if (!e) return "Unknown error";
      if (typeof e === "string") return e;
      const parts: string[] = [];
      if (e.message) parts.push(e.message);
      if (e.details) parts.push(e.details);
      if (e.hint) parts.push(`hint: ${e.hint}`);
      if (parts.length === 0) return JSON.stringify(e);
      return parts.join(" | ");
    } catch {
      return String(e);
    }
  };

  const handleTestPayment = async () => {
    setLoading(true);
    try {
      // 0) Ensure user is authenticated (RLS usually blocks anonymous inserts)
      const { data: session } = await supabase.auth.getSession();
      const authed = Boolean(session?.session?.user?.id);
      if (!authed) {
        throw new Error("You must be signed in to record payments (RLS)");
      }

      // 1) Find tenant by name (first or last name or full name match)
      const { data: t1, error: e1 } = await supabase
        .from("tenants")
        .select("id, first_name, last_name")
        .ilike("first_name", `%${tenantNameQuery}%`);
      if (e1) throw e1;

      let tenant = t1?.[0];
      if (!tenant) {
        const { data: t2, error: e2 } = await supabase
          .from("tenants")
          .select("id, first_name, last_name");
        if (e2) throw e2;
        tenant = (t2 || []).find(
          (x) => `${x.first_name} ${x.last_name}`.toLowerCase().includes(String(tenantNameQuery).toLowerCase())
        );
      }

      if (!tenant) {
        throw new Error(`No tenant found matching \"${tenantNameQuery}\"`);
      }

      // 2) Get a lease for tenant and infer rent amount (avoid relying on non-existent columns)
      const { data: leases, error: leasesError } = await supabase
        .from("leases")
        .select("id, monthly_rent")
        .eq("tenant_id", tenant.id)
        .limit(1);

      if (leasesError) throw leasesError;
      const lease = leases?.[0];
      if (!lease) throw new Error("Tenant has no lease");

      const amount = Math.max(1, Number(lease.monthly_rent || 0));

      // 3) Insert payment
      const now = new Date();
      const paymentPayload = {
        tenant_id: tenant.id,
        lease_id: lease.id,
        amount,
        payment_date: now.toISOString().split("T")[0],
        payment_method: "Cash",
        payment_type: "Rent",
        payment_reference: `TEST-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${now.getTime()}`,
        status: "completed"
      } as const;

      // Some RLS setups prevent returning rows on insert. First try a plain insert, then fall back to select.
      const { error: insertError } = await supabase
        .from("payments")
        .insert([paymentPayload]);
      if (insertError) {
        // If the only problem is lack of returning privileges, treat as success
        const msg = getErr(insertError);
        const isNoReturn = msg.includes("Results contain 0") || msg.includes("PGRST116");
        if (!isNoReturn) throw insertError;
      }

      // Best-effort fetch of the created payment (non-fatal if blocked)
      try {
        await supabase
          .from("payments")
          .select("id")
          .order("created_at", { ascending: false })
          .limit(1);
      } catch (_) { /* ignore */ }

      // 4) Auto-reconcile unallocated payments for the tenant (if function exists)
      try {
        await supabase.rpc("reconcile_unallocated_payments_for_tenant" as any, { p_tenant_id: tenant.id });
      } catch (e) {
        console.warn("Reconciliation skipped:", e);
      }

      toast({
        title: "Test payment recorded",
        description: `${getGlobalCurrencySync()} ${amount.toLocaleString()} for ${tenant.first_name} ${tenant.last_name}`,
      });

      onPaymentRecorded?.();
    } catch (e: any) {
      const msg = getErr(e);
      toast({ title: "Payment failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleTestPayment} disabled={loading} className="gap-2">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}
      Test Payment
    </Button>
  );
};

export default TestPaymentButton;
