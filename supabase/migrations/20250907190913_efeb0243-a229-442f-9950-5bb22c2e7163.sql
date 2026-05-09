
-- 1) Payment allocations table
create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric not null check (amount > 0),
  created_at timestamptz not null default now()
);

-- Indexes for allocations
create index if not exists payment_allocations_invoice_id_idx on public.payment_allocations (invoice_id);
create index if not exists payment_allocations_payment_id_idx on public.payment_allocations (payment_id);
create unique index if not exists payment_allocations_unique_pair on public.payment_allocations (payment_id, invoice_id);

-- 2) Helpful indexes on invoices and payments
create index if not exists invoices_invoice_number_idx on public.invoices (invoice_number);
create index if not exists invoices_tenant_id_idx on public.invoices (tenant_id);
create index if not exists invoices_lease_id_idx on public.invoices (lease_id);
create index if not exists invoices_status_due_idx on public.invoices (status, due_date);

create index if not exists payments_invoice_id_idx on public.payments (invoice_id);
create index if not exists payments_tenant_date_idx on public.payments (tenant_id, payment_date);

-- 3) RLS on payment_allocations
alter table public.payment_allocations enable row level security;

-- Admins manage all
create policy if not exists "Admins can manage allocations"
on public.payment_allocations
for all
using (public.has_role(auth.uid(), 'Admin'))
with check (public.has_role(auth.uid(), 'Admin'));

-- Owners/managers manage allocations for their properties
create policy if not exists "Owners manage allocations for their properties"
on public.payment_allocations
for all
using (
  exists (
    select 1
    from public.invoices inv
    join public.leases l on inv.lease_id = l.id
    join public.units u on l.unit_id = u.id
    join public.properties p on u.property_id = p.id
    where inv.id = payment_allocations.invoice_id
      and (p.owner_id = auth.uid() or p.manager_id = auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.invoices inv
    join public.leases l on inv.lease_id = l.id
    join public.units u on l.unit_id = u.id
    join public.properties p on u.property_id = p.id
    where inv.id = payment_allocations.invoice_id
      and (p.owner_id = auth.uid() or p.manager_id = auth.uid())
  )
);

-- Tenants can view their allocations
create policy if not exists "Tenants can view allocations for their invoices"
on public.payment_allocations
for select
using (
  exists (
    select 1
    from public.invoices inv
    join public.tenants t on inv.tenant_id = t.id
    where inv.id = payment_allocations.invoice_id
      and t.user_id = auth.uid()
  )
);

-- System can insert allocations
create policy if not exists "System can insert allocations"
on public.payment_allocations
for insert
with check (true);

-- 4) View for balances and computed status
create or replace view public.invoice_balances as
with allocated as (
  select invoice_id, coalesce(sum(amount),0)::numeric as amount_paid_allocated
  from public.payment_allocations
  group by invoice_id
), direct as (
  select invoice_id, coalesce(sum(amount),0)::numeric as amount_paid_direct
  from public.payments
  where status in ('completed','paid','success') and invoice_id is not null
  group by invoice_id
), paid as (
  select i.id as invoice_id,
         coalesce(a.amount_paid_allocated, d.amount_paid_direct, 0)::numeric as amount_paid_total
  from public.invoices i
  left join allocated a on a.invoice_id = i.id
  left join direct d on d.invoice_id = i.id
)
select
  i.*,
  p.amount_paid_total,
  greatest((i.amount - p.amount_paid_total)::numeric, 0)::numeric as outstanding_amount,
  case
    when (i.amount - p.amount_paid_total) <= 0 then 'paid'
    when i.due_date < current_date then 'overdue'
    else i.status
  end as computed_status
from public.invoices i
left join paid p on p.invoice_id = i.id;

-- 5) Function to refresh a single invoice's stored status (convenience)
create or replace function public.refresh_invoice_status(_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric;
  v_paid numeric;
  v_due date;
  v_new_status text;
begin
  select amount, due_date into v_amount, v_due
  from public.invoices where id = _invoice_id;

  -- Calculate total paid (prefer allocations; fallback to direct)
  select coalesce(
    (select sum(amount) from public.payment_allocations where invoice_id = _invoice_id),
    (select sum(amount) from public.payments where invoice_id = _invoice_id and status in ('completed','paid','success')),
    0
  ) into v_paid;

  if coalesce(v_paid,0) >= coalesce(v_amount,0) then
    v_new_status := 'paid';
  elsif v_due is not null and v_due < current_date then
    v_new_status := 'overdue';
  else
    v_new_status := 'pending';
  end if;

  update public.invoices
    set status = v_new_status,
        updated_at = now()
  where id = _invoice_id;
end;
$$;

-- 6) Triggers to refresh statuses when allocations or direct payments change
create or replace function public.tg_refresh_invoice_status_from_alloc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    perform public.refresh_invoice_status(old.invoice_id);
  else
    perform public.refresh_invoice_status(new.invoice_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_refresh_invoice_status_on_alloc on public.payment_allocations;
create trigger trg_refresh_invoice_status_on_alloc
after insert or update or delete on public.payment_allocations
for each row execute function public.tg_refresh_invoice_status_from_alloc();

create or replace function public.tg_refresh_invoice_status_from_payments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only when invoice_id is present and payment is marked successful/completed
  if (new.invoice_id is not null) and (new.status in ('completed','paid','success')) then
    perform public.refresh_invoice_status(new.invoice_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_refresh_invoice_status_on_payments on public.payments;
create trigger trg_refresh_invoice_status_on_payments
after insert or update on public.payments
for each row execute function public.tg_refresh_invoice_status_from_payments();

-- 7) Reconciliation: allocate unallocated payments to invoices (FIFO)
create or replace function public.reconcile_unallocated_payments_for_tenant(p_tenant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment record;
  v_invoice record;
  v_remaining numeric;
  v_allocated_count int := 0;
  v_processed_payments int := 0;
begin
  for v_payment in
    select *
    from public.payments
    where tenant_id = p_tenant_id
      and status in ('completed','paid','success')
      and not exists (select 1 from public.payment_allocations pa where pa.payment_id = payments.id)
    order by payment_date asc
  loop
    v_processed_payments := v_processed_payments + 1;
    v_remaining := v_payment.amount;

    -- If payment has invoice_id, allocate to that invoice first
    if v_payment.invoice_id is not null then
      -- Determine outstanding for that invoice
      perform 1;
      for v_invoice in
        select i.id,
               i.amount - coalesce((
                 (select sum(amount) from public.payment_allocations where invoice_id = i.id)
                 +
                 (select coalesce(sum(amount),0) from public.payments where invoice_id = i.id and status in ('completed','paid','success'))
               ),0) as outstanding
        from public.invoices i
        where i.id = v_payment.invoice_id
      loop
        if v_invoice.outstanding > 0 and v_remaining > 0 then
          insert into public.payment_allocations(payment_id, invoice_id, amount)
          values (v_payment.id, v_invoice.id, least(v_remaining, v_invoice.outstanding));
          v_allocated_count := v_allocated_count + 1;
          v_remaining := v_remaining - least(v_remaining, v_invoice.outstanding);
        end if;
      end loop;
    end if;

    -- If still remaining, allocate FIFO to tenant's outstanding invoices
    if v_remaining > 0 then
      for v_invoice in
        select i.id,
               i.due_date,
               i.amount - coalesce((
                 (select sum(amount) from public.payment_allocations where invoice_id = i.id)
                 +
                 (select coalesce(sum(amount),0) from public.payments where invoice_id = i.id and status in ('completed','paid','success'))
               ),0) as outstanding
        from public.invoices i
        where i.tenant_id = p_tenant_id
          and (i.amount - coalesce((
                 (select sum(amount) from public.payment_allocations where invoice_id = i.id)
                 +
                 (select coalesce(sum(amount),0) from public.payments where invoice_id = i.id and status in ('completed','paid','success'))
               ),0)) > 0
        order by i.due_date asc, i.invoice_date asc, i.created_at asc
      loop
        exit when v_remaining <= 0;
        if v_invoice.outstanding > 0 then
          insert into public.payment_allocations(payment_id, invoice_id, amount)
          values (v_payment.id, v_invoice.id, least(v_remaining, v_invoice.outstanding));
          v_allocated_count := v_allocated_count + 1;
          v_remaining := v_remaining - least(v_remaining, v_invoice.outstanding);
        end if;
      end loop;
    end if;

    -- If any remainder still exists, it stays unallocated (intentional)
  end loop;

  return jsonb_build_object(
    'processed_payments', v_processed_payments,
    'allocations_created', v_allocated_count
  );
end;
$$;
