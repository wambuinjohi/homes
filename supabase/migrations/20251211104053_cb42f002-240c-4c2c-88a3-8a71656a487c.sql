-- Fix invoice INV-2025-937522 that was incorrectly marked as 'paid' 
-- Payment of KES 10 was made for a KES 15 invoice

-- Create the missing payment allocation
INSERT INTO public.payment_allocations (payment_id, invoice_id, amount)
VALUES ('0b830e64-42d7-41f3-a899-fa3591815b7b', '1bc4ceec-e45b-4eaf-ac67-a10a0571b60f', 10.00)
ON CONFLICT DO NOTHING;

-- Note: The trigger update_invoice_status_on_allocation will automatically 
-- set the invoice status to 'partially_paid' based on the allocation amount