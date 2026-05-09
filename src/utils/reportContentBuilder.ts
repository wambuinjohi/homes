import { getReportTransformer } from '@/utils/reportDataTransformers';
import { ReportChartDataService } from '@/utils/reportChartDataService';
import { formatKPIValue, getReportSummary as modalSummaryHelper } from '@/utils/reportModalHelpers';
import { reportConfigs } from '@/lib/reporting/config';

export interface UnifiedReportContent {
  period: string;
  summary: string;
  kpis: Array<{ label: string; value: string; trend?: 'up' | 'down' | 'stable'; change?: string }>;
  tableData: Array<Record<string, any>>;
  charts: Array<{ id?: string; title: string; type: 'bar' | 'line' | 'doughnut' | 'pie'; data: any; options?: any; description?: string }>;
}

interface BuildParams {
  reportType: string;
  period: string;
  sourceData: any;
  summaryOverride?: string;
}

export function buildUnifiedReportContent({ reportType, period, sourceData, summaryOverride }: BuildParams): UnifiedReportContent {
  console.log('Building report content for:', reportType, 'with data:', sourceData);
  
  // Find the report config for proper KPI formatting
  const reportConfig = reportConfigs.find(config => config.id === reportType || config.queryId === reportType);
  
  // Handle SQL function response structure (kpis, charts, table objects/arrays)
  const hasSQLStructure = sourceData?.kpis && typeof sourceData.kpis === 'object' && 
                          sourceData?.charts && typeof sourceData.charts === 'object';
  
  if (hasSQLStructure) {
    // Handle SQL function response structure
    const kpisObject = sourceData.kpis || {};
    const chartsObject = sourceData.charts || {};
    
    // Convert KPIs object to array format expected by PDF with proper formatting
    const kpis = Object.entries(kpisObject).map(([key, value]) => {
      // Try to find KPI config first for accurate formatting
      const kpiConfig = reportConfig?.kpis?.find(k => k.key === key);
      
      // Map common KPI keys to user-friendly labels
      const labelMap: Record<string, string> = {
        total_due: 'Total Due',
        total_collected: 'Total Collected', 
        outstanding: 'Outstanding Amount',
        collection_rate: 'Collection Rate',
        total_invoices: 'Total Invoices',
        paid_invoices: 'Paid Invoices',
        total_units: 'Total Units',
        occupied_units: 'Occupied Units',
        vacant_units: 'Vacant Units',
        occupancy_rate: 'Occupancy Rate',
        total_requests: 'Total Requests',
        completed_requests: 'Completed',
        pending_requests: 'Pending',
        avg_resolution_days: 'Avg Resolution Time'
      };
      
      const label = kpiConfig?.label || labelMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      // Determine format from config or smart detection
      let format = 'currency'; // default
      if (kpiConfig?.format) {
        format = kpiConfig.format;
      } else if (key.includes('rate') || key.includes('percent') || key.includes('margin')) {
        format = 'percent';
      } else if (key.includes('units') || key.includes('count') || key.includes('requests') || key.includes('invoices') || key.includes('days')) {
        format = 'number';
      } else if (key.includes('time') && !key.includes('amount')) {
        format = 'duration';
      }
      
      return {
        label,
        value: formatKPIValue(value, format),
        trend: undefined,
        change: undefined,
      };
    });

    // Convert charts object to array format expected by PDF
    const charts = Object.entries(chartsObject).map(([chartId, chartData]: [string, any]) => {
      // Handle different chart data structures from SQL function
      let processedData = chartData;
      
      // Determine chart type and title from chartId
      const chartTypeMap: Record<string, string> = {
        collection_trend: 'line',
        collection_breakdown: 'doughnut',
        monthly_trend: 'line'
      };
      
      const chartTitleMap: Record<string, string> = {
        collection_trend: 'Collection Trend',
        collection_breakdown: 'Collection Breakdown', 
        monthly_trend: 'Monthly Trend'
      };
      
      const chartType = chartTypeMap[chartId] || 'bar';
      const chartTitle = chartTitleMap[chartId] || chartId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      
      // Convert SQL data to Chart.js format
      if (chartType === 'line' && Array.isArray(chartData)) {
        processedData = {
          labels: chartData.map((d: any) => d.month || d.name || d.label || ''),
          datasets: [{
            label: chartTitle,
            data: chartData.map((d: any) => d.amount || d.collected || d.value || 0),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            tension: 0.4
          }]
        };
      } else if (chartType === 'doughnut' && Array.isArray(chartData)) {
        processedData = {
          labels: chartData.map((d: any) => d.name || d.label),
          datasets: [{
            data: chartData.map((d: any) => d.value || d.amount || 0),
            backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#8b5cf6']
          }]
        };
      }

      return {
        id: chartId,
        title: chartTitle,
        type: chartType as any,
        data: processedData,
        description: `${chartTitle} for the selected period`,
        options: {},
      };
    });

    // Enhanced table data processing - use existing data structure without injecting additional fields
    let tableData = sourceData.table || [];
    
    const summary = summaryOverride || generateSummaryFromKPIs(kpis, reportType);

    return {
      period,
      summary,
      kpis,
      tableData,
      charts,
    };
  }

  // Fallback to original transformer-based approach for other data structures
  const transformer = getReportTransformer(reportType);
  const rawKpis = transformer.generateKPIs(sourceData);
  const primaryCharts = transformer.generateCharts(sourceData);
  const tableData = transformer.formatTableData(sourceData) || [];

  const dynamicCharts = ReportChartDataService.generateChartsForReport(reportType, tableData, rawKpis as any, sourceData);
  const charts = (dynamicCharts && dynamicCharts.length > 0 ? dynamicCharts : primaryCharts).map((c) => ({
    id: c.id,
    title: c.title,
    type: c.type as any,
    data: c.data,
    description: (c as any).description,
    options: (c as any).options,
  }));

  const kpis = (rawKpis || []).map((kpi: any) => ({
    label: kpi.label,
    value: formatKPIValue(kpi.value, kpi.format),
    trend: kpi.trend?.direction || undefined,
    change: kpi.trend?.percentage !== undefined ? `${kpi.trend.percentage > 0 ? '+' : ''}${kpi.trend.percentage}%` : undefined,
  }));

  const summary = summaryOverride || modalSummaryHelper(sourceData?.summary || sourceData, reportType);

  return {
    period,
    summary,
    kpis,
    tableData,
    charts,
  };
}

function generateSummaryFromKPIs(kpis: any[], reportType: string): string {
  if (!kpis || kpis.length === 0) return `${reportType} report summary`;
  
  const kpiSummaries = kpis.slice(0, 3).map(kpi => 
    `${kpi.label}: ${kpi.value}`
  );
  
  return `This ${reportType.replace('-', ' ')} report shows ${kpiSummaries.join(', ')}.`;
}
