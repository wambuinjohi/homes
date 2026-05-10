-- Create function to initialize SMS credits from billing plan
CREATE OR REPLACE FUNCTION initialize_landlord_sms_credits()
RETURNS TRIGGER AS $$
DECLARE
  v_sms_credits INTEGER;
BEGIN
  -- Only proceed if billing_plan_id is being set or changed
  IF NEW.billing_plan_id IS NOT NULL AND 
     (TG_OP = 'INSERT' OR OLD.billing_plan_id IS DISTINCT FROM NEW.billing_plan_id) THEN
    
    -- Get SMS credits from billing plan
    SELECT COALESCE(sms_credits_included, 100) INTO v_sms_credits
    FROM billing_plans
    WHERE id = NEW.billing_plan_id;
    
    -- Initialize credits if not already set or if plan changed
    IF TG_OP = 'INSERT' OR OLD.billing_plan_id IS DISTINCT FROM NEW.billing_plan_id THEN
      NEW.sms_credits_balance := v_sms_credits;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on landlord_subscriptions
DROP TRIGGER IF EXISTS trigger_initialize_sms_credits ON landlord_subscriptions;
CREATE TRIGGER trigger_initialize_sms_credits
BEFORE INSERT OR UPDATE OF billing_plan_id ON landlord_subscriptions
FOR EACH ROW
EXECUTE FUNCTION initialize_landlord_sms_credits();

-- Backfill existing landlords who don't have credits
UPDATE landlord_subscriptions ls
SET sms_credits_balance = COALESCE(
  (SELECT sms_credits_included FROM billing_plans WHERE id = ls.billing_plan_id),
  100
)
WHERE sms_credits_balance = 0 OR sms_credits_balance IS NULL;

-- Add comment for documentation
COMMENT ON FUNCTION initialize_landlord_sms_credits() IS 'Automatically initializes SMS credits from billing plan when landlord subscribes or changes plan';
