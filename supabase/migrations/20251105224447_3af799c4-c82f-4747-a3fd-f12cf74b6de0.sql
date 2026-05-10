-- Phase 1: Fix critical RLS policies for M-Pesa tables

-- =====================================================
-- 1. Secure landlord_mpesa_configs table
-- =====================================================

-- Enable RLS on landlord_mpesa_configs
ALTER TABLE landlord_mpesa_configs ENABLE ROW LEVEL SECURITY;

-- Allow landlords to manage their own M-Pesa configurations
CREATE POLICY "landlords_manage_own_mpesa_config"
ON landlord_mpesa_configs FOR ALL
USING (
  landlord_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role)
)
WITH CHECK (
  landlord_id = auth.uid() OR has_role(auth.uid(), 'Admin'::app_role)
);

-- =====================================================
-- 2. Secure mpesa_transactions table
-- =====================================================

-- Drop dangerous overly permissive policies
DROP POLICY IF EXISTS "mpesa_transactions_all_authenticated" ON mpesa_transactions;
DROP POLICY IF EXISTS "mpesa_transactions_insert_anon" ON mpesa_transactions;

-- Keep the existing safe policy for users viewing their own transactions
-- (This policy already exists: "Users can view their own mpesa transactions")

-- Add policy for edge functions to create transactions (using service role)
CREATE POLICY "edge_functions_create_transactions"
ON mpesa_transactions FOR INSERT
WITH CHECK (true);

-- Add policy for admins to manage all transactions
CREATE POLICY "admins_manage_all_transactions"
ON mpesa_transactions FOR ALL
USING (has_role(auth.uid(), 'Admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'Admin'::app_role));

-- Add policy for users to update their own initiated transactions (for status tracking)
CREATE POLICY "users_update_own_transactions"
ON mpesa_transactions FOR UPDATE
USING (
  initiated_by = auth.uid() OR 
  authorized_by = auth.uid() OR 
  has_role(auth.uid(), 'Admin'::app_role)
)
WITH CHECK (
  initiated_by = auth.uid() OR 
  authorized_by = auth.uid() OR 
  has_role(auth.uid(), 'Admin'::app_role)
);