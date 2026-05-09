-- Create an admin-only RPC to list profiles with roles without touching tenants
-- This avoids RLS recursion paths and consolidates data for the UI

create or replace function public.admin_list_profiles_with_roles(
  p_limit integer default 10,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_total integer;
  v_users jsonb;
begin
  -- Enforce admin access using server-side role check
  if not public.has_role_safe(auth.uid(), 'Admin'::public.app_role) then
    return jsonb_build_object('success', false, 'error', 'forbidden');
  end if;

  select count(*) into v_total from public.profiles;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'first_name', p.first_name,
      'last_name', p.last_name,
      'email', p.email,
      'phone', p.phone,
      'created_at', p.created_at,
      'user_roles', coalesce((
        select jsonb_agg(jsonb_build_object('role', ur.role::text))
        from public.user_roles ur
        where ur.user_id = p.id
      ), '[]'::jsonb)
    )
  ), '[]'::jsonb)
  into v_users
  from (
    select *
    from public.profiles
    order by created_at desc
    limit p_limit offset p_offset
  ) p;

  return jsonb_build_object(
    'success', true,
    'users', v_users,
    'total_count', v_total
  );
end;
$$;

-- Ensure authenticated users can call the function (logic inside enforces Admin)
grant execute on function public.admin_list_profiles_with_roles(integer, integer) to authenticated;