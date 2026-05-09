import { useState, useEffect } from "react";
import { formatAmount } from "@/utils/currency";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useExpenseData } from "@/hooks/useExpenseData";
import { AddExpenseDialog } from "@/components/expenses/AddExpenseDialog";
import { ExpensesList } from "@/components/expenses/ExpensesList";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, DollarSign, TrendingDown, Calendar, Zap, RotateCcw, PieChart } from "lucide-react";
import { KpiGrid } from "@/components/kpi/KpiGrid";
import { KpiStatCard } from "@/components/kpi/KpiStatCard";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { FeatureGate } from "@/components/ui/feature-gate";
import { DisabledActionWrapper } from "@/components/feature-access/DisabledActionWrapper";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";

interface Property {
  id: string;
  name: string;
}

const Expenses = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("last_12_months");
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const { expenses, loading, summary, refetch, error: fetchError } = useExpenseData();

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name");

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error("Error fetching properties:", error);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  if (loading && !expenses.length) {
    return (
      <DashboardLayout>
        <div className="bg-tint-gray p-6">
          <Card>
            <CardHeader>
              <CardTitle>Expense Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">Loading expenses...</div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Surface fetch errors prominently so we can see RLS/permission failures
  // (Error handling is done in the individual queries)

  const getPeriodDates = (period: string) => {
    const now = new Date();
    const today = new Date();
    
    switch (period) {
      case 'current_month':
        return {
          start: new Date(now.getFullYear(), now.getMonth(), 1),
          end: today
        };
      case 'last_12_months':
        return {
          start: new Date(now.getFullYear() - 1, now.getMonth(), 1),
          end: today
        };
      case 'ytd':
        return {
          start: new Date(now.getFullYear(), 0, 1),
          end: today
        };
      default:
        return {
          start: new Date(now.getFullYear() - 1, now.getMonth(), 1),
          end: today
        };
    }
  };

  const { start: periodStart, end: periodEnd } = getPeriodDates(periodFilter);

  const getFilteredExpensesByPeriod = (filterPeriod?: string) => {
    const period = filterPeriod || periodFilter;
    const { start, end } = getPeriodDates(period);
    
    return expenses.filter(expense => {
      const expenseDate = new Date(expense.expense_date);
      return expenseDate >= start && expenseDate <= end;
    });
  };

  const periodExpenses = getFilteredExpensesByPeriod();
  const currentMonthExpenses = getFilteredExpensesByPeriod('current_month');
  
  const periodTotalExpenses = periodExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const currentMonthTotalExpenses = currentMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = 
      expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.properties.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (expense.vendor_name && expense.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = categoryFilter === "all" || expense.category === categoryFilter;
    const matchesType = typeFilter === "all" || expense.expense_type === typeFilter;
    
    return matchesSearch && matchesCategory && matchesType;
  });

  const categories = [
    "Maintenance", "Utilities", "Insurance", "Management", 
    "Legal", "Marketing", "Security", "Landscaping", "Cleaning", "Other"
  ];

  const expenseTypes = [
    { value: "one-time", label: "One-time", icon: DollarSign },
    { value: "metered", label: "Metered", icon: Zap },
    { value: "recurring", label: "Recurring", icon: RotateCcw }
  ];

  return (
    <DashboardLayout>
      <FeatureGate
        feature={FEATURES.EXPENSE_TRACKING}
        fallbackTitle="Expense Tracking"
        fallbackDescription="Track and manage expenses across your properties with detailed categorization."
        showUpgradePrompt={true}
      >
        <div className="bg-tint-gray p-6 space-y-8">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-primary">Expense Management</h1>
              <p className="text-muted-foreground">
                Track one-time expenses, metered utilities, and recurring costs
              </p>
            </div>
            
            <DisabledActionWrapper
              feature={FEATURES.EXPENSE_TRACKING}
              fallbackTitle="Expense Tracking Required"
              fallbackDescription="Upgrade to add expenses"
            >
              <Button 
                onClick={() => setDialogOpen(true)}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>
            </DisabledActionWrapper>
          </div>

        {/* If fetching expenses failed, show error only in non-production for safety */}
        {fetchError && process.env.NODE_ENV !== 'production' && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Failed to load expenses</AlertTitle>
            <AlertDescription>
              {typeof fetchError === 'string' ? fetchError : JSON.stringify(fetchError)}
            </AlertDescription>
          </Alert>
        )}

        {/* Period Filter & Summary Cards */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="expense-period-filter" className="text-sm font-medium">Period:</Label>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger id="expense-period-filter" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current_month">Current Month</SelectItem>
                <SelectItem value="last_12_months">Last 12 Months</SelectItem>
                <SelectItem value="ytd">Year to Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <KpiGrid>
          <KpiStatCard
            title="Total Expenses (All Time)"
            value={formatAmount(summary.totalExpenses)}
            subtitle="All time expenses"
            icon={TrendingDown}
            gradient="card-gradient-red"
            isLoading={loading}
          />
          <KpiStatCard
            title={periodFilter === 'current_month' ? 'This Month' : 
                   periodFilter === 'ytd' ? 'Year to Date' : 'Last 12 Months'}
            value={formatAmount(periodTotalExpenses)}
            subtitle="Period expenses"
            icon={Calendar}
            gradient="card-gradient-orange"
            isLoading={loading}
          />
          <KpiStatCard
            title="This Month"
            value={formatAmount(currentMonthTotalExpenses)}
            subtitle="Current month expenses"
            icon={Calendar}
            gradient="card-gradient-blue"
            isLoading={loading}
          />
          <KpiStatCard
            title="Total Records"
            value={expenses.length}
            subtitle="Expense records"
            icon={PieChart}
            gradient="card-gradient-navy"
            isLoading={loading}
          />
        </KpiGrid>

        {/* Analytics Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Expenses by Property</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(summary.expensesByProperty).map(([property, amount]) => (
                  <div key={property} className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                    <span className="text-sm font-medium">{property}</span>
                    <span className="text-sm font-semibold">KES {amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expenses by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(summary.expensesByCategory).map(([category, amount]) => {
                  if (amount === 0) return null;
                  return (
                    <div key={category} className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                      <span className="text-sm font-medium">{category}</span>
                      <span className="text-sm font-semibold">KES {amount.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expenses by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {expenseTypes.map(type => {
                  const amount = summary.expensesByType[type.value] || 0;
                  if (amount === 0) return null;
                  
                  const Icon = type.icon;
                  return (
                    <div key={type.value} className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{type.label}</span>
                      </div>
                      <span className="text-sm font-semibold">KES {amount.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search expenses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {expenseTypes.map(type => (
                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Expenses List */}
        <ExpensesList expenses={filteredExpenses} loading={loading} />

        {/* Add Expense Dialog */}
          <AddExpenseDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            properties={properties}
            onSuccess={refetch}
          />
        </div>
      </FeatureGate>
    </DashboardLayout>
  );
};

export default Expenses;
