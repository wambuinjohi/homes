
-- 1) Lock down the invoice_overview view to authenticated users only
ALTER VIEW public.invoice_overview SET (security_invoker = true);

REVOKE ALL ON public.invoice_overview FROM PUBLIC;
REVOKE ALL ON public.invoice_overview FROM anon;
GRANT SELECT ON public.invoice_overview TO authenticated;

-- 2) Lock down the secure RPC so only authenticated can execute it
REVOKE ALL ON FUNCTION public.get_invoice_overview(integer, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_invoice_overview(integer, integer, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_invoice_overview(integer, integer, text, text) TO authenticated;

-- 3) Tighten payments SELECT policies to authenticated (remove 'public')

-- Owners (and managers, admins) via invoice->property mapping
DROP POLICY IF EXISTS "Owners can view payments via invoice mapping" ON public.payments;
CREATE POLICY "Owners can view payments via invoice mapping"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'Admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM (((invoices inv
        JOIN leases l ON inv.lease_id = l.id)
        JOIN units u ON u.id = l.unit_id)
        JOIN properties p ON p.id = u.property_id)
      WHERE inv.id = payments.invoice_id
        AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid())
    )
  );

-- Tenants can view payments via email match (JWT email)
DROP POLICY IF EXISTS "Tenants can view payments via email match" ON public.payments;
CREATE POLICY "Tenants can view payments via email match"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM tenants t
      WHERE t.id = payments.tenant_id
        AND lower(t.email) = lower(
          COALESCE(
            ((NULLIF(current_setting('request.jwt.claims', true), ''))::jsonb ->> 'email'),
            ''
          )
        )
    )
  );

-- Tenants can view their own payments (user_id relation)
DROP POLICY IF EXISTS "Tenants can view their own payments" ON public.payments;
CREATE POLICY "Tenants can view their own payments"
  ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM tenants t
      WHERE t.id = payments.tenant_id
        AND t.user_id = auth.uid()
    )
  );
