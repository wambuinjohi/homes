-- Fix permission mapping for invoicing and communication features
CREATE OR REPLACE FUNCTION public.map_feature_to_permission(_feature text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select case
    -- Reports
    when _feature in ('reports.advanced', 'reports.financial', 'reports.basic') then 'view_reports'
    
    -- Properties & Units
    when _feature in ('properties.max', 'units.max') then 'manage_properties'
    
    -- Tenants
    when _feature in ('tenants.max') then 'manage_tenants'
    
    -- Invoicing (FIX: map to manage_payments, not manage_invoices)
    when _feature in ('invoicing.basic', 'invoicing.advanced') then 'manage_payments'
    
    -- Payments
    when _feature in ('payments.management') then 'manage_payments'
    
    -- Expenses
    when _feature in ('expenses.tracking') then 'manage_expenses'
    
    -- Maintenance
    when _feature in ('maintenance.tracking') then 'manage_maintenance'
    
    -- Communications (FIX: map to send_messages, not send_communications)
    when _feature in ('sms.quota', 'notifications.sms', 'notifications.email') then 'send_messages'
    when _feature in ('communication.email_templates', 'communication.sms_templates') then 'send_messages'
    
    -- Bulk operations require multiple permissions
    when _feature = 'operations.bulk' then 'manage_properties' -- needs at least one management permission
    
    -- Landlord-only features (no sub-user access even with permissions)
    when _feature in (
      'team.sub_users',           -- Sub-users cannot manage other sub-users
      'billing.automated',         -- Only landlord can manage billing
      'branding.white_label',      -- Only landlord can manage branding
      'branding.custom',
      'support.dedicated',         -- Landlord-level support
      'support.priority'
    ) then null  -- null means landlord-only
    
    else null  -- Unknown features default to landlord-only
  end;
$function$;