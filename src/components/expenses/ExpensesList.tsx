import { Badge } from "@/components/ui/badge";
import { formatAmount } from "@/utils/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExpenseWithDetails } from "@/hooks/useExpenseData";
import { format } from "date-fns";
import { Eye, DollarSign, Zap, Calendar, RotateCcw } from "lucide-react";
import { TablePaginator } from "@/components/ui/table-paginator";
import { useState } from "react";

interface ExpensesListProps {
  expenses: ExpenseWithDetails[];
  loading: boolean;
}

export function ExpensesList({ expenses, loading }: ExpensesListProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Expense Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Loading expenses...</div>
        </CardContent>
      </Card>
    );
  }

  if (expenses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Expense Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No expenses found
          </div>
        </CardContent>
      </Card>
    );
  }

  const getExpenseTypeIcon = (type: string) => {
    switch (type) {
      case "metered":
        return <Zap className="h-4 w-4" />;
      case "recurring":
        return <RotateCcw className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  const getExpenseTypeBadge = (expense: ExpenseWithDetails) => {
    const variants = {
      "one-time": "default",
      "metered": "secondary", 
      "recurring": "outline"
    } as const;

    return (
      <Badge variant={variants[expense.expense_type]} className="text-xs">
        {getExpenseTypeIcon(expense.expense_type)}
        <span className="ml-1 capitalize">{expense.expense_type}</span>
      </Badge>
    );
  };

  const getRecurrenceBadge = (period?: string) => {
    if (!period) return null;
    return (
      <Badge variant="outline" className="text-xs">
        <Calendar className="h-3 w-3 mr-1" />
        {period}
      </Badge>
    );
  };

  // Pagination logic
  const totalPages = Math.ceil(expenses.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedExpenses = expenses.slice(startIndex, startIndex + pageSize);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expense Ledger (Latest First)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {paginatedExpenses.map((expense) => (
            <div 
              key={expense.id} 
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center space-x-4 flex-1">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium">{expense.description}</h3>
                    {getExpenseTypeBadge(expense)}
                    {expense.is_recurring && getRecurrenceBadge(expense.recurrence_period)}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{expense.properties.name}</span>
                    <span>•</span>
                    <span>{expense.category}</span>
                    {expense.units && (
                      <>
                        <span>•</span>
                        <span>Unit {expense.units.unit_number}</span>
                      </>
                    )}
                    {expense.tenants && (
                      <>
                        <span>•</span>
                        <span>{expense.tenants.first_name} {expense.tenants.last_name}</span>
                      </>
                    )}
                  </div>

                  {expense.vendor_name && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Vendor: {expense.vendor_name}
                    </p>
                  )}

                  {expense.meter_readings && (
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-4">
                      <span>
                        {expense.meter_readings.meter_type}: {expense.meter_readings.units_consumed} units
                      </span>
                      <span>
                        @ {formatAmount(expense.meter_readings.rate_per_unit)}/unit
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-lg font-semibold">
                    {formatAmount(expense.amount)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(expense.expense_date), "MMM dd, yyyy")}
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        <TablePaginator
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={expenses.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          showPageSizeSelector={true}
        />
      </CardContent>
    </Card>
  );
}