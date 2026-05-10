-- Add account_type to landlord_subscriptions to distinguish landlords from agencies
ALTER TABLE landlord_subscriptions 
ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'landlord' CHECK (account_type IN ('landlord', 'agency'));

-- Add plan_category to billing_plans to categorize plans for different user types
ALTER TABLE billing_plans 
ADD COLUMN IF NOT EXISTS plan_category TEXT DEFAULT 'both' CHECK (plan_category IN ('landlord', 'agency', 'both'));

-- Add unit range fields for landing page display
ALTER TABLE billing_plans 
ADD COLUMN IF NOT EXISTS min_units INTEGER DEFAULT 1;

ALTER TABLE billing_plans 
ADD COLUMN IF NOT EXISTS max_units_display TEXT;

-- Add display order for landing page sorting
ALTER TABLE billing_plans 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Add yearly discount percentage
ALTER TABLE billing_plans 
ADD COLUMN IF NOT EXISTS yearly_discount_percent NUMERIC DEFAULT 15;

-- Add popular flag for highlighting plans
ALTER TABLE billing_plans 
ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false;

-- Add competitive advantage text for landing page
ALTER TABLE billing_plans 
ADD COLUMN IF NOT EXISTS competitive_note TEXT;

-- Create index for efficient filtering by category
CREATE INDEX IF NOT EXISTS idx_billing_plans_category ON billing_plans(plan_category) WHERE is_active = true;