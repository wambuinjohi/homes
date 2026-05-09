import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { OptimizedTable } from './OptimizedTable';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer } from 'recharts';
import { getReportConfig } from '@/lib/reporting/config';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getReportData } from '@/lib/reporting/queries';
import { formatValue, formatValueCompact } from '@/lib/format';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ReportFilters, ReportData } from '@/lib/reporting/types';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Database } from 'lucide-react';

interface ReportRendererProps {
  reportId: string;
  filters: ReportFilters;
  className?: string;
  isPrintMode?: boolean;
  showCharts?: boolean; // Toggle for chart rendering performance
}

export const ReportRenderer = ({ reportId, filters, className, isPrintMode = false, showCharts = false }: ReportRendererProps) => {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const config = getReportConfig(reportId);

  useEffect(() => {
    const fetchData = async () => {
      if (!config) {
        setError('Report configuration not found');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        console.log(`Loading ${config.title} with live database data...`);
        const reportData = await getReportData(config.queryId, filters);
        setData(reportData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load report data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [reportId, filters, config]);

  if (!config) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Report configuration not found for ID: {reportId}</AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className={className}>
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Database className="h-4 w-4 animate-pulse" />
            <span>Loading live data from database...</span>
          </div>
          <LoadingSkeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <LoadingSkeleton key={i} className="h-24" />
            ))}
          </div>
          <LoadingSkeleton className="h-64" />
          <LoadingSkeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Error loading live data: {error}</AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return (
      <Alert className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>No data available for this report</AlertDescription>
      </Alert>
    );
  }

  // Check if report has data from the live database
  const hasData = Object.values(data.kpis).some(v => v > 0) || 
                  Object.values(data.charts).some(arr => Array.isArray(arr) && arr.length > 0) || 
                  (data.table && data.table.length > 0);

  if (!hasData) {
    const emptyStateMessages: Record<string, string> = {
      'rent-collection': 'No rent collection data found in your live database for the selected period. Check the Payments page to verify you have completed payments, then try "Last 12 Months" period.',
      'financial-summary': 'No income/expense data for the selected period. Try Last 12 Months or verify payments and expenses.',
      'property-performance': 'No property-level revenue/expense data. Add payments/expenses or expand period.',
      'profit-loss': 'No P&L data. Confirm revenue/expense entries exist in the period.',
      'expense-summary': 'No expenses found. Try a wider period or verify expense entries.',
      'cash-flow': 'No cash movement in selected period. Try Last 12 Months.',
      'executive-summary': 'No portfolio data available. Ensure properties, units, and transactions exist.'
    };

    const message = emptyStateMessages[reportId] || 'No data available for this report in the selected period.';

    return (
      <Alert className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    );
  }

  const sanitizeChartData = (raw: any[]): any[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((entry) => {
      if (entry == null || typeof entry !== 'object') return {};
      const out: any = {};
      Object.keys(entry).forEach((k) => {
        const v = (entry as any)[k];
        if (v == null) {
          out[k] = 0;
        } else if (typeof v === 'string') {
          // try to parse numbers encoded as strings
          const num = Number(v.replace(/,/g, ''));
          out[k] = Number.isFinite(num) ? num : v;
        } else {
          out[k] = v;
        }
      });
      return out;
    });
  };

  const renderChart = (chart: any) => {
    const rawData = data.charts[chart.id];
    const chartData = sanitizeChartData(rawData);
    if (!chartData || chartData.length === 0) return null;

    const commonProps = {
      width: '100%',
      height: isPrintMode ? 250 : 300,
      data: chartData
    };

    const wrap = (node: React.ReactNode) => (
      <ErrorBoundary level="component">{node}</ErrorBoundary>
    );

    switch (chart.type) {
      case 'line':
        return wrap(
          <ResponsiveContainer {...commonProps}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={chart.xKey} />
              <YAxis />
              <ChartTooltip />
              <Legend />
              {chart.yKeys?.map((key, index) => (
                <Line
                  key={String(key)}
                  type="monotone"
                  dataKey={key}
                  stroke={`hsl(${index * 60}, 70%, 50%)`}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer {...commonProps}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={chart.xKey} />
              <YAxis />
              <ChartTooltip />
              <Legend />
              {chart.yKeys?.map((key, index) => (
                <Bar
                  key={String(key)}
                  dataKey={key}
                  fill={`hsl(${index * 60}, 70%, 50%)`}
                  minPointSize={0}
                  barSize={20}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer {...commonProps}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={chart.xKey} />
              <YAxis />
              <ChartTooltip />
              <Legend />
              {chart.yKeys?.map((key, index) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stackId={chart.stacked ? "1" : key}
                  stroke={`hsl(${index * 60}, 70%, 50%)`}
                  fill={`hsl(${index * 60}, 70%, 50%)`}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
      case 'donut':
        return wrap(
          <ResponsiveContainer {...commonProps}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={chart.type === 'donut' ? 60 : 0}
                outerRadius={80}
                dataKey="value"
                nameKey="name"
              >
                 {chartData.map((entry: any, index: number) => (
                   <Cell key={`cell-${index}`} fill={entry.color || `hsl(${index * 60}, 70%, 50%)`} />
                 ))}
               </Pie>
               <ChartTooltip />
               <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return <div>Unsupported chart type: {chart.type}</div>;
    }
  };

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Header with live data indicator */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold text-foreground">{config.title}</h1>
            <Badge variant="outline" className="text-xs">
              <Database className="h-3 w-3 mr-1" />
              Live Data
            </Badge>
          </div>
          <p className="text-muted-foreground">{config.description}</p>
        </div>

        {/* KPIs - Compact spacing for Financial Summary */}
        <TooltipProvider>
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 ${reportId === 'financial-summary' ? 'gap-3' : 'gap-4'}`}>
            {config.kpis.map((kpi) => {
              const value = data.kpis[kpi.key] ?? 0;
              const fullValue = formatValue(value, kpi.format, kpi.decimals);
              const compactValue = formatValueCompact(value, kpi.format, kpi.decimals);
              const shouldUseCompact = fullValue.length > 12 || Math.abs(value) >= 10000;
              
              return (
                <Card key={kpi.key}>
                  <CardContent className={reportId === 'financial-summary' ? 'p-3' : 'p-4'}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="text-2xl font-bold text-foreground min-w-0 truncate">
                          {shouldUseCompact ? compactValue : fullValue}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{fullValue}</p>
                      </TooltipContent>
                    </Tooltip>
                    <div className="text-sm text-muted-foreground truncate">{kpi.label}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TooltipProvider>

        {/* Charts - only render when showCharts is enabled for performance */}
        {showCharts && config.charts.map((chart) => (
          <Card key={chart.id}>
            <CardHeader>
              <CardTitle>{chart.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {renderChart(chart)}
            </CardContent>
          </Card>
        ))}

        {/* Table */}
        {config.table && data.table && data.table.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Detailed Data</CardTitle>
            </CardHeader>
            <CardContent>
              <OptimizedTable
                columns={config.table.columns}
                data={data.table}
                pageSize={isPrintMode ? data.table.length : 50}
                maxDisplayRows={isPrintMode ? data.table.length : 100}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
