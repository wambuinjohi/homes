import { formatAmount } from '@/utils/currency';

// Helper functions for the ReportViewModal
export const getReportSummary = (data: any, reportType: string): string => {
  // Normalize to use nested summary when present
  const d = data?.summary ? data.summary : data;
  switch (reportType) {
    case 'rent-collection':
      return `This report provides a comprehensive analysis of rent collection performance across all properties. Current collection rate stands at ${d?.collectionRate?.toFixed(1) || '0'}% with total collected amount of ${formatAmount(d?.totalCollected || 0)}.`;
    
    case 'occupancy':
      return `Property occupancy analysis shows current occupancy rate of ${d?.occupancyRate?.toFixed(0) || '0'}% across ${d?.totalUnits || 0} units in ${d?.totalProperties || 0} properties.`;
    
    case 'outstanding-balances':
      return `Outstanding balances report reveals total overdue amount of ${formatAmount(d?.totalOutstanding || 0)} across ${d?.overdueCount || 0} accounts requiring attention.`;
    
    case 'property-performance':
      return `Property performance analysis covering ${d?.totalProperties || 0} properties with total revenue of ${formatAmount(d?.totalRevenue || 0)} and net income of ${formatAmount(d?.netIncome || 0)}.`;
    
    case 'profit-loss':
      return `Profit & Loss statement shows total revenue of ${formatAmount(d?.totalRevenue || 0)}, expenses of ${formatAmount(d?.totalExpenses || 0)}, resulting in net profit of ${formatAmount((d?.totalRevenue || 0) - (d?.totalExpenses || 0))}.`;
    
    case 'cash-flow':
      return `Cash flow analysis indicates cash inflow of ${formatAmount(d?.cashInflow || 0)}, outflow of ${formatAmount(d?.cashOutflow || 0)}, with net cash flow of ${formatAmount(d?.netCashFlow || 0)}.`;
    
    case 'maintenance':
      return `Maintenance report covers ${d?.totalRequests || 0} requests with total cost of ${formatAmount(d?.totalCost || 0)}. Completion rate is ${d?.completionRate?.toFixed(1) || '0'}%.`;
    
    case 'executive-summary':
      return `Executive summary provides comprehensive portfolio overview across all key metrics.`;
    
    case 'revenue-vs-expenses':
      return `Revenue vs Expenses analysis shows total revenue of ${formatAmount(d?.totalRevenue || 0)} against expenses of ${formatAmount(d?.totalExpenses || 0)}, maintaining expense ratio of ${d?.expenseRatio?.toFixed(1) || '0'}%.`;
    
    default:
      return "This report provides detailed analysis of the selected metrics and data points for the specified time period.";
  }
};

export const formatKPIValue = (value: any, format?: string): string => {
  if (value === null || value === undefined) return '0';
  
  switch (format) {
    case 'currency':
      return formatAmount(Number(value));
    case 'percentage':
      return `${Number(value).toFixed(1)}%`;
    case 'number':
      return Number(value).toLocaleString();
    default:
      if (typeof value === 'number') {
        // Auto-detect format based on value
        if (value > 1000) {
          return formatAmount(value);
        } else if (value <= 100) {
          return `${value.toFixed(1)}%`;
        }
        return value.toLocaleString();
      }
      return String(value);
  }
};
