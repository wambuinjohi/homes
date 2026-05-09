-- Create table to track processed Kopo Kopo callbacks for idempotency
CREATE TABLE IF NOT EXISTS kopokopo_processed_callbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kopo_reference TEXT NOT NULL,
  incoming_payment_id TEXT,
  invoice_id UUID REFERENCES invoices(id),
  amount NUMERIC,
  phone_number TEXT,
  processed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(kopo_reference)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_kopokopo_callbacks_reference ON kopokopo_processed_callbacks(kopo_reference);

-- Create SMS automation settings table
CREATE TABLE IF NOT EXISTS sms_automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  automation_key TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  template TEXT,
  timing_days_before INT,
  audience_type TEXT DEFAULT 'all_tenants',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(landlord_id, automation_key)
);

-- Allow null landlord_id for global defaults
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_automation_global ON sms_automation_settings(automation_key) WHERE landlord_id IS NULL;

-- Enable RLS
ALTER TABLE kopokopo_processed_callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_automation_settings ENABLE ROW LEVEL SECURITY;

-- Policies for kopokopo_processed_callbacks (service role only for callbacks)
CREATE POLICY "Service role can manage kopokopo callbacks" 
ON kopokopo_processed_callbacks 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Policies for sms_automation_settings - allow landlords to manage their settings
CREATE POLICY "Users can view global and own SMS settings" 
ON sms_automation_settings 
FOR SELECT 
USING (landlord_id = auth.uid() OR landlord_id IS NULL);

CREATE POLICY "Users can insert their own SMS settings" 
ON sms_automation_settings 
FOR INSERT 
WITH CHECK (landlord_id = auth.uid());

CREATE POLICY "Users can update their own SMS settings" 
ON sms_automation_settings 
FOR UPDATE 
USING (landlord_id = auth.uid());

CREATE POLICY "Users can delete their own SMS settings" 
ON sms_automation_settings 
FOR DELETE 
USING (landlord_id = auth.uid());

-- Seed default global SMS automation settings
INSERT INTO sms_automation_settings (landlord_id, automation_key, enabled, template) VALUES
  (NULL, 'payment_receipt', true, 'Payment of KES {amount} received. Thank you! Receipt: {receipt}'),
  (NULL, 'invoice_reminder', true, 'Reminder: Your rent of KES {amount} is due on {due_date}. Please pay promptly.'),
  (NULL, 'lease_expiry', true, 'Your lease expires on {expiry_date}. Please contact us for renewal.'),
  (NULL, 'overdue_notice', true, 'Your rent payment of KES {amount} is overdue. Please pay immediately to avoid penalties.')
ON CONFLICT DO NOTHING;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_sms_automation_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sms_automation_settings_updated_at ON sms_automation_settings;
CREATE TRIGGER trigger_sms_automation_settings_updated_at
BEFORE UPDATE ON sms_automation_settings
FOR EACH ROW
EXECUTE FUNCTION update_sms_automation_settings_updated_at();