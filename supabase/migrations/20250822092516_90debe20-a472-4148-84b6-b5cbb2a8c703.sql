
-- 1) Backfill tenants.user_id for existing tenants by matching email to profiles.email
UPDATE public.tenants t
SET user_id = p.id
FROM public.profiles p
WHERE t.user_id IS NULL
  AND lower(t.email) = lower(p.email);

-- 2) Safety RLS policies to avoid “invisible data” for tenants whose user_id is not set (email-linked view)
-- Note: This complements existing tenant policies and is safe because profile emails are unique.

-- Invoices: allow tenant to view when their profile email matches tenant email
CREATE POLICY "Tenants can view invoices via email match"
  ON public.invoices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.tenants t
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE t.id = invoices.tenant_id
        AND lower(t.email) = lower(p.email)
    )
  );

-- Payments: allow tenant to view when their profile email matches tenant email
CREATE POLICY "Tenants can view payments via email match"
  ON public.payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.tenants t
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE t.id = payments.tenant_id
        AND lower(t.email) = lower(p.email)
    )
  );
