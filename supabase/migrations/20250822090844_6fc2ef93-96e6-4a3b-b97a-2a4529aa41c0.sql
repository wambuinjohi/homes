
-- Allow tenants to view invoices via the lease->tenant relationship
-- This fixes cases where invoices.tenant_id doesn't match the current tenant record,
-- but the invoice lease still belongs to the same user.
create policy "Tenants can view invoices via lease mapping"
on public.invoices
for select
using (
  exists (
    select 1
    from public.leases l
    join public.tenants t on t.id = l.tenant_id
    where l.id = invoices.lease_id
      and t.user_id = auth.uid()
  )
);
