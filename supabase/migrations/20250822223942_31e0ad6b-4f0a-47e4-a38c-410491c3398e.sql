
-- 1) Expand RLS to include Manager and Agent for published, targeted articles
ALTER POLICY "Users can view published articles for their user type"
ON public.knowledge_base_articles
USING (
  is_published = true
  AND (
    ( 'Admin' = ANY (target_user_types)   AND public.has_role(auth.uid(), 'Admin'::public.app_role) )
    OR ( 'Landlord' = ANY (target_user_types) AND public.has_role(auth.uid(), 'Landlord'::public.app_role) )
    OR ( 'Manager' = ANY (target_user_types)  AND public.has_role(auth.uid(), 'Manager'::public.app_role) )
    OR ( 'Agent' = ANY (target_user_types)    AND public.has_role(auth.uid(), 'Agent'::public.app_role) )
    OR ( 'Tenant' = ANY (target_user_types)   AND EXISTS (
          SELECT 1 FROM public.tenants WHERE tenants.user_id = auth.uid()
        )
    )
  )
);

-- 2) Seed initial Knowledge Base articles (idempotent by title)

-- LANDLORD
INSERT INTO public.knowledge_base_articles (title, content, category, tags, target_user_types, is_published, published_at)
SELECT
  'Getting started as a Landlord',
  'Welcome! Start by creating your first property, adding units, and inviting tenants. Then set your payment preferences (e.g., M-Pesa) under Payment Settings. You can generate rent invoices automatically and track collections on the dashboard.',
  'Getting Started',
  ARRAY['getting-started','properties','units','tenants','rent']::text[],
  ARRAY['Landlord']::text[],
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_articles WHERE title = 'Getting started as a Landlord');

INSERT INTO public.knowledge_base_articles (title, content, category, tags, target_user_types, is_published, published_at)
SELECT
  'Billing & Subscription for Landlords',
  'Manage your subscription, invoices, and SMS credits on the Billing & Subscription page. You can request a plan change from Support if needed. Keep your payment method up to date to avoid service interruption.',
  'Billing & Subscription',
  ARRAY['billing','subscription','plans','sms-credits']::text[],
  ARRAY['Landlord']::text[],
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_articles WHERE title = 'Billing & Subscription for Landlords');

INSERT INTO public.knowledge_base_articles (title, content, category, tags, target_user_types, is_published, published_at)
SELECT
  'Rent collection and invoices',
  'Create recurring or one-off rent invoices, share them with tenants, and track payments. The invoices page shows status, due dates, and outstanding balances. Use the reports for collection rate and aging analysis.',
  'Payments & Invoices',
  ARRAY['invoices','payments','rent','reports']::text[],
  ARRAY['Landlord']::text[],
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_articles WHERE title = 'Rent collection and invoices');

-- MANAGER
INSERT INTO public.knowledge_base_articles (title, content, category, tags, target_user_types, is_published, published_at)
SELECT
  'Manager role overview',
  'Managers can manage assigned properties: update units, review tenant details, handle maintenance, and track collections. Access is limited to properties you are assigned to.',
  'Account & Roles',
  ARRAY['roles','manager','permissions']::text[],
  ARRAY['Manager']::text[],
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_articles WHERE title = 'Manager role overview');

INSERT INTO public.knowledge_base_articles (title, content, category, tags, target_user_types, is_published, published_at)
SELECT
  'Handling maintenance requests (Manager)',
  'Review, assign, and update maintenance requests. Communicate timelines and mark completed requests to keep records and costs accurate.',
  'Maintenance',
  ARRAY['maintenance','work-orders','costs']::text[],
  ARRAY['Manager']::text[],
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_articles WHERE title = 'Handling maintenance requests (Manager)');

-- AGENT
INSERT INTO public.knowledge_base_articles (title, content, category, tags, target_user_types, is_published, published_at)
SELECT
  'Agent role overview',
  'Agents support field operations: assist with tenant onboarding, document collection, and payment recording when permitted by the landlord.',
  'Account & Roles',
  ARRAY['roles','agent','permissions']::text[],
  ARRAY['Agent']::text[],
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_articles WHERE title = 'Agent role overview');

INSERT INTO public.knowledge_base_articles (title, content, category, tags, target_user_types, is_published, published_at)
SELECT
  'Recording payments (Agent)',
  'If you have access, record tenant payments accurately with reference numbers and methods. This keeps landlord reports and tenant statements up to date.',
  'Payments & Invoices',
  ARRAY['payments','recording','references']::text[],
  ARRAY['Agent']::text[],
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_articles WHERE title = 'Recording payments (Agent)');

-- TENANT
INSERT INTO public.knowledge_base_articles (title, content, category, tags, target_user_types, is_published, published_at)
SELECT
  'Paying your rent',
  'View your invoices and pay using the methods provided by your landlord (e.g., M-Pesa). You can track payment status and download receipts from your dashboard.',
  'Payments & Invoices',
  ARRAY['tenant','payments','mpesa','receipts']::text[],
  ARRAY['Tenant']::text[],
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_articles WHERE title = 'Paying your rent');

INSERT INTO public.knowledge_base_articles (title, content, category, tags, target_user_types, is_published, published_at)
SELECT
  'Viewing invoices and receipts',
  'Open your Invoices page to see amounts due, due dates, and status. After paying, you can view and download receipts for your records.',
  'Payments & Invoices',
  ARRAY['tenant','invoices','receipts']::text[],
  ARRAY['Tenant']::text[],
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_articles WHERE title = 'Viewing invoices and receipts');

INSERT INTO public.knowledge_base_articles (title, content, category, tags, target_user_types, is_published, published_at)
SELECT
  'Submitting maintenance requests',
  'Use the Maintenance page to submit a request with details and photos. Track updates and completion status from the same page.',
  'Maintenance',
  ARRAY['tenant','maintenance','requests']::text[],
  ARRAY['Tenant']::text[],
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_articles WHERE title = 'Submitting maintenance requests');

-- ADMIN
INSERT INTO public.knowledge_base_articles (title, content, category, tags, target_user_types, is_published, published_at)
SELECT
  'Admin overview: users, roles, and permissions',
  'Admins can create users, assign roles (Landlord, Manager, Agent, Tenant), and manage permissions. Use the Admin dashboard for oversight and audits.',
  'Account & Roles',
  ARRAY['admin','users','roles','permissions']::text[],
  ARRAY['Admin']::text[],
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_articles WHERE title = 'Admin overview: users, roles, and permissions');

INSERT INTO public.knowledge_base_articles (title, content, category, tags, target_user_types, is_published, published_at)
SELECT
  'Configuring billing and communications (Admin)',
  'Configure platform billing plans, review invoices, and set up SMS/Email providers and templates. Monitor health and logs to ensure reliable delivery.',
  'Billing & Subscription',
  ARRAY['admin','billing','sms','email','templates']::text[],
  ARRAY['Admin']::text[],
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_articles WHERE title = 'Configuring billing and communications (Admin)');

-- GENERAL (all roles)
INSERT INTO public.knowledge_base_articles (title, content, category, tags, target_user_types, is_published, published_at)
SELECT
  'How to use the Help Center',
  'Use search to quickly find guides. Filter by category. Popular articles appear first. If you still need help, contact support from the Help Center.',
  'Getting Started',
  ARRAY['help-center','search','categories']::text[],
  ARRAY['Admin','Landlord','Manager','Agent','Tenant']::text[],
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_articles WHERE title = 'How to use the Help Center');

INSERT INTO public.knowledge_base_articles (title, content, category, tags, target_user_types, is_published, published_at)
SELECT
  'Notifications and alerts',
  'The app notifies you about invoices, payments, and maintenance updates. Adjust your notification preferences in settings if available.',
  'General',
  ARRAY['notifications','alerts','preferences']::text[],
  ARRAY['Admin','Landlord','Manager','Agent','Tenant']::text[],
  true, now()
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base_articles WHERE title = 'Notifications and alerts');
