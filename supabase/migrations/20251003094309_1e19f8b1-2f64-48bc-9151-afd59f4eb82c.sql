-- Create helper RPC functions for tour management
CREATE OR REPLACE FUNCTION public.get_tour_status(p_user_id UUID, p_tour_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tour_status TEXT;
BEGIN
  SELECT status INTO tour_status
  FROM user_tour_progress
  WHERE user_id = p_user_id
    AND tour_name = p_tour_name;
  
  RETURN tour_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_feature_usage(p_user_id UUID, p_feature_name TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  usage_count INTEGER;
BEGIN
  SELECT usage_count INTO usage_count
  FROM user_feature_discovery
  WHERE user_id = p_user_id
    AND feature_name = p_feature_name;
  
  RETURN COALESCE(usage_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_feature_discovery(
  p_user_id UUID,
  p_feature_name TEXT,
  p_first_used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_usage_count INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_feature_discovery (user_id, feature_name, first_used_at, usage_count)
  VALUES (p_user_id, p_feature_name, p_first_used_at, p_usage_count)
  ON CONFLICT (user_id, feature_name)
  DO UPDATE SET
    first_used_at = COALESCE(EXCLUDED.first_used_at, user_feature_discovery.first_used_at),
    usage_count = EXCLUDED.usage_count,
    created_at = NOW();
END;
$$;