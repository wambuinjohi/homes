-- Helper function to get landlord rent total
CREATE OR REPLACE FUNCTION public.get_landlord_rent_total(
  p_landlord_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE
)
RETURNS NUMERIC AS $$
DECLARE
  total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total
  FROM public.payments
  WHERE landlord_id = p_landlord_id
    AND status = 'completed'
    AND payment_date >= p_start_date;
  
  RETURN total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;