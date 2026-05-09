
-- Allow property owners/managers to SELECT payments that are linked via invoice_id
-- (so rows without lease_id but with invoice_id are still visible)
create policy "Owners can view payments via invoice mapping"
on public.payments
for select
using (
  has_role(auth.uid(), 'Admin'::public.app_role)
  or exists (
    select 1
    from public.invoices inv
    join public.leases l on inv.lease_id = l.id
    join public.units u on u.id = l.unit_id
    join public.properties p on p.id = u.property_id
    where inv.id = payments.invoice_id
      and (p.owner_id = auth.uid() or p.manager_id = auth.uid())
  )
);
