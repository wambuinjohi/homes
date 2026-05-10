import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/config/queryClient";
import { useMemo } from "react";

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

export interface ExpenseFilters {
  propertyId?: string;
  category?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
  expenseType?: string;
}

const fetchExpenses = async (filters?: ExpenseFilters): Promise<ExpenseWithDetails[]> => {
  let query = supabase
    .from("expenses")
    .select(`
      *,
      properties!fk_expenses_property_id(name),
      units!fk_expenses_unit_id(unit_number),
      tenants(first_name, last_name),
      meter_readings(meter_type, units_consumed, rate_per_unit)
    `);

  // Apply filters
  if (filters?.propertyId) {
    query = query.eq("property_id", filters.propertyId);
  }
  
  if (filters?.category) {
    query = query.eq("category", filters.category);
  }
  
  if (filters?.expenseType) {
    query = query.eq("expense_type", filters.expenseType);
  }
  
  if (filters?.dateRange) {
    query = query
      .gte("expense_date", filters.dateRange.from.toISOString().split('T')[0])
      .lte("expense_date", filters.dateRange.to.toISOString().split('T')[0]);
  }

  const { data, error } = await query.order("expense_date", { ascending: false });

  if (error) throw error;

  // Fallback to dummy data if no data
  if (!data || data.length === 0) {
    return getDummyExpenses();
  }

  return data as unknown as ExpenseWithDetails[];
};

// Optimized hook with React Query
export function useExpenseData(filters?: ExpenseFilters) {
  const query = useQuery({
    queryKey: queryKeys.expenses.list(filters),
    queryFn: () => fetchExpenses(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes for expense data
    select: (data) => data, // Data transformation can be added here
  });

  // Memoized summary calculation
  const summary = useMemo((): ExpenseSummary => {
    if (!query.data) {
      return {
        totalExpenses: 0,
        thisMonthExpenses: 0,
        expensesByProperty: {},
        expensesByCategory: {},
        expensesByType: {}
      };
    }

    const expenses = query.data;
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    const now = new Date();
    const thisMonthExpenses = expenses
      .filter(expense => {
        const expenseDate = new Date(expense.expense_date);
        return expenseDate.getMonth() === now.getMonth() && 
               expenseDate.getFullYear() === now.getFullYear();
      })
      .reduce((sum, expense) => sum + expense.amount, 0);

    const expensesByProperty = expenses.reduce((acc, expense) => {
      const propertyName = expense.properties?.name || 'Unknown';
      acc[propertyName] = (acc[propertyName] || 0) + expense.amount;
      return acc;
    }, {} as Record<string, number>);

    const expensesByCategory = expenses.reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
      return acc;
    }, {} as Record<string, number>);

    const expensesByType = expenses.reduce((acc, expense) => {
      acc[expense.expense_type] = (acc[expense.expense_type] || 0) + expense.amount;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalExpenses,
      thisMonthExpenses,
      expensesByProperty,
      expensesByCategory,
      expensesByType
    };
  }, [query.data]);

  return {
    expenses: query.data || [],
    summary,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// Hook for expense summary only (lighter query for dashboard)
export function useExpenseSummary(dateRange?: { from: Date; to: Date }) {
  const query = useQuery({
    queryKey: queryKeys.expenses.summary(dateRange),
    queryFn: async () => {
      let query = supabase
        .from("expenses")
        .select("amount, expense_date, category, expense_type, properties!fk_expenses_property_id(name)");

      if (dateRange) {
        query = query
          .gte("expense_date", dateRange.from.toISOString().split('T')[0])
          .lte("expense_date", dateRange.to.toISOString().split('T')[0]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes for summary data
  });

  // Memoized summary calculation
  const summary = useMemo((): ExpenseSummary => {
    if (!query.data) {
      return {
        totalExpenses: 0,
        thisMonthExpenses: 0,
        expensesByProperty: {},
        expensesByCategory: {},
        expensesByType: {}
      };
    }

    const expenses = query.data;
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    const now = new Date();
    const thisMonthExpenses = expenses
      .filter(expense => {
        const expenseDate = new Date(expense.expense_date);
        return expenseDate.getMonth() === now.getMonth() && 
               expenseDate.getFullYear() === now.getFullYear();
      })
      .reduce((sum, expense) => sum + expense.amount, 0);

    const expensesByProperty = expenses.reduce((acc, expense) => {
      const propertyName = (expense as any).properties?.name || 'Unknown';
      acc[propertyName] = (acc[propertyName] || 0) + expense.amount;
      return acc;
    }, {} as Record<string, number>);

    const expensesByCategory = expenses.reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
      return acc;
    }, {} as Record<string, number>);

    const expensesByType = expenses.reduce((acc, expense) => {
      acc[expense.expense_type] = (acc[expense.expense_type] || 0) + expense.amount;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalExpenses,
      thisMonthExpenses,
      expensesByProperty,
      expensesByCategory,
      expensesByType
    };
  }, [query.data]);

  return {
    summary,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// Dummy data function (unchanged)
function getDummyExpenses(): ExpenseWithDetails[] {
  return [
    {
      id: "1",
      property_id: "1",
      category: "Utilities",
      amount: 6375,
      expense_date: "2024-11-15",
      description: "Electricity usage: 255 units",
      expense_type: "metered",
      unit_id: "unit-1",
      created_at: "2024-11-15T10:00:00Z",
      properties: { name: "Sunset Gardens" },
      units: { unit_number: "A101" },
      meter_readings: {
        meter_type: "electricity",
        units_consumed: 255,
        rate_per_unit: 25.0
      }
    },
    {
      id: "2",
      property_id: "2",
      category: "Maintenance",
      amount: 15000,
      expense_date: "2024-11-10",
      description: "Plumbing repair in Unit B201",
      vendor_name: "Quick Fix Plumbers",
      expense_type: "one-time",
      created_at: "2024-11-10T14:30:00Z",
      properties: { name: "Green Valley" }
    },
    {
      id: "3",
      property_id: "1",
      category: "Insurance",
      amount: 25000,
      expense_date: "2024-11-01",
      description: "Property insurance premium",
      vendor_name: "Jubilee Insurance",
      expense_type: "recurring",
      is_recurring: true,
      recurrence_period: "yearly",
      created_at: "2024-11-01T09:00:00Z",
      properties: { name: "Sunset Gardens" }
    },
    {
      id: "4",
      property_id: "3",
      category: "Utilities",
      amount: 4200,
      expense_date: "2024-11-05",
      description: "Water usage: 140 units",
      expense_type: "metered",
      unit_id: "unit-3",
      created_at: "2024-11-05T12:00:00Z",
      properties: { name: "Palm Heights" },
      units: { unit_number: "C301" },
      meter_readings: {
        meter_type: "water",
        units_consumed: 140,
        rate_per_unit: 30.0
      }
    },
    {
      id: "5",
      property_id: "2",
      category: "Management",
      amount: 12000,
      expense_date: "2024-10-25",
      description: "Property management fee",
      vendor_name: "Zira Property Services",
      expense_type: "recurring",
      is_recurring: true,
      recurrence_period: "monthly",
      created_at: "2024-10-25T16:00:00Z",
      properties: { name: "Green Valley" }
    },
    {
      id: "6",
      property_id: "4",
      category: "Security",
      amount: 8500,
      expense_date: "2024-10-20",
      description: "Security services for October",
      vendor_name: "SecureGuard Ltd",
      expense_type: "recurring",
      is_recurring: true,
      recurrence_period: "monthly",
      created_at: "2024-10-20T11:00:00Z",
      properties: { name: "Ocean View" }
    }
  ];
}
