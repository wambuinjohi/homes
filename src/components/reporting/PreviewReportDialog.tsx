import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ReportRenderer } from './ReportRenderer';
import { ReportConfig, ReportFilters, PeriodPreset } from '@/lib/reporting/types';
import { Button } from '@/components/ui/button';
import { Download, X, Shield, ChevronDown, BarChart3 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { getReportData } from '@/lib/reporting/queries';
import { fmtDate, getNairobiDate, fmtCurrency } from '@/lib/format';
import { subMonths, subDays, startOfYear } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { MarketComparisonToggle } from '@/components/reports/MarketComparisonToggle';

interface PreviewReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportConfig: ReportConfig;
  onGeneratePDF?: (filters: ReportFilters) => void;
  isGenerating?: boolean;
}

const getPeriodDates = (preset: PeriodPreset): { startDate: string; endDate: string } => {
  const now = getNairobiDate();
  const today = fmtDate(now, 'yyyy-MM-dd');
  
  switch (preset) {
    case 'current_period':
      return {
        startDate: fmtDate(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd'),
        endDate: today
      };
    case 'last_12_months':
      return {
        startDate: fmtDate(subMonths(now, 12), 'yyyy-MM-dd'),
        endDate: today
      };
    case 'ytd':
      return {
        startDate: fmtDate(startOfYear(now), 'yyyy-MM-dd'),
        endDate: today
      };
    case 'last_6_months':
      return {
        startDate: fmtDate(subMonths(now, 6), 'yyyy-MM-dd'),
        endDate: today
      };
    case 'next_90_days':
      return {
        startDate: today,
        endDate: fmtDate(subDays(now, -90), 'yyyy-MM-dd')
      };
    case 'as_of_today':
      return {
        startDate: today,
        endDate: today
      };
    default:
      return {
        startDate: fmtDate(subMonths(now, 1), 'yyyy-MM-dd'),
        endDate: today
      };
  }
};

const periodLabels: Record<PeriodPreset, string> = {
  current_period: 'Current Period (This Month)',
  last_12_months: 'Last 12 Months',
  ytd: 'Year to Date',
  last_6_months: 'Last 6 Months',
  next_90_days: 'Next 90 Days',
  as_of_today: 'As of Today'
};

export const PreviewReportDialog = ({ 
  open, 
  onOpenChange, 
  reportConfig,
  onGeneratePDF,
  isGenerating = false
}: PreviewReportDialogProps) => {
  const [period, setPeriod] = useState<PeriodPreset>(reportConfig.defaultPeriod);
  const [comparisonMode, setComparisonMode] = useState<'portfolio' | 'market'>('portfolio');
  const [underlyingData, setUnderlyingData] = useState<{
    expenses: any[];
    revenue: any[];
  }>({ expenses: [], revenue: [] });
  const [showUnderlying, setShowUnderlying] = useState(false);
  const [showCharts, setShowCharts] = useState(false); // Charts off by default for performance
  const [includeKPIs, setIncludeKPIs] = useState(true); // Include KPIs by default
  const [kpiFitOneRow, setKpiFitOneRow] = useState(true); // Fit KPIs in one row by default
  const [tableOnlyPDF, setTableOnlyPDF] = useState(false); // Full PDF by default
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const filters: ReportFilters = {
    periodPreset: period,
    comparisonMode: comparisonMode,
    ...getPeriodDates(period)
  };

  // Cache report data with React Query for instant loading
  const { data: reportData, isLoading: reportLoading, error: reportError } = useQuery({
    queryKey: ['report-data', reportConfig.queryId, filters],
    queryFn: () => {
      console.time(`Report fetch: ${reportConfig.title}`);
      const result = getReportData(reportConfig.queryId, filters);
      result.finally(() => console.timeEnd(`Report fetch: ${reportConfig.title}`));
      return result;
    },
    enabled: open, // Only fetch when dialog is open
    placeholderData: (previousData) => previousData, // Smooth transitions between periods
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  const handleGeneratePDF = () => {
    const filtersWithOptions = { 
      ...filters, 
      tableOnly: tableOnlyPDF,
      includeKPIs,
      kpiFitOneRow
    };
    onGeneratePDF?.(filtersWithOptions);
  };

  const getPortfolioScope = () => {
    // For now, assume portfolio properties - we'll enhance this when auth context is available
    return 'Portfolio Properties (Owner/Manager)';
  };

  const getPeriodLabel = () => {
    const dates = getPeriodDates(period);
    return `${dates.startDate} to ${dates.endDate}`;
  };

  // Lazy-load underlying data only when expanded for performance
  useEffect(() => {
    if (!showUnderlying || !reportConfig || !['profit-loss', 'expense-summary'].includes(reportConfig.id)) {
      return;
    }

    // Cleanup previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const fetchUnderlyingData = async () => {
      const dates = getPeriodDates(period);
      
      try {
        const [expensesResult, revenueResult] = await Promise.all([
          supabase.rpc('get_pl_underlying_expenses', {
            p_start_date: dates.startDate,
            p_end_date: dates.endDate,
          }),
          supabase.rpc('get_pl_underlying_revenue', {
            p_start_date: dates.startDate,
            p_end_date: dates.endDate,
          }),
        ]);

        // Only set data if request wasn't aborted
        if (!controller.signal.aborted) {
          setUnderlyingData({
            expenses: Array.isArray(expensesResult.data) ? expensesResult.data.slice(0, 20) : [], // Limit to 20 rows
            revenue: Array.isArray(revenueResult.data) ? revenueResult.data.slice(0, 20) : [], // Limit to 20 rows
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Failed to fetch underlying data:', error);
          setUnderlyingData({ expenses: [], revenue: [] });
        }
      }
    };

    fetchUnderlyingData();

    // Cleanup on unmount or dependency change
    return () => {
      controller.abort();
    };
  }, [showUnderlying, reportConfig, period]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-auto">
        <DialogHeader className="flex flex-col space-y-4">
          <div className="flex flex-row items-center justify-between">
            <DialogTitle className="flex-1">{reportConfig.title} - Preview</DialogTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="period-select" className="text-sm font-medium">
                  Period:
                </Label>
                <Select value={period} onValueChange={(value) => setPeriod(value as PeriodPreset)}>
                  <SelectTrigger id="period-select" className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(periodLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Market Comparison Toggle - Only for Market Rent Analysis */}
              {reportConfig.id === 'market-rent' && (
                <div className="col-span-full">
                  <MarketComparisonToggle
                    comparisonMode={comparisonMode}
                    onModeChange={setComparisonMode}
                    sampleSize={reportData?.kpis?.total_sample_size}
                    unitTypes={reportData?.kpis?.unit_types_analyzed}
                    locations={reportData?.kpis?.locations_analyzed}
                  />
                </div>
              )}
              
              {/* Charts Toggle for Performance */}
              <div className="flex items-center gap-2">
                <Switch 
                  id="show-charts" 
                  checked={showCharts} 
                  onCheckedChange={setShowCharts}
                />
                <Label htmlFor="show-charts" className="text-sm text-muted-foreground cursor-pointer">
                  <BarChart3 className="h-4 w-4 inline mr-1" />
                  Charts {showCharts ? '(slower)' : '(faster)'}
                </Label>
              </div>
              
              {/* Include KPIs Toggle */}
              <div className="flex items-center gap-2">
                <Switch 
                  id="include-kpis" 
                  checked={includeKPIs} 
                  onCheckedChange={setIncludeKPIs}
                />
                <Label htmlFor="include-kpis" className="text-sm text-muted-foreground cursor-pointer">
                  📊 Include KPIs
                </Label>
              </div>

              {/* KPI One Row Toggle */}
              {includeKPIs && (
                <div className="flex items-center gap-2">
                  <Switch 
                    id="kpi-one-row" 
                    checked={kpiFitOneRow} 
                    onCheckedChange={setKpiFitOneRow}
                  />
                  <Label htmlFor="kpi-one-row" className="text-sm text-muted-foreground cursor-pointer">
                    ↔️ Compact KPIs
                  </Label>
                </div>
              )}
              
              {/* Table-only PDF Toggle */}
              <div className="flex items-center gap-2">
                <Switch 
                  id="table-only-pdf" 
                  checked={tableOnlyPDF} 
                  onCheckedChange={setTableOnlyPDF}
                />
                <Label htmlFor="table-only-pdf" className="text-sm text-muted-foreground cursor-pointer">
                  📋 Table-only PDF
                </Label>
              </div>
              
              {onGeneratePDF && (
                <Button
                  onClick={handleGeneratePDF}
                  disabled={isGenerating}
                  size="sm"
                  className="gap-2 bg-primary hover:bg-primary/90"
                >
                  {isGenerating ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Generate PDF
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Report Metadata */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
            <Badge variant="outline" className="gap-1">
              <Shield className="h-3 w-3" />
              {getPortfolioScope()}
            </Badge>
            <span>•</span>
            <span>Period: {getPeriodLabel()}</span>
            <span>•</span>
            <span>Generated: {fmtDate(new Date(), 'PPp')}</span>
          </div>
        </DialogHeader>
        
        <div className="mt-4 space-y-4">
          <ReportRenderer 
            reportId={reportConfig.id} 
            filters={filters}
            className="space-y-6"
            showCharts={showCharts}
          />
          
          {/* Quick diagnostic for rent collection */}
          {reportConfig.id === 'rent-collection' && (
            <div className="text-sm text-muted-foreground bg-muted/20 p-3 rounded border-l-4 border-primary/30">
              <strong>Tip:</strong> If you're seeing zero values, try switching to "Last 12 Months" period 
              or ensure you have properties with invoices and payments in the selected timeframe.
            </div>
          )}

          {/* Underlying Data for P&L and Expense Summary */}
          {['profit-loss', 'expense-summary'].includes(reportConfig.id) && (
            <Collapsible open={showUnderlying} onOpenChange={setShowUnderlying}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  View Underlying Data
                  <ChevronDown className={`h-4 w-4 transition-transform ${showUnderlying ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 mt-4">
                {underlyingData.revenue.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Revenue Details (Top 20)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Tenant</TableHead>
                            <TableHead>Property</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Invoice #</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {underlyingData.revenue.map((item: any, index: number) => (
                            <TableRow key={`${item.id}-${index}`}>
                              <TableCell>{fmtDate(item.payment_date)}</TableCell>
                              <TableCell>{fmtCurrency(item.amount)}</TableCell>
                              <TableCell>{item.tenant_name}</TableCell>
                              <TableCell>{item.property_name}</TableCell>
                              <TableCell>{item.payment_method || 'N/A'}</TableCell>
                              <TableCell>{item.invoice_number || 'N/A'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {underlyingData.expenses.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Expense Details (Top 20)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Vendor</TableHead>
                            <TableHead>Property</TableHead>
                            <TableHead>Created By</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {underlyingData.expenses.map((item: any, index: number) => (
                            <TableRow key={`${item.id}-${index}`}>
                              <TableCell>{fmtDate(item.expense_date)}</TableCell>
                              <TableCell>{fmtCurrency(item.amount)}</TableCell>
                              <TableCell>{item.category}</TableCell>
                              <TableCell>{item.description}</TableCell>
                              <TableCell>{item.vendor_name || 'N/A'}</TableCell>
                              <TableCell>{item.property_name}</TableCell>
                              <TableCell>{item.created_by}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {underlyingData.expenses.length === 0 && underlyingData.revenue.length === 0 && (
                  <Card>
                    <CardContent className="text-center text-muted-foreground py-8">
                      No underlying data available for the selected period.
                    </CardContent>
                  </Card>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};