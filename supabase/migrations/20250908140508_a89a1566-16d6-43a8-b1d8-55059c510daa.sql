-- CRITICAL SECURITY FIX: Drop the vulnerable invoice_overview view
-- All application code now uses the secure get_invoice_overview() RPC function

-- Drop the publicly accessible view that was exposing sensitive financial data
DROP VIEW IF EXISTS public.invoice_overview;

-- Double-check that the secure RPC function exists and is properly protected
-- (The function already has proper RLS enforcement built-in)