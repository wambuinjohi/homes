-- Add unique constraint on landlord_id to ensure one subscription per landlord
ALTER TABLE landlord_subscriptions 
ADD CONSTRAINT unique_landlord_subscription 
UNIQUE (landlord_id);

-- Add index for better performance on landlord_id lookups
CREATE INDEX IF NOT EXISTS idx_landlord_subscriptions_landlord_id 
ON landlord_subscriptions(landlord_id);