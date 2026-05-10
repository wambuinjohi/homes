import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";

export interface ExpenseWithDetails {
  id: string;
  property_id: string;
  category: string;
  amount: number;
  expense_date: string;
  description: string;
  vendor_name?: string;
  expense_type: 'one-time' | 'metered' | 'recurring';
  tenant_id?: string;
  unit_id?: string;
  is_recurring?: boolean;
  recurrence_period?: string;
  meter_reading_id?: string;
  created_at: string;
  properties: {
    name: string;
  };
  units?: {
    unit_number: string;
  };
  tenants?: {
    first_name: string;
    last_name: string;
  };
  meter_readings?: {
    meter_type: string;
    units_consumed: number;
    rate_per_unit: number;
  };
}

export interface ExpenseSummary {
  totalExpenses: number;
  thisMonthExpenses: number;
  expensesByProperty: Record<string, number>;
  expensesByCategory: Record<string, number>;
  expensesByType: Record<string, number>;
}

export function useExpenseData() {
  const [expenses, setExpenses] = useState<ExpenseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("expenses")
      .select(`
          *,
          properties!fk_expenses_property_id(name),
          units!fk_expenses_unit_id(unit_number),
          tenants(first_name, last_name),
          meter_readings(meter_type, units_consumed, rate_per_unit)
        `)
        .order("expense_date", { ascending: false });

      if (fetchError) throw fetchError;

      setExpenses((data as any) || []);
    } catch (err: any) {
      // Log full Supabase error object when present
      try {
        if (err && typeof err === 'object') {
          console.error('Error fetching expenses (full):', JSON.stringify(err, null, 2));
        } else {
          console.error('Error fetching expenses:', err);
        }
      } catch (e) {
        console.error('Error fetching expenses (fallback):', err);
      }

      setError(err?.message || err?.msg || 'Failed to fetch expenses');
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  };

  const getExpenseSummary = (): ExpenseSummary => {
    const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

    const now = new Date();
    const thisMonthExpenses = expenses
      .filter(expense => {
        const expenseDate = new Date(expense.expense_date);
        return expenseDate.getMonth() === now.getMonth() && 
               expenseDate.getFullYear() === now.getFullYear();
      })
      .reduce((sum, expense) => sum + Number(expense.amount), 0);

    const expensesByProperty = expenses.reduce((acc, expense) => {
      const propertyName = expense.properties?.name || 'Unknown Property';
      acc[propertyName] = (acc[propertyName] || 0) + Number(expense.amount);
      return acc;
    }, {} as Record<string, number>);

    const expensesByCategory = expenses.reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + Number(expense.amount);
      return acc;
    }, {} as Record<string, number>);

    const expensesByType = expenses.reduce((acc, expense) => {
      acc[expense.expense_type] = (acc[expense.expense_type] || 0) + Number(expense.amount);
      return acc;
    }, {} as Record<string, number>);

    return {
      totalExpenses,
      thisMonthExpenses,
      expensesByProperty,
      expensesByCategory,
      expensesByType
    };
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  // Subscribe to real-time updates
  useRealtime({ 
    table: 'expenses', 
    onUpdate: fetchExpenses 
  });

  return {
    expenses,
    loading,
    error,
    summary: getExpenseSummary(),
    refetch: fetchExpenses
  };
}
