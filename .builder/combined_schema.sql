-- ========== COMBINED SUPABASE SCHEMA ==========
-- This file contains the complete schema definitions from all migrations
-- organized in proper dependency order for clean setup
-- Generated from supabase/migrations/ directory

-- ========== DROP STATEMENTS FOR CLEAN SETUP ==========
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Secure: Admins view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Secure: Users view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Secure: Role assignment control" ON public.user_roles;
DROP POLICY IF EXISTS "Secure: Role removal control" ON public.user_roles;
DROP POLICY IF EXISTS "Secure: Role update control" ON public.user_roles;

DROP TRIGGER IF EXISTS audit_user_roles_changes ON public.user_roles;
DROP TRIGGER IF EXISTS handle_new_user ON auth.users;
DROP TRIGGER IF EXISTS update_updated_at_column ON public.profiles;
DROP TRIGGER IF EXISTS update_updated_at_column ON public.properties;
DROP TRIGGER IF EXISTS update_updated_at_column ON public.units;
DROP TRIGGER IF EXISTS update_updated_at_column ON public.tenants;
DROP TRIGGER IF EXISTS update_updated_at_column ON public.leases;
DROP TRIGGER IF EXISTS update_updated_at_column ON public.invoices;
DROP TRIGGER IF EXISTS update_updated_at_column ON public.maintenance_requests;
DROP TRIGGER IF EXISTS update_billing_plans_updated_at ON public.billing_plans;
DROP TRIGGER IF EXISTS update_landlord_subscriptions_updated_at ON public.landlord_subscriptions;
DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
DROP TRIGGER IF EXISTS update_sms_bundles_updated_at ON public.sms_bundles;
DROP TRIGGER IF EXISTS update_billing_settings_updated_at ON public.billing_settings;
DROP TRIGGER IF EXISTS update_sms_providers_updated_at ON public.sms_providers;
DROP TRIGGER IF EXISTS update_trial_notification_templates_updated_at ON public.trial_notification_templates;
DROP TRIGGER IF EXISTS update_sms_providers_updated_at ON public.sms_providers;
DROP TRIGGER IF EXISTS encrypt_tenant_pii ON public.tenants;
DROP TRIGGER IF EXISTS encrypt_sms_data ON public.sms_usage;
DROP TRIGGER IF EXISTS encrypt_mpesa_credentials ON public.mpesa_credentials;
DROP TRIGGER IF EXISTS update_sms_usage_trigger ON public.sms_usage;
DROP TRIGGER IF EXISTS ensure_lease_consistency ON public.leases;
DROP TRIGGER IF EXISTS update_mpesa_stk_requests_updated_at ON mpesa_stk_requests;

DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);
DROP FUNCTION IF EXISTS public.has_role_safe(uuid, app_role);
DROP FUNCTION IF EXISTS public.has_permission(uuid, text);
DROP FUNCTION IF EXISTS public.update_updated_at_column();
DROP FUNCTION IF EXISTS public.generate_invoice_number();
DROP FUNCTION IF EXISTS public.log_security_event(text, uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS public.get_property_ids_for_tenant(uuid);
DROP FUNCTION IF EXISTS public.can_user_access_property(uuid, uuid);
DROP FUNCTION IF EXISTS public.tenant_belongs_to_user(uuid, uuid);
DROP FUNCTION IF EXISTS public.sub_user_can_view_tenant(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_tenant_payments_data(uuid);
DROP FUNCTION IF EXISTS public.encrypt_pii(text);
DROP FUNCTION IF EXISTS public.decrypt_pii(text);

DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.properties CASCADE;
DROP TABLE IF EXISTS public.units CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;
DROP TABLE IF EXISTS public.leases CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.maintenance_requests CASCADE;
DROP TABLE IF EXISTS public.permissions CASCADE;
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS public.user_sessions CASCADE;
DROP TABLE IF EXISTS public.user_activity_logs CASCADE;
DROP TABLE IF EXISTS public.billing_plans CASCADE;
DROP TABLE IF EXISTS public.landlord_subscriptions CASCADE;
DROP TABLE IF EXISTS public.invoice_items CASCADE;
DROP TABLE IF EXISTS public.sms_usage CASCADE;
DROP TABLE IF EXISTS public.sms_bundles CASCADE;
DROP TABLE IF EXISTS public.payment_transactions CASCADE;
DROP TABLE IF EXISTS public.billing_settings CASCADE;
DROP TABLE IF EXISTS public.support_tickets CASCADE;
DROP TABLE IF EXISTS public.support_messages CASCADE;
DROP TABLE IF EXISTS public.system_logs CASCADE;
DROP TABLE IF EXISTS public.trial_notification_templates CASCADE;
DROP TABLE IF EXISTS public.trial_status_logs CASCADE;
DROP TABLE IF EXISTS public.mpesa_transactions CASCADE;
DROP TABLE IF EXISTS public.mpesa_credentials CASCADE;
DROP TABLE IF EXISTS public.service_charge_invoices CASCADE;
DROP TABLE IF EXISTS public.landlord_payment_preferences CASCADE;
DROP TABLE IF EXISTS public.mpesa_stk_requests CASCADE;
DROP TABLE IF EXISTS public.sms_providers CASCADE;
DROP TABLE IF EXISTS public.sms_usage_logs CASCADE;
DROP TABLE IF EXISTS public.sms_automation_settings CASCADE;
DROP TABLE IF EXISTS public.sms_campaigns CASCADE;
DROP TABLE IF EXISTS public.sub_users CASCADE;
DROP TABLE IF EXISTS public.email_templates CASCADE;
DROP TABLE IF EXISTS public.sms_templates CASCADE;
DROP TABLE IF EXISTS public.user_audit_logs CASCADE;
DROP TABLE IF EXISTS public.user_status CASCADE;
DROP TABLE IF EXISTS public.impersonation_sessions CASCADE;
DROP TABLE IF EXISTS public.email_logs CASCADE;
DROP TABLE IF EXISTS public.knowledge_base_articles CASCADE;
DROP TABLE IF EXISTS public.pdf_templates CASCADE;
DROP TABLE IF EXISTS public.branding_profiles CASCADE;
DROP TABLE IF EXISTS public.pdf_template_bindings CASCADE;
DROP TABLE IF EXISTS public.unit_types CASCADE;
DROP TABLE IF EXISTS public.unit_type_preferences CASCADE;
DROP TABLE IF EXISTS public.email_templates CASCADE;
DROP TABLE IF EXISTS public.message_templates CASCADE;
DROP TABLE IF EXISTS public.sub_user_activity_logs CASCADE;
DROP TABLE IF EXISTS public.landlord_mpesa_configs CASCADE;
DROP TABLE IF EXISTS public.report_runs CASCADE;
DROP TABLE IF EXISTS public.tenant_credits CASCADE;
DROP TABLE IF EXISTS public.credit_applications CASCADE;
DROP TABLE IF EXISTS public.partner_logos CASCADE;
DROP TABLE IF EXISTS public.sms_logs CASCADE;
DROP TABLE IF EXISTS public.automated_billing_settings CASCADE;
DROP TABLE IF EXISTS public.payment_allocations CASCADE;
DROP TABLE IF EXISTS public.jenga_ipn_callbacks CASCADE;
DROP TABLE IF EXISTS public.landlord_jenga_configs CASCADE;
DROP TABLE IF EXISTS public.kopokopo_callbacks CASCADE;
DROP TABLE IF EXISTS public.self_hosted_instances CASCADE;
DROP TABLE IF EXISTS public.telemetry_heartbeats CASCADE;
DROP TABLE IF EXISTS public.telemetry_events CASCADE;
DROP TABLE IF EXISTS public.telemetry_errors CASCADE;
DROP TABLE IF EXISTS mpesa_stk_requests CASCADE;
DROP TABLE IF EXISTS public.api_rate_limits CASCADE;

DROP TYPE IF EXISTS public.app_role CASCADE;

-- ========== ENUMS & TYPES ==========
CREATE TYPE public.app_role AS ENUM ('Admin', 'Landlord', 'Manager', 'Agent', 'Tenant');

-- ========== SEQUENCES ==========
-- (Sequences managed by SERIAL or gen_random_uuid() as default values)

-- ========== TABLES ==========

-- Profiles table (for user information)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  phone text,
  email text UNIQUE,
  date_of_birth date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User Roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Properties table
CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  city text,
  state text,
  zip_code text,
  country text,
  property_type text,
  total_units integer,
  description text,
  amenities text[],
  owner_id uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Units table
CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_number text,
  unit_type text,
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  bedrooms integer,
  bathrooms numeric,
  square_feet integer,
  rent_amount numeric(10,2),
  security_deposit numeric(10,2),
  status text DEFAULT 'vacant',
  description text,
  amenities text[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Tenants table
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text,
  last_name text,
  email text,
  phone text,
  employment_status text,
  employer_name text,
  monthly_income numeric(10,2),
  emergency_contact_name text,
  emergency_contact_phone text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  profession text,
  national_id text,
  date_of_birth date,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Leases table
CREATE TABLE public.leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE NOT NULL,
  monthly_rent numeric(10,2),
  security_deposit numeric(10,2),
  lease_start_date date,
  lease_end_date date,
  status text DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'expired', 'terminated', 'pending')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;

-- Invoices table
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  lease_id uuid REFERENCES public.leases(id) ON DELETE SET NULL,
  subscription_id uuid,
  landlord_id uuid,
  amount numeric(10,2),
  subtotal numeric(10,2) DEFAULT 0,
  tax_amount numeric(10,2) DEFAULT 0,
  discount_amount numeric(10,2) DEFAULT 0,
  total_amount numeric(10,2),
  currency text DEFAULT 'USD',
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'refunded')),
  invoice_date date DEFAULT CURRENT_DATE,
  due_date date,
  paid_date timestamp with time zone,
  description text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Payments table
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  lease_id uuid REFERENCES public.leases(id) ON DELETE SET NULL,
  amount numeric(10,2),
  payment_date date,
  payment_type text,
  status text,
  payment_method text,
  payment_reference text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Expenses table
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  amount numeric(10,2),
  category text,
  description text,
  expense_date date,
  vendor_name text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Maintenance Requests table
CREATE TABLE public.maintenance_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  description text,
  priority text,
  status text DEFAULT 'open',
  assigned_to uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

-- Permissions table
CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  category text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- Role Permissions table
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (role, permission_id)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- User Sessions table
CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  login_time timestamp with time zone DEFAULT now(),
  logout_time timestamp with time zone,
  ip_address inet,
  user_agent text,
  device_info jsonb,
  location text,
  session_token text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- User Activity Logs table
CREATE TABLE public.user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb,
  ip_address inet,
  user_agent text,
  performed_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Billing Plans table
CREATE TABLE public.billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL,
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual')),
  max_properties integer,
  max_units integer,
  sms_credits_included integer DEFAULT 0,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

-- Landlord Subscriptions table
CREATE TABLE public.landlord_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL,
  billing_plan_id uuid REFERENCES public.billing_plans(id),
  status text DEFAULT 'trial' NOT NULL CHECK (status IN ('trial', 'active', 'suspended', 'cancelled', 'overdue')),
  trial_start_date timestamp with time zone,
  trial_end_date timestamp with time zone,
  subscription_start_date timestamp with time zone,
  next_billing_date timestamp with time zone,
  last_billing_date timestamp with time zone,
  sms_credits_balance integer DEFAULT 0,
  auto_renewal boolean DEFAULT true,
  grace_period_days integer DEFAULT 7,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.landlord_subscriptions ENABLE ROW LEVEL SECURITY;

-- Invoice Items table
CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('subscription', 'sms_bundle', 'addon', 'discount')),
  description text NOT NULL,
  quantity integer DEFAULT 1,
  unit_price numeric(10,2) NOT NULL,
  total_price numeric(10,2) NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- SMS Usage table
CREATE TABLE public.sms_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL,
  recipient_phone text NOT NULL,
  message_content text,
  cost numeric(10,2) NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
  sent_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.sms_usage ENABLE ROW LEVEL SECURITY;

-- SMS Bundles table
CREATE TABLE public.sms_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  sms_count integer NOT NULL,
  price numeric(10,2) NOT NULL,
  currency text DEFAULT 'USD',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.sms_bundles ENABLE ROW LEVEL SECURITY;

-- Payment Transactions table
CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id),
  landlord_id uuid NOT NULL,
  transaction_id text,
  payment_method text NOT NULL CHECK (payment_method IN ('mpesa', 'stripe', 'bank_transfer', 'manual')),
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'USD',
  status text NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  gateway_response jsonb,
  processed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Billing Settings table
CREATE TABLE public.billing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL,
  description text,
  updated_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

-- Support Tickets table
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  title text,
  description text,
  status text DEFAULT 'open',
  priority text,
  assigned_to uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Support Messages table
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id uuid,
  message text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- System Logs table
CREATE TABLE public.system_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_level text,
  message text,
  details jsonb,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Trial Notification Templates table
CREATE TABLE public.trial_notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email_subject text,
  email_body text,
  sms_message text,
  template_type text,
  trigger_days_before_expiry integer,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.trial_notification_templates ENABLE ROW LEVEL SECURITY;

-- Trial Status Logs table
CREATE TABLE public.trial_status_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL,
  previous_status text,
  new_status text,
  reason text,
  days_remaining integer,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.trial_status_logs ENABLE ROW LEVEL SECURITY;

-- M-Pesa Transactions table
CREATE TABLE public.mpesa_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id),
  transaction_id text UNIQUE,
  mpesa_receipt_number text,
  amount numeric(10,2),
  phone_number text,
  status text,
  response_data jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;

-- M-Pesa Credentials table
CREATE TABLE public.mpesa_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL,
  consumer_key text,
  consumer_secret text,
  passkey text,
  business_shortcode text,
  is_active boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.mpesa_credentials ENABLE ROW LEVEL SECURITY;

-- Service Charge Invoices table
CREATE TABLE public.service_charge_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL,
  billing_plan_id uuid REFERENCES public.billing_plans(id),
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'USD',
  billing_period_start date,
  billing_period_end date,
  invoice_date date DEFAULT CURRENT_DATE,
  due_date date,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  mpesa_checkout_request_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.service_charge_invoices ENABLE ROW LEVEL SECURITY;

-- Landlord Payment Preferences table
CREATE TABLE public.landlord_payment_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL UNIQUE,
  preferred_payment_method text,
  mpesa_phone_number text,
  bank_account_number text,
  bank_name text,
  account_holder_name text,
  payment_instructions text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.landlord_payment_preferences ENABLE ROW LEVEL SECURITY;

-- M-Pesa STK Requests table
CREATE TABLE IF NOT EXISTS mpesa_stk_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id),
  phone_number text NOT NULL,
  amount numeric(10,2) NOT NULL,
  checkout_request_id text UNIQUE,
  response_code text,
  response_description text,
  merchant_request_id text,
  status text DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE mpesa_stk_requests ENABLE ROW LEVEL SECURITY;

-- SMS Providers table
CREATE TABLE public.sms_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  provider_type text NOT NULL,
  api_key text,
  api_secret text,
  account_id text,
  is_active boolean DEFAULT false,
  configuration jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.sms_providers ENABLE ROW LEVEL SECURITY;

-- SMS Usage Logs table
CREATE TABLE IF NOT EXISTS public.sms_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL,
  sms_provider_id uuid REFERENCES public.sms_providers(id),
  recipient_phone text NOT NULL,
  message_content text,
  sms_count integer DEFAULT 1,
  cost numeric(10,2),
  status text DEFAULT 'pending',
  external_id text,
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.sms_usage_logs ENABLE ROW LEVEL SECURITY;

-- SMS Automation Settings table
CREATE TABLE public.sms_automation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL,
  rule_name text,
  event_type text,
  message_template text,
  is_enabled boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.sms_automation_settings ENABLE ROW LEVEL SECURITY;

-- SMS Campaigns table
CREATE TABLE IF NOT EXISTS public.sms_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL,
  name text NOT NULL,
  message_content text,
  recipient_group text,
  scheduled_time timestamp with time zone,
  status text DEFAULT 'draft',
  sms_count integer DEFAULT 0,
  cost numeric(10,2),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.sms_campaigns ENABLE ROW LEVEL SECURITY;

-- Sub Users table
CREATE TABLE IF NOT EXISTS public.sub_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL,
  email text NOT NULL,
  first_name text,
  last_name text,
  role text,
  permissions jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.sub_users ENABLE ROW LEVEL SECURITY;

-- Email Templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid,
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- SMS Templates table
CREATE TABLE IF NOT EXISTS public.sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid,
  name text NOT NULL,
  message_content text NOT NULL,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

-- User Audit Logs table
CREATE TABLE public.user_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  changes jsonb,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.user_audit_logs ENABLE ROW LEVEL SECURITY;

-- User Status table
CREATE TABLE public.user_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text DEFAULT 'active',
  reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.user_status ENABLE ROW LEVEL SECURITY;

-- Impersonation Sessions table
CREATE TABLE public.impersonation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  impersonated_user_id uuid NOT NULL,
  start_time timestamp with time zone DEFAULT now(),
  end_time timestamp with time zone,
  reason text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Email Logs table
CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text NOT NULL,
  subject text,
  body text,
  status text,
  sent_at timestamp with time zone,
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Knowledge Base Articles table
CREATE TABLE IF NOT EXISTS public.knowledge_base_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text,
  category text,
  is_published boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.knowledge_base_articles ENABLE ROW LEVEL SECURITY;

-- PDF Templates table
CREATE TABLE IF NOT EXISTS public.pdf_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  template_content text,
  document_type text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.pdf_templates ENABLE ROW LEVEL SECURITY;

-- Branding Profiles table
CREATE TABLE IF NOT EXISTS public.branding_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid,
  logo_url text,
  primary_color text,
  secondary_color text,
  company_name text,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.branding_profiles ENABLE ROW LEVEL SECURITY;

-- PDF Template Bindings table
CREATE TABLE IF NOT EXISTS public.pdf_template_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_template_id uuid REFERENCES public.pdf_templates(id),
  branding_profile_id uuid REFERENCES public.branding_profiles(id),
  document_type text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.pdf_template_bindings ENABLE ROW LEVEL SECURITY;

-- Unit Types table
CREATE TABLE IF NOT EXISTS public.unit_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.unit_types ENABLE ROW LEVEL SECURITY;

-- Unit Type Preferences table
CREATE TABLE public.unit_type_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL,
  unit_type_id uuid REFERENCES public.unit_types(id),
  is_enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.unit_type_preferences ENABLE ROW LEVEL SECURITY;

-- Message Templates table
CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text,
  body text NOT NULL,
  template_type text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Sub User Activity Logs table
CREATE TABLE IF NOT EXISTS public.sub_user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_user_id uuid NOT NULL,
  landlord_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.sub_user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Landlord M-Pesa Configs table
CREATE TABLE IF NOT EXISTS public.landlord_mpesa_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL,
  consumer_key text,
  consumer_secret text,
  passkey text,
  business_shortcode text,
  is_active boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.landlord_mpesa_configs ENABLE ROW LEVEL SECURITY;

-- Report Runs table
CREATE TABLE IF NOT EXISTS public.report_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL,
  report_type text,
  status text DEFAULT 'pending',
  file_url text,
  generated_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.report_runs ENABLE ROW LEVEL SECURITY;

-- Tenant Credits table
CREATE TABLE public.tenant_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  reason text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.tenant_credits ENABLE ROW LEVEL SECURITY;

-- Credit Applications table
CREATE TABLE public.credit_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_credit_id uuid NOT NULL REFERENCES public.tenant_credits(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount_applied numeric(10,2) NOT NULL,
  applied_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.credit_applications ENABLE ROW LEVEL SECURITY;

-- Partner Logos table
CREATE TABLE public.partner_logos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  logo_url text NOT NULL,
  display_order integer,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.partner_logos ENABLE ROW LEVEL SECURITY;

-- SMS Logs table
CREATE TABLE IF NOT EXISTS public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL,
  recipient_phone text NOT NULL,
  message_content text,
  provider text,
  status text DEFAULT 'pending',
  external_id text,
  cost numeric(10,2),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Automated Billing Settings table
CREATE TABLE IF NOT EXISTS public.automated_billing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL,
  auto_invoice_enabled boolean DEFAULT false,
  auto_payment_enabled boolean DEFAULT false,
  invoice_day_of_month integer,
  payment_reminder_days integer[],
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.automated_billing_settings ENABLE ROW LEVEL SECURITY;

-- Payment Allocations table
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid,
  invoice_id uuid REFERENCES public.invoices(id),
  amount allocated numeric(10,2),
  allocation_type text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

-- Jenga IPN Callbacks table
CREATE TABLE IF NOT EXISTS public.jenga_ipn_callbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id),
  transaction_id text UNIQUE,
  amount numeric(10,2),
  status text,
  callback_data jsonb,
  processed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.jenga_ipn_callbacks ENABLE ROW LEVEL SECURITY;

-- Landlord Jenga Configs table
CREATE TABLE IF NOT EXISTS public.landlord_jenga_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL,
  api_key text,
  merchant_code text,
  is_active boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.landlord_jenga_configs ENABLE ROW LEVEL SECURITY;

-- KopoKopo Callbacks table
CREATE TABLE IF NOT EXISTS public.kopokopo_callbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id),
  callback_id text UNIQUE,
  transaction_data jsonb,
  status text,
  processed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.kopokopo_callbacks ENABLE ROW LEVEL SECURITY;

-- Self Hosted Instances table
CREATE TABLE IF NOT EXISTS public.self_hosted_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL,
  instance_name text,
  deployment_type text,
  status text DEFAULT 'active',
  configuration jsonb,
  last_heartbeat timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.self_hosted_instances ENABLE ROW LEVEL SECURITY;

-- Telemetry Heartbeats table
CREATE TABLE IF NOT EXISTS public.telemetry_heartbeats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid REFERENCES public.self_hosted_instances(id),
  landlord_id uuid NOT NULL,
  status text,
  cpu_usage numeric,
  memory_usage numeric,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.telemetry_heartbeats ENABLE ROW LEVEL SECURITY;

-- Telemetry Events table
CREATE TABLE IF NOT EXISTS public.telemetry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid REFERENCES public.self_hosted_instances(id),
  landlord_id uuid NOT NULL,
  event_type text,
  event_data jsonb,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

-- Telemetry Errors table
CREATE TABLE IF NOT EXISTS public.telemetry_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid REFERENCES public.self_hosted_instances(id),
  landlord_id uuid NOT NULL,
  error_message text,
  stack_trace text,
  severity text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.telemetry_errors ENABLE ROW LEVEL SECURITY;

-- ========== INDEXES ==========
CREATE INDEX idx_properties_owner_id ON public.properties(owner_id);
CREATE INDEX idx_units_property_id ON public.units(property_id);
CREATE INDEX idx_tenants_user_id ON public.tenants(user_id);
CREATE INDEX idx_leases_tenant_id ON public.leases(tenant_id);
CREATE INDEX idx_leases_unit_id ON public.leases(unit_id);
CREATE INDEX idx_invoices_tenant_id ON public.invoices(tenant_id);
CREATE INDEX idx_invoices_lease_id ON public.invoices(lease_id);
CREATE INDEX idx_invoices_landlord_id ON public.invoices(landlord_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX idx_payments_tenant_id ON public.payments(tenant_id);
CREATE INDEX idx_payments_lease_id ON public.payments(lease_id);
CREATE INDEX idx_expenses_property_id ON public.expenses(property_id);
CREATE INDEX idx_maintenance_requests_property_id ON public.maintenance_requests(property_id);
CREATE INDEX idx_maintenance_requests_unit_id ON public.maintenance_requests(unit_id);
CREATE INDEX idx_maintenance_requests_tenant_id ON public.maintenance_requests(tenant_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_activity_logs_user_id ON public.user_activity_logs(user_id);
CREATE INDEX idx_landlord_subscriptions_landlord_id ON public.landlord_subscriptions(landlord_id);
CREATE INDEX idx_landlord_subscriptions_status ON public.landlord_subscriptions(status);
CREATE INDEX idx_sms_usage_landlord_id ON public.sms_usage(landlord_id);
CREATE INDEX idx_sms_usage_sent_at ON public.sms_usage(sent_at);
CREATE INDEX idx_payment_transactions_landlord_id ON public.payment_transactions(landlord_id);
CREATE INDEX idx_payment_transactions_status ON public.payment_transactions(status);
CREATE INDEX idx_mpesa_transactions_invoice_id ON public.mpesa_transactions(invoice_id);
CREATE INDEX idx_mpesa_transactions_phone ON public.mpesa_transactions(phone_number);
CREATE INDEX idx_service_charge_invoices_landlord_id ON public.service_charge_invoices(landlord_id);
CREATE INDEX idx_service_charge_invoices_status ON public.service_charge_invoices(status);
CREATE INDEX idx_trial_status_logs_landlord_id ON public.trial_status_logs(landlord_id);
CREATE INDEX idx_sub_users_landlord_id ON public.sub_users(landlord_id);
CREATE INDEX idx_sub_user_activity_logs_landlord_id ON public.sub_user_activity_logs(landlord_id);
CREATE INDEX idx_sms_logs_landlord_id ON public.sms_logs(landlord_id);
CREATE INDEX idx_sms_campaigns_landlord_id ON public.sms_campaigns(landlord_id);

-- ========== FUNCTIONS ==========
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_role_safe(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  ), false)
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'phone'
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'Agent');

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text AS $$
DECLARE
  next_number integer;
  invoice_number text;
BEGIN
  next_number := (SELECT COUNT(*) + 1 FROM public.invoices);
  invoice_number := 'INV-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(next_number::text, 5, '0');
  RETURN invoice_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    JOIN public.permissions p ON rp.permission_id = p.id
    JOIN public.user_roles ur ON rp.role = ur.role
    WHERE ur.user_id = _user_id
      AND p.name = _permission
  )
$$;

CREATE OR REPLACE FUNCTION public.get_property_ids_for_tenant(_tenant_id uuid)
RETURNS uuid[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT DISTINCT p.id
    FROM public.properties p
    JOIN public.units u ON p.id = u.property_id
    JOIN public.leases l ON u.id = l.unit_id
    WHERE l.tenant_id = _tenant_id
      AND l.status = 'active'
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.can_user_access_property(_user_id uuid, _property_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = _property_id
      AND (p.owner_id = _user_id OR has_role(_user_id, 'Admin'::app_role))
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.tenant_belongs_to_user(_user_id uuid, _tenant_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.leases l
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE l.tenant_id = _tenant_id
      AND p.owner_id = _user_id
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.sub_user_can_view_tenant(_sub_user_id uuid, _tenant_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.sub_users su
    JOIN public.leases l ON l.tenant_id = _tenant_id
    JOIN public.units u ON l.unit_id = u.id
    JOIN public.properties p ON u.property_id = p.id
    WHERE su.id = _sub_user_id
      AND p.owner_id = su.landlord_id
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.log_security_event(
  _event_type text,
  _user_id uuid,
  _entity_id uuid,
  _details jsonb
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.user_activity_logs (user_id, action, entity_id, details)
  VALUES (_user_id, _event_type, _entity_id, _details);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.get_tenant_payments_data(
  p_user_id uuid DEFAULT auth.uid(),
  p_limit integer DEFAULT 100
)
RETURNS TABLE (
  invoice_id uuid,
  invoice_number text,
  amount numeric,
  status text,
  due_date date
) AS $$
BEGIN
  RETURN QUERY
  SELECT i.id, i.invoice_number, i.total_amount, i.status, i.due_date
  FROM public.invoices i
  JOIN public.leases l ON i.lease_id = l.id
  WHERE l.tenant_id IN (
    SELECT id FROM public.tenants WHERE user_id = p_user_id
  )
  ORDER BY i.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========== TRIGGERS ==========
CREATE TRIGGER handle_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_units_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leases_updated_at
  BEFORE UPDATE ON public.leases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_maintenance_requests_updated_at
  BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_billing_plans_updated_at
  BEFORE UPDATE ON public.billing_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_landlord_subscriptions_updated_at
  BEFORE UPDATE ON public.landlord_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sms_bundles_updated_at
  BEFORE UPDATE ON public.sms_bundles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_billing_settings_updated_at
  BEFORE UPDATE ON public.billing_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sms_providers_updated_at
  BEFORE UPDATE ON public.sms_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trial_notification_templates_updated_at
  BEFORE UPDATE ON public.trial_notification_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mpesa_transactions_updated_at
  BEFORE UPDATE ON public.mpesa_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_charge_invoices_updated_at
  BEFORE UPDATE ON public.service_charge_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_landlord_payment_preferences_updated_at
  BEFORE UPDATE ON public.landlord_payment_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mpesa_stk_requests_updated_at
  BEFORE UPDATE ON mpesa_stk_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sms_automation_settings_updated_at
  BEFORE UPDATE ON public.sms_automation_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sms_campaigns_updated_at
  BEFORE UPDATE ON public.sms_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sms_templates_updated_at
  BEFORE UPDATE ON public.sms_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_landlord_mpesa_configs_updated_at
  BEFORE UPDATE ON public.landlord_mpesa_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_landlord_jenga_configs_updated_at
  BEFORE UPDATE ON public.landlord_jenga_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_self_hosted_instances_updated_at
  BEFORE UPDATE ON public.self_hosted_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_partner_logos_updated_at
  BEFORE UPDATE ON public.partner_logos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ========== RLS POLICIES ==========

-- User Roles Policies
CREATE POLICY "Secure: Admins view all roles" ON public.user_roles
  FOR SELECT USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Secure: Users view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Secure: Role assignment control" ON public.user_roles
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Secure: Role removal control" ON public.user_roles
  FOR DELETE USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Secure: Role update control" ON public.user_roles
  FOR UPDATE USING (has_role(auth.uid(), 'Admin'::app_role));

-- Profiles Policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (has_role(auth.uid(), 'Admin'::app_role));

-- Properties Policies
CREATE POLICY "Landlords can view their own properties" ON public.properties
  FOR SELECT USING (
    owner_id = auth.uid() OR
    has_role(auth.uid(), 'Admin'::app_role)
  );

CREATE POLICY "Landlords can manage their own properties" ON public.properties
  FOR ALL USING (
    owner_id = auth.uid() OR
    has_role(auth.uid(), 'Admin'::app_role)
  );

-- Units Policies
CREATE POLICY "Users can view units in properties they own or manage" ON public.units
  FOR SELECT USING (
    property_id IN (
      SELECT id FROM public.properties WHERE owner_id = auth.uid()
    ) OR has_role(auth.uid(), 'Admin'::app_role)
  );

CREATE POLICY "Users can manage units in properties they own" ON public.units
  FOR ALL USING (
    property_id IN (
      SELECT id FROM public.properties WHERE owner_id = auth.uid()
    ) OR has_role(auth.uid(), 'Admin'::app_role)
  );

-- Tenants Policies
CREATE POLICY "Users can view their own tenant records" ON public.tenants
  FOR SELECT USING (
    auth.uid() = user_id OR
    has_role(auth.uid(), 'Admin'::app_role)
  );

CREATE POLICY "Landlords can view tenants in their properties" ON public.tenants
  FOR SELECT USING (
    id IN (SELECT DISTINCT l.tenant_id FROM public.leases l
      JOIN public.units u ON l.unit_id = u.id
      JOIN public.properties p ON u.property_id = p.id
      WHERE p.owner_id = auth.uid())
    OR has_role(auth.uid(), 'Admin'::app_role)
  );

-- Leases Policies
CREATE POLICY "Users can view leases for their properties" ON public.leases
  FOR SELECT USING (
    unit_id IN (
      SELECT u.id FROM public.units u
      JOIN public.properties p ON u.property_id = p.id
      WHERE p.owner_id = auth.uid()
    ) OR
    tenant_id IN (SELECT id FROM public.tenants WHERE user_id = auth.uid()) OR
    has_role(auth.uid(), 'Admin'::app_role)
  );

CREATE POLICY "Users can manage leases for their properties or tenancies" ON public.leases
  FOR ALL USING (
    unit_id IN (
      SELECT u.id FROM public.units u
      JOIN public.properties p ON u.property_id = p.id
      WHERE p.owner_id = auth.uid()
    ) OR
    tenant_id IN (SELECT id FROM public.tenants WHERE user_id = auth.uid()) OR
    has_role(auth.uid(), 'Admin'::app_role)
  );

-- Invoices Policies
CREATE POLICY "Tenants can view their own invoices" ON public.invoices
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE user_id = auth.uid()) OR
    has_role(auth.uid(), 'Admin'::app_role)
  );

CREATE POLICY "Landlords can view invoices for their properties" ON public.invoices
  FOR SELECT USING (
    landlord_id = auth.uid() OR
    tenant_id IN (
      SELECT DISTINCT l.tenant_id FROM public.leases l
      JOIN public.units u ON l.unit_id = u.id
      JOIN public.properties p ON u.property_id = p.id
      WHERE p.owner_id = auth.uid()
    ) OR
    has_role(auth.uid(), 'Admin'::app_role)
  );

-- Payments Policies
CREATE POLICY "Users can view payments related to their leases" ON public.payments
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE user_id = auth.uid()) OR
    has_role(auth.uid(), 'Admin'::app_role)
  );

-- Maintenance Requests Policies
CREATE POLICY "Tenants can view their own maintenance requests" ON public.maintenance_requests
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE user_id = auth.uid()) OR
    has_role(auth.uid(), 'Admin'::app_role)
  );

CREATE POLICY "Landlords can view maintenance requests for their properties" ON public.maintenance_requests
  FOR SELECT USING (
    property_id IN (SELECT id FROM public.properties WHERE owner_id = auth.uid()) OR
    has_role(auth.uid(), 'Admin'::app_role)
  );

-- Billing Plans Policies
CREATE POLICY "Admins can manage billing plans" ON public.billing_plans
  FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view active billing plans" ON public.billing_plans
  FOR SELECT USING (is_active = true AND has_role(auth.uid(), 'Landlord'::app_role));

-- Landlord Subscriptions Policies
CREATE POLICY "Admins can manage all subscriptions" ON public.landlord_subscriptions
  FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view their own subscription" ON public.landlord_subscriptions
  FOR SELECT USING (has_role(auth.uid(), 'Landlord'::app_role) AND landlord_id = auth.uid());

-- SMS Usage Policies
CREATE POLICY "Secure SMS access - landlord only" ON public.sms_usage
  FOR ALL USING (
    landlord_id = auth.uid() OR
    has_role(auth.uid(), 'Admin'::app_role)
  );

-- Support Tickets Policies
CREATE POLICY "Users can view their own support tickets" ON public.support_tickets
  FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Users can create support tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Permissions Policies
CREATE POLICY "Admins can manage permissions" ON public.permissions
  FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

-- User Sessions Policies
CREATE POLICY "Users can view their own sessions" ON public.user_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sessions" ON public.user_sessions
  FOR SELECT USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "System can insert sessions" ON public.user_sessions
  FOR INSERT WITH CHECK (true);

-- User Activity Logs Policies
CREATE POLICY "Users can view their own activity" ON public.user_activity_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all activity" ON public.user_activity_logs
  FOR SELECT USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "System can insert activity logs" ON public.user_activity_logs
  FOR INSERT WITH CHECK (true);

-- SMS Providers Policies
CREATE POLICY "Admins can manage SMS providers" ON public.sms_providers
  FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

-- SMS Templates Policies
CREATE POLICY "Users can view their templates or defaults" ON public.sms_templates
  FOR SELECT USING (landlord_id = auth.uid() OR landlord_id IS NULL OR has_role(auth.uid(), 'Admin'::app_role));

-- Email Templates Policies
CREATE POLICY "Users can view their templates or defaults" ON public.email_templates
  FOR SELECT USING (landlord_id = auth.uid() OR landlord_id IS NULL OR has_role(auth.uid(), 'Admin'::app_role));

-- Sub Users Policies
CREATE POLICY "Landlords can manage their sub-users" ON public.sub_users
  FOR ALL USING (landlord_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role));

-- Trial Notification Templates Policies
CREATE POLICY "Admins can manage templates" ON public.trial_notification_templates
  FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

-- Trial Status Logs Policies
CREATE POLICY "Admins can view trial status logs" ON public.trial_status_logs
  FOR SELECT USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view their trial status" ON public.trial_status_logs
  FOR SELECT USING (landlord_id = auth.uid());

-- Tenant Credits Policies
CREATE POLICY "Tenants can view their credits" ON public.tenant_credits
  FOR SELECT USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE user_id = auth.uid()) OR
    has_role(auth.uid(), 'Admin'::app_role)
  );

-- Partner Logos Policies
CREATE POLICY "Admins can manage partner logos" ON public.partner_logos
  FOR ALL USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Anyone can view active partner logos" ON public.partner_logos
  FOR SELECT USING (is_active = true);

-- Self Hosted Instances Policies
CREATE POLICY "Admins can view instances" ON public.self_hosted_instances
  FOR SELECT USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "Landlords can view their instances" ON public.self_hosted_instances
  FOR SELECT USING (landlord_id = auth.uid());

-- Telemetry Policies
CREATE POLICY "Admins can view telemetry" ON public.telemetry_heartbeats
  FOR SELECT USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "System can insert telemetry" ON public.telemetry_heartbeats
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view events" ON public.telemetry_events
  FOR SELECT USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "System can insert events" ON public.telemetry_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view errors" ON public.telemetry_errors
  FOR SELECT USING (has_role(auth.uid(), 'Admin'::app_role));

CREATE POLICY "System can insert errors" ON public.telemetry_errors
  FOR INSERT WITH CHECK (true);

-- ========== END OF SCHEMA DEFINITION ==========
