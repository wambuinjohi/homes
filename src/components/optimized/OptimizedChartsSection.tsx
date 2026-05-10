import React, { memo, useMemo } from "react";
import { getCurrencySymbol } from "@/utils/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from "recharts";
import { ChartDataPoint } from "@/hooks/optimized/useDashboardStats";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface OptimizedChartsSectionProps {
  chartData?: ChartDataPoint[];
  isLoading: boolean;
}

const LoadingSkeleton = memo(() => (
  <div className="h-80 w-full bg-muted/20 rounded animate-pulse flex items-center justify-center">
    <div className="text-muted-foreground">Loading chart data...</div>
  </div>
));

LoadingSkeleton.displayName = "LoadingSkeleton";

const RevenueExpenseChart = memo(({ data }: { data: ChartDataPoint[] }) => {
  const chartColors = useMemo(() => ({
    revenue: "hsl(var(--card-green))",
    expenses: "hsl(var(--card-red))",
    profit: "hsl(var(--card-blue))"
  }), []);

  const formatCurrency = useMemo(() => (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${Math.round(value / 1000)}K`;
    } else {
      return value.toLocaleString();
    }
  }, []);

  // Defensive copy of incoming data to ensure numbers for Recharts
  const safeData = useMemo(() => (data || []).map(d => ({
    ...(d as any),
    revenue: Number((d as any).revenue) || 0,
    expenses: Number((d as any).expenses) || 0,
    profit: Number((d as any).profit) || 0,
    month: (d as any).month || ''
  })), [data]);

  const CustomTooltip = memo(({ active, payload, label }: any) => {
    try {
      if (active && payload && payload.length) {
        return (
          <div className="bg-card border rounded-lg shadow-lg p-3">
            <p className="font-medium text-card-foreground">{`Month: ${label}`}</p>
            {payload.map((entry: any, index: number) => (
              <p key={index} style={{ color: entry.color }} className="text-sm">
                {`${entry.dataKey}: ${getCurrencySymbol()} ${formatCurrency(Number(entry?.value) || 0)}`}
              </p>
            ))}
          </div>
        );
      }
    } catch (e) {
      console.error('CustomTooltip render error', e);
    }
    return null;
  });

  CustomTooltip.displayName = "CustomTooltip";

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={safeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis 
          dataKey="month" 
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
        />
        <YAxis 
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickFormatter={formatCurrency}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar
          dataKey="revenue"
          fill={chartColors.revenue}
          name="Revenue"
          radius={[2, 2, 0, 0]}
          minPointSize={0}
          barSize={20}
        />
        <Bar
          dataKey="expenses"
          fill={chartColors.expenses}
          name="Expenses"
          radius={[2, 2, 0, 0]}
          minPointSize={0}
          barSize={20}
        />
      </BarChart>
    </ResponsiveContainer>
  );
});

RevenueExpenseChart.displayName = "RevenueExpenseChart";

const ProfitTrendChart = memo(({ data }: { data: ChartDataPoint[] }) => {
  const chartColor = useMemo(() => "hsl(var(--card-blue))", []);

  const formatCurrency = useMemo(() => (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${Math.round(value / 1000)}K`;
    } else {
      return value.toLocaleString();
    }
  }, []);

  const safeData = useMemo(() => (data || []).map(d => ({
    ...(d as any),
    revenue: Number((d as any).revenue) || 0,
    expenses: Number((d as any).expenses) || 0,
    profit: Number((d as any).profit) || 0,
    month: (d as any).month || ''
  })), [data]);

  const CustomTooltip = memo(({ active, payload, label }: any) => {
    try {
      if (active && payload && payload.length) {
        const val = Number(payload?.[0]?.value) || 0;
        return (
          <div className="bg-card border rounded-lg shadow-lg p-3">
            <p className="font-medium text-card-foreground">{`Month: ${label}`}</p>
            <p style={{ color: chartColor }} className="text-sm">
              {`Profit: ${getCurrencySymbol()} ${formatCurrency(val)}`}
            </p>
          </div>
        );
      }
    } catch (e) {
      console.error('CustomTooltip render error', e);
    }
    return null;
  });

  CustomTooltip.displayName = "CustomTooltip";

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={safeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis 
          dataKey="month" 
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
        />
        <YAxis 
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickFormatter={formatCurrency}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Line
          type="monotone"
          dataKey="profit"
          stroke={chartColor}
          strokeWidth={3}
          dot={typeof chartColor === 'string' ? { fill: chartColor, strokeWidth: 2, r: 4 } : false}
          name="Profit"
        />
      </LineChart>
    </ResponsiveContainer>
  );
});

ProfitTrendChart.displayName = "ProfitTrendChart";

export const OptimizedChartsSection = memo(({ chartData, isLoading }: OptimizedChartsSectionProps) => {
  const hasData = useMemo(() => chartData && chartData.length > 0, [chartData]);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <LoadingSkeleton />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Profit Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <LoadingSkeleton />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              No financial data available
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Profit Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              No profit data available
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Revenue vs Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorBoundary level="component">
            <RevenueExpenseChart data={chartData} />
          </ErrorBoundary>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Profit Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorBoundary level="component">
            <ProfitTrendChart data={chartData} />
          </ErrorBoundary>
        </CardContent>
      </Card>
    </div>
  );
});

OptimizedChartsSection.displayName = "OptimizedChartsSection";
