
-- Use JWT email instead of public.profiles for tenant visibility
-- This avoids missing-profile issues and still respects RLS security.

-- 1) Invoices: Replace email-match policy
DROP POLICY IF EXISTS "Tenants can view invoices via email match" ON public.invoices;

CREATE POLICY "Tenants can view invoices via email match"
ON public.invoices
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = invoices.tenant_id
      AND lower(t.email) = lower(
        COALESCE(
          NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'email',
          ''
        )
      )
  )
);

-- 2) Payments: Replace email-match policy
DROP POLICY IF EXISTS "Tenants can view payments via email match" ON public.payments;

CREATE POLICY "Tenants can view payments via email match"
ON public.payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = payments.tenant_id
      AND lower(t.email) = lower(
        COALESCE(
          NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'email',
          ''
        )
      )
  )
);
