
-- 1) Create unit_types table
create table if not exists public.unit_types (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid null,
  name text not null,
  category text not null default 'Residential', -- Residential | Commercial | Mixed (validated in app)
  features text[] null default '{}',
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Update updated_at on change, reuse existing helper
create trigger trg_unit_types_updated_at
before update on public.unit_types
for each row execute function public.update_updated_at_column();

-- Helpful uniqueness: prevent duplicate names per landlord (case-insensitive)
-- Note: NULL landlord_id allows multiple system rows only if intentionally inserted multiple times.
-- We seed once, so this is fine and prevents duplicates for landlord-owned rows.
create unique index if not exists unit_types_unique_per_owner_name
on public.unit_types (landlord_id, lower(name));

-- 2) Enable RLS
alter table public.unit_types enable row level security;

-- 3) RLS policies
-- Admins manage all
create policy "Admins can manage all unit types"
  on public.unit_types
  for all
  using (public.has_role(auth.uid(), 'Admin'))
  with check (public.has_role(auth.uid(), 'Admin'));

-- View: stakeholders can see active system types and their own custom types
create policy "Stakeholders can view unit types"
  on public.unit_types
  for select
  using (
    is_active = true
    and (
      is_system = true
      or landlord_id = auth.uid()
      or public.has_role(auth.uid(), 'Admin')
    )
  );

-- Landlords manage their own custom unit types
create policy "Landlords manage their own unit types - insert"
  on public.unit_types
  for insert
  with check (
    public.has_role(auth.uid(), 'Landlord')
    and landlord_id = auth.uid()
    and is_system = false
  );

create policy "Landlords manage their own unit types - update"
  on public.unit_types
  for update
  using (
    public.has_role(auth.uid(), 'Landlord')
    and landlord_id = auth.uid()
    and is_system = false
  )
  with check (
    public.has_role(auth.uid(), 'Landlord')
    and landlord_id = auth.uid()
    and is_system = false
  );

create policy "Landlords manage their own unit types - delete"
  on public.unit_types
  for delete
  using (
    public.has_role(auth.uid(), 'Landlord')
    and landlord_id = auth.uid()
    and is_system = false
  );

-- 4) Seed default system types (id auto, landlord_id = NULL, is_system = true)
insert into public.unit_types (name, category, features, is_system, is_active)
values
  -- Residential
  ('Apartment', 'Residential', '{}', true, true),
  ('Studio', 'Residential', '{}', true, true),
  ('Bedsitter', 'Residential', '{}', true, true),
  ('Maisonette', 'Residential', '{}', true, true),
  ('Townhouse', 'Residential', '{}', true, true),
  ('Bungalow', 'Residential', '{}', true, true),
  ('Penthouse', 'Residential', '{}', true, true),
  ('Servant Quarter', 'Residential', '{}', true, true),
  ('Gated Community Villa', 'Residential', '{}', true, true),
  -- Commercial
  ('Commercial Unit', 'Commercial', '{}', true, true),
  ('Office', 'Commercial', '{}', true, true),
  ('Shop', 'Commercial', '{}', true, true)
on conflict do nothing;
