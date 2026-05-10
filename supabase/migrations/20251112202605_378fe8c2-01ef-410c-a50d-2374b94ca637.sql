-- Create plan_features table to define all available features
CREATE TABLE IF NOT EXISTS plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN ('core', 'advanced', 'premium', 'enterprise')),
  icon_name text,
  menu_item_title text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create billing_plan_features junction table
CREATE TABLE IF NOT EXISTS billing_plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_plan_id uuid REFERENCES billing_plans(id) ON DELETE CASCADE,
  feature_key text REFERENCES plan_features(feature_key) ON DELETE CASCADE,
  is_enabled boolean DEFAULT true,
  custom_limit integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE(billing_plan_id, feature_key)
);

-- Enable RLS
ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_plan_features ENABLE ROW LEVEL SECURITY;

-- RLS Policies for plan_features
CREATE POLICY "Everyone can view active features"
  ON plan_features FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage features"
  ON plan_features FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role));

-- RLS Policies for billing_plan_features
CREATE POLICY "Everyone can view plan features"
  ON billing_plan_features FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage plan features"
  ON billing_plan_features FOR ALL
  USING (has_role(auth.uid(), 'Admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_plan_features_category ON plan_features(category, sort_order);
CREATE INDEX idx_billing_plan_features_plan ON billing_plan_features(billing_plan_id);
CREATE INDEX idx_billing_plan_features_feature ON billing_plan_features(feature_key);

-- Create function to get features for a billing plan
CREATE OR REPLACE FUNCTION get_plan_features(plan_id uuid)
RETURNS TABLE (
  feature_key text,
  display_name text,
  description text,
  category text,
  icon_name text,
  is_enabled boolean,
  custom_limit integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pf.feature_key,
    pf.display_name,
    pf.description,
    pf.category,
    pf.icon_name,
    COALESCE(bpf.is_enabled, false) as is_enabled,
    bpf.custom_limit
  FROM plan_features pf
  LEFT JOIN billing_plan_features bpf 
    ON pf.feature_key = bpf.feature_key 
    AND bpf.billing_plan_id = plan_id
  WHERE pf.is_active = true
  ORDER BY pf.category, pf.sort_order, pf.display_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;