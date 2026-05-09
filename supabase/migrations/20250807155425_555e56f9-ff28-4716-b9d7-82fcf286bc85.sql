-- Remove duplicate payment record with same transaction_id and payment_reference
DELETE FROM payments 
WHERE id = 'f1239140-cacd-47e6-a6c3-8ef050e53b1a' 
AND transaction_id = 'TH70CQ9VBG' 
AND payment_reference = 'ws_CO_070820251842134723301507';