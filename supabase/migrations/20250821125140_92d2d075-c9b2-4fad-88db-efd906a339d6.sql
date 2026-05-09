-- Step 4: Backfill existing data - link payments to invoices
UPDATE public.payments 
SET invoice_id = (
  SELECT inv.id 
  FROM public.invoices inv 
  WHERE inv.invoice_number = payments.invoice_number 
    AND inv.tenant_id = payments.tenant_id
  LIMIT 1
)
WHERE invoice_id IS NULL 
  AND invoice_number IS NOT NULL;

-- Step 5: Sync all invoice statuses based on current payments
UPDATE public.invoices
SET status = (
  CASE 
    WHEN COALESCE((
      SELECT SUM(amount) 
      FROM public.payments 
      WHERE invoice_id = invoices.id AND status = 'completed'
    ), 0) >= invoices.amount THEN 'paid'
    WHEN COALESCE((
      SELECT SUM(amount) 
      FROM public.payments 
      WHERE invoice_id = invoices.id AND status = 'completed'
    ), 0) > 0 THEN 'partial'
    WHEN invoices.due_date < CURRENT_DATE THEN 'overdue'
    ELSE 'pending'
  END
),
updated_at = now();

-- Step 6: Create data integrity report function
CREATE OR REPLACE FUNCTION public.get_data_integrity_report()
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  WITH 
  -- Find duplicate emails in profiles
  duplicate_emails AS (
    SELECT 
      p.email,
      COUNT(*) as user_count,
      array_agg(jsonb_build_object('id', p.id::text, 'name', COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, ''))) as users
    FROM public.profiles p
    GROUP BY p.email
    HAVING COUNT(*) > 1
  ),
  
  -- Find users with multiple roles
  multiple_roles AS (
    SELECT 
      ur.user_id,
      p.email as user_email,
      COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '') as user_name,
      array_agg(ur.role::text) as roles,
      COUNT(ur.role) as role_count
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    GROUP BY ur.user_id, p.email, p.first_name, p.last_name
    HAVING COUNT(ur.role) > 1
  ),
  
  -- Find orphaned role assignments (roles without valid users)
  orphaned_roles AS (
    SELECT 
      ur.user_id,
      ur.role::text as role
    FROM public.user_roles ur
    LEFT JOIN public.profiles p ON p.id = ur.user_id
    WHERE p.id IS NULL
  ),
  
  -- Recent role changes (last 30 days)
  recent_role_changes AS (
    SELECT 
      rcl.user_id,
      p.email as user_email,
      COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '') as user_name,
      rcl.old_role::text,
      rcl.new_role::text,
      changer.email as changed_by,
      COALESCE(rcl.reason, '') as reason,
      rcl.created_at
    FROM public.role_change_logs rcl
    JOIN public.profiles p ON p.id = rcl.user_id
    LEFT JOIN public.profiles changer ON changer.id = rcl.changed_by
    WHERE rcl.created_at >= (now() - interval '30 days')
    ORDER BY rcl.created_at DESC
    LIMIT 20
  )
  
  SELECT jsonb_build_object(
    'duplicate_emails', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'email', email,
        'user_count', user_count,
        'users', users
      ))
      FROM duplicate_emails
    ), '[]'::jsonb),
    
    'multiple_roles', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', user_id::text,
        'email', user_email,
        'name', user_name,
        'roles', roles,
        'role_count', role_count
      ))
      FROM multiple_roles
    ), '[]'::jsonb),
    
    'orphaned_roles', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', user_id::text,
        'role', role
      ))
      FROM orphaned_roles
    ), '[]'::jsonb),
    
    'recent_role_changes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', user_id::text,
        'user_email', user_email,
        'user_name', user_name,
        'old_role', old_role,
        'new_role', new_role,
        'changed_by', changed_by,
        'reason', reason,
        'created_at', created_at
      ))
      FROM recent_role_changes
    ), '[]'::jsonb),
    
    'generated_at', now()::text
  ) INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';