-- Fix rent collection report function with correct column names
CREATE OR REPLACE FUNCTION get_rent_collection_report(p_start_date date, p_end_date date)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
    total_collected_val numeric := 0;
    total_due_val numeric := 0;
    collection_rate_val numeric := 0;
    late_payments_val integer := 0;
    outstanding_val numeric := 0;
    chart_data json;
    table_data json;
BEGIN
    -- Calculate KPIs using actual invoice and payment data
    SELECT 
        COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.amount ELSE 0 END), 0) as total_collected,
        COALESCE(SUM(i.amount), 0) as total_due,
        COALESCE(SUM(CASE WHEN i.status IN ('overdue', 'pending') THEN i.amount ELSE 0 END), 0) as outstanding,
        COALESCE(COUNT(CASE WHEN i.status = 'overdue' THEN 1 END), 0) as late_payments
    INTO total_collected_val, total_due_val, outstanding_val, late_payments_val
    FROM invoices i
    LEFT JOIN leases l ON i.lease_id = l.id
    LEFT JOIN units u ON l.unit_id = u.id
    LEFT JOIN properties p ON u.property_id = p.id
    WHERE i.due_date BETWEEN p_start_date AND p_end_date
        AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin')); -- Fixed column name
    
    -- Calculate collection rate
    IF total_due_val > 0 THEN
        collection_rate_val := (total_collected_val / total_due_val) * 100;
    END IF;
    
    -- Generate monthly trend chart data
    SELECT json_agg(
        json_build_object(
            'month', TO_CHAR(month_series, 'Mon'),
            'collected', COALESCE(monthly_data.collected, 0),
            'expected', COALESCE(monthly_data.expected, 0)
        )
    ) INTO chart_data
    FROM (
        SELECT generate_series(
            date_trunc('month', p_start_date),
            date_trunc('month', p_end_date),
            '1 month'::interval
        ) AS month_series
    ) months
    LEFT JOIN (
        SELECT 
            date_trunc('month', i.due_date) as month,
            SUM(CASE WHEN i.status = 'paid' THEN i.amount ELSE 0 END) as collected,
            SUM(i.amount) as expected
        FROM invoices i
        LEFT JOIN leases l ON i.lease_id = l.id
        LEFT JOIN units u ON l.unit_id = u.id
        LEFT JOIN properties p ON u.property_id = p.id
        WHERE i.due_date BETWEEN p_start_date AND p_end_date
            AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'))
        GROUP BY date_trunc('month', i.due_date)
    ) monthly_data ON months.month_series = monthly_data.month
    ORDER BY months.month_series;
    
    -- Generate detailed table data
    SELECT json_agg(
        json_build_object(
            'property_name', p.name,
            'unit_number', u.unit_number,
            'tenant_name', COALESCE(t.first_name || ' ' || t.last_name, 'Unknown Tenant'),
            'amount_due', i.amount,
            'amount_paid', CASE WHEN i.status = 'paid' THEN i.amount ELSE 0 END,
            'payment_date', CASE WHEN i.status = 'paid' THEN i.created_at ELSE NULL END,
            'due_date', i.due_date,
            'status', i.status,
            'created_at', i.created_at
        )
    ) INTO table_data
    FROM invoices i
    LEFT JOIN leases l ON i.lease_id = l.id
    LEFT JOIN units u ON l.unit_id = u.id
    LEFT JOIN properties p ON u.property_id = p.id
    LEFT JOIN tenants t ON l.tenant_id = t.id
    WHERE i.due_date BETWEEN p_start_date AND p_end_date
        AND (p.owner_id = auth.uid() OR p.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin'))
    ORDER BY i.due_date DESC, p.name, u.unit_number;
    
    -- Build final result
    result := json_build_object(
        'kpis', json_build_object(
            'total_collected', total_collected_val,
            'collection_rate', collection_rate_val,
            'outstanding_amount', outstanding_val,
            'late_payments', late_payments_val
        ),
        'charts', json_build_object(
            'collection_trend', COALESCE(chart_data, '[]'::json),
            'payment_status', json_build_array(
                json_build_object('name', 'Paid', 'value', total_collected_val),
                json_build_object('name', 'Outstanding', 'value', outstanding_val),
                json_build_object('name', 'Overdue', 'value', 
                    (SELECT COALESCE(SUM(amount), 0) FROM invoices i2 
                     LEFT JOIN leases l2 ON i2.lease_id = l2.id
                     LEFT JOIN units u2 ON l2.unit_id = u2.id  
                     LEFT JOIN properties p2 ON u2.property_id = p2.id
                     WHERE i2.status = 'overdue' AND i2.due_date BETWEEN p_start_date AND p_end_date 
                       AND (p2.owner_id = auth.uid() OR p2.manager_id = auth.uid() OR has_role(auth.uid(), 'Admin')))
                )
            )
        ),
        'table', COALESCE(table_data, '[]'::json)
    );
    
    RETURN result;
END;
$$;