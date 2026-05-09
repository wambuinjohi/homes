-- Phase 1: Add SELECT policy for properties to fix visibility
create policy "Properties - select access"
on public.properties
for select
using (
  has_role(auth.uid(), 'Admin'::app_role)
  OR owner_id = auth.uid()
  OR manager_id = auth.uid()
  OR (
    (owner_id = get_sub_user_landlord(auth.uid()) OR manager_id = get_sub_user_landlord(auth.uid()))
    AND get_sub_user_permissions(auth.uid(), 'manage_properties')
  )
);

-- Phase 5: Add validation trigger to prevent non-landlord ownership
create or replace function public.validate_property_owner()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_owner_role app_role;
begin
  -- Allow admins to assign properties to anyone
  if has_role(auth.uid(), 'Admin'::app_role) then
    return new;
  end if;

  -- Check if owner_id has Landlord role
  select role into v_owner_role
  from user_roles
  where user_id = new.owner_id
  limit 1;

  if v_owner_role is null or v_owner_role not in ('Landlord', 'Admin') then
    raise exception 'Property owner must have Landlord or Admin role. User % has role %', new.owner_id, coalesce(v_owner_role::text, 'none');
  end if;

  return new;
end;
$$;

create trigger validate_property_owner_trigger
  before insert or update of owner_id on public.properties
  for each row
  execute function public.validate_property_owner();