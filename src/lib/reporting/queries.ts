import { supabase } from "@/integrations/supabase/client";
import { ReportData, ReportFilters } from "./types";

// Type for the SQL function response
interface ReportResponse {
  kpis: Record<string, number>;
  charts: Record<string, any[]>;
  table: any[];
}

// Helper functions for data normalization
function normalizeChartData(chartData: any[], expectedKeys?: string[]): any[] {
  if (!Array.isArray(chartData)) return [];
  
  return chartData.map(item => {
    const normalized: any = {};
    
    // Ensure consistent name/value structure
    if (item.name === undefined && (item.property_name || item.category || item.status)) {
      normalized.name = item.property_name || item.category || item.status;
    } else {
      normalized.name = item.name;
    }
    
    if (item.value === undefined && (item.amount !== undefined || item.count !== undefined || item.total !== undefined)) {
      normalized.value = item.amount || item.count || item.total;
    } else {
      normalized.value = item.value;
    }
    
    // Copy all other properties
    Object.keys(item).forEach(key => {
      if (key !== 'name' && key !== 'value') {
        normalized[key] = item[key];
      }
    });
    
    return normalized;
  });
}

function normalizeTableData(tableData: any[], fieldMappings?: Record<string, string>): any[] {
  if (!Array.isArray(tableData)) return [];
  
  return tableData.map(row => {
    if (!fieldMappings) return row;
    
    const normalized: any = { ...row };
    Object.entries(fieldMappings).forEach(([oldKey, newKey]) => {
      if (row[oldKey] !== undefined && row[newKey] === undefined) {
        normalized[newKey] = row[oldKey];
        delete normalized[oldKey];
      }
    });
    
    return normalized;
  });
}

function computeMissingKpis(kpis: Record<string, number>, reportType: string): Record<string, number> {
  const computed = { ...kpis };
  
  switch (reportType) {
    case 'profit_loss':
      if (computed.total_revenue !== undefined && computed.total_expenses !== undefined && computed.net_profit === undefined) {
        computed.net_profit = computed.total_revenue - computed.total_expenses;
      }
      if (computed.total_income !== undefined && computed.total_expenses !== undefined && computed.profit === undefined) {
        computed.profit = computed.total_income - computed.total_expenses;
      }
      break;
      
    case 'revenue_vs_expenses':
      if (computed.revenue !== undefined && computed.expenses !== undefined && computed.net_income === undefined) {
        computed.net_income = computed.revenue - computed.expenses;
      }
      if (computed.total_revenue !== undefined && computed.total_expenses !== undefined && computed.profit_margin === undefined) {
        computed.profit_margin = computed.total_revenue > 0 ? ((computed.total_revenue - computed.total_expenses) / computed.total_revenue * 100) : 0;
      }
      break;
      
    case 'property_performance':
      if (computed.total_revenue !== undefined && computed.total_expenses !== undefined && computed.net_income === undefined) {
        computed.net_income = computed.total_revenue - computed.total_expenses;
      }
      if (computed.net_income !== undefined && computed.total_revenue !== undefined && computed.avg_yield === undefined) {
        computed.avg_yield = computed.total_revenue > 0 ? (computed.net_income / computed.total_revenue * 100) : 0;
      }
      break;
  }
  
  return computed;
}

const reportQueries = {
  rent_collection: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching rent collection report with dates:', { startDate, endDate });
      
      const { data, error } = await supabase.rpc('get_rent_collection_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Error fetching rent collection report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      console.log('Rent collection report response:', reportResponse);
      
      if (!reportResponse) {
        throw new Error('No data returned from rent collection report');
      }

      const result = {
        kpis: reportResponse.kpis || {},
        charts: reportResponse.charts || {},
        table: reportResponse.table || []
      };

      // Log details for debugging live data connection
      const hasData = Object.values(result.kpis).some(v => v > 0) || 
                      Object.values(result.charts).some(arr => arr.length > 0) || 
                      result.table.length > 0;
      
      if (!hasData) {
        console.warn('Rent collection report returned empty data for period:', { startDate, endDate });
        console.log('Checking if user has access to properties and payments...');
      } else {
        console.log('✅ Rent collection report successfully loaded with live data:', {
          kpiCount: Object.keys(result.kpis).length,
          totalCollected: result.kpis.total_collected || 0,
          tableRows: result.table.length
        });
      }

      return result;
    } catch (error) {
      console.error('Failed to fetch rent collection report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },

  occupancy_report: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching occupancy report with dates:', { startDate, endDate });
      
      const { data, error } = await supabase.rpc('get_occupancy_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Error fetching occupancy report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      return {
        kpis: reportResponse?.kpis || {},
        charts: reportResponse?.charts || {},
        table: reportResponse?.table || []
      };
    } catch (error) {
      console.error('Failed to fetch occupancy report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },

  maintenance_report: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching maintenance report with dates:', { startDate, endDate });
      
      const { data, error } = await (supabase as any).rpc('get_maintenance_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Error fetching maintenance report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      // Normalize chart data for maintenance analytics
      const normalizedCharts: Record<string, any[]> = {};
      Object.entries(reportResponse?.charts || {}).forEach(([key, chartData]) => {
        normalizedCharts[key] = normalizeChartData(chartData);
      });
      
      return {
        kpis: reportResponse?.kpis || {},
        charts: normalizedCharts,
        table: reportResponse?.table || []
      };
    } catch (error) {
      console.error('Failed to fetch maintenance report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },

  expense_summary: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching expense summary report with dates:', { startDate, endDate });
      
      const { data, error } = await supabase.rpc('get_expense_summary_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Error fetching expense summary report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      return {
        kpis: reportResponse?.kpis || {},
        charts: reportResponse?.charts || {},
        table: reportResponse?.table || []
      };
    } catch (error) {
      console.error('Failed to fetch expense summary report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },

  lease_expiry: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching lease expiry report with dates:', { startDate, endDate });
      
      const { data, error } = await (supabase as any).rpc('get_lease_expiry_report', {
        p_start_date: startDate ?? null,
        p_end_date: endDate ?? null
      });

      if (error) {
        console.error('Error fetching lease expiry report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      return {
        kpis: reportResponse?.kpis || {},
        charts: reportResponse?.charts || {},
        table: reportResponse?.table || []
      };
    } catch (error) {
      console.error('Failed to fetch lease expiry report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },

  outstanding_balances: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching outstanding balances report with dates:', { startDate, endDate });
      
      const { data, error } = await (supabase as any).rpc('get_outstanding_balances_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Error fetching outstanding balances report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      // Normalize chart data
      const normalizedCharts: Record<string, any[]> = {};
      Object.entries(reportResponse?.charts || {}).forEach(([key, chartData]) => {
        normalizedCharts[key] = normalizeChartData(chartData);
      });
      
      return {
        kpis: reportResponse?.kpis || {},
        charts: normalizedCharts,
        table: reportResponse?.table || []
      };
    } catch (error) {
      console.error('Failed to fetch outstanding balances report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },

  property_performance: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching property performance report with dates:', { startDate, endDate });
      
      const { data, error } = await supabase.rpc('get_property_performance_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Error fetching property performance report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      // Enhanced normalization for property performance
      const normalizedCharts: Record<string, any[]> = {};
      Object.entries(reportResponse?.charts || {}).forEach(([key, chartData]) => {
        const normalized = normalizeChartData(chartData).map(item => {
          // Ensure consistent property name mapping
          const propertyName = item.property_name || item.property || item.name || 'Unknown Property';
          
          // Coerce numeric values and handle percentages
          const revenue = typeof item.revenue === 'string' 
            ? parseFloat(item.revenue.replace(/[,$%]/g, '')) || 0
            : (typeof item.revenue === 'number' ? item.revenue : 0);
            
          const expenses = typeof item.expenses === 'string'
            ? parseFloat(item.expenses.replace(/[,$%]/g, '')) || 0
            : (typeof item.expenses === 'number' ? item.expenses : 0);
            
          let yield_value = typeof item.yield === 'string'
            ? parseFloat(item.yield.replace(/[,%]/g, '')) || 0
            : (typeof item.yield === 'number' ? item.yield : 0);
          
          // Convert yield to percentage if in 0-1 range
          if (yield_value > 0 && yield_value < 1) {
            yield_value = yield_value * 100;
          }
          
          return {
            ...item,
            property_name: propertyName,
            revenue,
            expenses,
            yield: yield_value,
            net_income: revenue - expenses
          };
        });
        
        normalizedCharts[key] = normalized;
      });
      
      // Compute missing KPIs for property performance
      const computedKpis = computeMissingKpis(reportResponse?.kpis || {}, 'property_performance');
      
      // Normalize table data
      const normalizedTable = (reportResponse?.table || []).map(row => {
        const propertyName = row.property_name || row.property || row.name || 'Unknown Property';
        const revenue = typeof row.revenue === 'number' ? row.revenue : 0;
        const expenses = typeof row.expenses === 'number' ? row.expenses : 0;
        
        let yield_value = typeof row.yield === 'string'
          ? parseFloat(row.yield.replace(/[,%]/g, '')) || 0
          : (typeof row.yield === 'number' ? row.yield : 0);
          
        // Convert yield to percentage if in 0-1 range
        if (yield_value > 0 && yield_value < 1) {
          yield_value = yield_value * 100;
        }
        
        // Compute net income if missing
        const net_income = row.net_income || (revenue - expenses);
        
        // Compute yield if missing (with divide-by-zero guard)
        if (!row.yield && revenue > 0) {
          yield_value = (net_income / revenue) * 100;
        }
        
        // Normalize date fields to prevent "Invalid time value" errors
        let report_period = row.report_period || row.report_date || row.period;
        if (report_period && typeof report_period === 'string') {
          // Handle partial dates like "2024-01" by adding day
          if (/^\d{4}-\d{2}$/.test(report_period)) {
            report_period = `${report_period}-01`;
          }
        }
        if (!report_period) {
          report_period = new Date().toISOString().split('T')[0]; // Current date as fallback
        }
        
        return {
          ...row,
          property_name: propertyName,
          net_income,
          yield: yield_value,
          report_period,
          report_date: report_period // Ensure both fields are normalized
        };
      });
      
      // Debug logging for property performance
      console.log('Property Performance - Sample chart data:', 
        Object.keys(normalizedCharts).map(key => ({
          chart: key,
          sample: normalizedCharts[key].slice(0, 2)
        }))
      );
      console.log('Property Performance - Sample table data:', normalizedTable.slice(0, 2));
      console.log('Property Performance - Computed KPIs:', computedKpis);
      
      return {
        kpis: computedKpis,
        charts: normalizedCharts,
        table: normalizedTable
      };
    } catch (error) {
      console.error('Failed to fetch property performance report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },

  profit_loss: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching profit loss report with dates:', { startDate, endDate });
      
      const { data, error } = await supabase.rpc('get_profit_loss_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Error fetching profit loss report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      // Normalize chart data and compute missing KPIs
      const normalizedCharts: Record<string, any[]> = {};
      Object.entries(reportResponse?.charts || {}).forEach(([key, chartData]) => {
        normalizedCharts[key] = normalizeChartData(chartData);
      });
      
      const computedKpis = computeMissingKpis(reportResponse?.kpis || {}, 'profit_loss');
      
      return {
        kpis: computedKpis,
        charts: normalizedCharts,
        table: reportResponse?.table || []
      };
    } catch (error) {
      console.error('Failed to fetch profit loss report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },

  cash_flow: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching cash flow report with dates:', { startDate, endDate });
      
      const { data, error } = await supabase.rpc('get_cash_flow_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Error fetching cash flow report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      return {
        kpis: reportResponse?.kpis || {},
        charts: reportResponse?.charts || {},
        table: reportResponse?.table || []
      };
    } catch (error) {
      console.error('Failed to fetch cash flow report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },

  revenue_vs_expenses: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching revenue vs expenses report with dates:', { startDate, endDate });
      
      const { data, error } = await supabase.rpc('get_revenue_vs_expenses_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Error fetching revenue vs expenses report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      // Normalize chart data and compute missing KPIs
      const normalizedCharts: Record<string, any[]> = {};
      Object.entries(reportResponse?.charts || {}).forEach(([key, chartData]) => {
        normalizedCharts[key] = normalizeChartData(chartData);
      });
      
      const computedKpis = computeMissingKpis(reportResponse?.kpis || {}, 'revenue_vs_expenses');
      
      return {
        kpis: computedKpis,
        charts: normalizedCharts,
        table: reportResponse?.table || []
      };
    } catch (error) {
      console.error('Failed to fetch revenue vs expenses report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },

  executive_summary: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(
        filters.periodPreset || 'current_month',
        filters.startDate,
        filters.endDate
      );

      console.log('Fetching executive summary report with dates:', { startDate, endDate });
      
      const { data, error } = await supabase.rpc('get_executive_summary_report', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_include_tenant_scope: true
      });

      if (error) {
        console.error('Executive summary RPC error:', error);
        throw error;
      }

      console.log('Executive summary raw response:', data);
      
      // Debug meta data for verification
      const reportData = data as any;
      if (reportData?.meta) {
        console.log('📊 Executive Summary Meta:', {
          properties_count: reportData.meta.properties_count || 0,
          payments_count: reportData.meta.payments_count || 0,
          expenses_count: reportData.meta.expenses_count || 0,
          invoices_count: reportData.meta.invoices_count || 0,
          date_range: `${startDate} to ${endDate}`,
          scope: 'tenant_included'
        });
      }

      if (!data) {
        return {
          kpis: {},
          charts: {},
          table: []
        };
      }

      // Normalize the table data to match expected structure for detailed breakdown
      const normalizedTable = (reportData?.table || []).map((item: any) => ({
        report_date: item.report_date,
        property_name: item.property_name,
        units: item.units,
        revenue: item.revenue,
        occupancy: `${item.occupancy}%`
      }));

      return {
        kpis: reportData?.kpis || {},
        charts: reportData?.charts || {},
        table: normalizedTable
      };
    } catch (error) {
      console.error('Error in executive_summary query:', error);
      throw error;
    }
  },

  market_rent: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      // Check if this is a market comparison request
      const isMarketComparison = filters.comparisonMode === 'market';
      const functionName = isMarketComparison ? 'get_platform_market_rent' : 'get_market_rent_report';

      const dateRange = calculateDateRange(
        filters.periodPreset || 'last_12_months',
        filters.startDate,
        filters.endDate
      );

      const { data, error } = await supabase.rpc(functionName, {
        p_start_date: dateRange.startDate,
        p_end_date: dateRange.endDate
      });
      
      if (error) {
        console.error('Error fetching market rent report:', error);
        throw error;
      }

      const reportData = data as any;
      return {
        kpis: reportData?.kpis || {},
        charts: reportData?.charts || {},
        table: reportData?.table || [],
        comparisonMode: isMarketComparison ? 'market' : 'portfolio'
      };
    } catch (error) {
      console.error('Error in market_rent report:', error);
      return {
        kpis: {
          avg_market_rent: 0,
          avg_current_rent: 0,
          rent_variance: 0,
          optimization_potential: 0,
          properties_analyzed: 0
        },
        charts: {},
        table: [],
        comparisonMode: 'portfolio'
      };
    }
  },

  tenant_turnover: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching tenant turnover report with dates:', { startDate, endDate });
      
      const { data, error } = await (supabase as any).rpc('get_tenant_turnover_report', {
        p_start_date: startDate,
        p_end_date: endDate
      });

      if (error) {
        console.error('Error fetching tenant turnover report:', error);
        throw error;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      return {
        kpis: reportResponse?.kpis || {},
        charts: reportResponse?.charts || {},
        table: reportResponse?.table || []
      };
    } catch (error) {
      console.error('Failed to fetch tenant turnover report:', error);
      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },

  financial_summary: async (filters: ReportFilters): Promise<ReportData> => {
    try {
      const { startDate, endDate } = calculateDateRange(filters.periodPreset, filters.startDate, filters.endDate);
      
      console.log('Fetching financial summary report with dates:', { startDate, endDate });
      console.log('Financial summary filters:', filters);
      
      // Include property filter if provided (function supports optional p_property_id)
      const rpcParams: any = {
        p_start_date: startDate,
        p_end_date: endDate,
        // Always include p_property_id (nullable) to disambiguate overloaded functions in Postgres
        p_property_id: filters.propertyId || null
      };

      let data: any = null;
      try {
        const rpcResult = await (supabase as any).rpc('get_financial_summary_report', rpcParams);
        // Supabase RPC may return { data, error } or throw; normalize
        if (rpcResult && Object.prototype.hasOwnProperty.call(rpcResult, 'error')) {
          const { error } = rpcResult as any;
          if (error) {
            // Serialize error for logging
            let serialized;
            try { serialized = JSON.stringify(error, Object.getOwnPropertyNames(error)); } catch (e) { serialized = String(error); }
            console.error('Error fetching financial summary report (rpc error):', serialized);
            // Return early to be handled by outer catch
            throw error;
          }
          data = (rpcResult as any).data;
        } else {
          // Some clients return the data directly
          data = rpcResult;
        }
      } catch (rpcError) {
        let serialized;
        try { serialized = JSON.stringify(rpcError, Object.getOwnPropertyNames(rpcError)); } catch (e) { serialized = String(rpcError); }
        console.error('Error fetching financial summary report (exception):', serialized);
        // Re-throw to be caught by outer catch where we produce empty report
        throw rpcError;
      }

      const reportResponse = data as unknown as ReportResponse;
      
      console.log('Raw financial summary data:', reportResponse);
      console.log('Financial Summary KPIs breakdown:', {
        total_income: reportResponse?.kpis?.total_income,
        total_expenses: reportResponse?.kpis?.total_expenses,
        net_income: reportResponse?.kpis?.net_income,
        payment_count: reportResponse?.kpis?.payment_count,
        expense_count: reportResponse?.kpis?.expense_count
      });

      // Check if we have any data at all
      const hasKpiData = reportResponse?.kpis && Object.values(reportResponse.kpis).some(v => v && v > 0);
      const hasTableData = reportResponse?.table && reportResponse.table.length > 0;
      const hasChartData = reportResponse?.charts && Object.values(reportResponse.charts).some(arr => Array.isArray(arr) && arr.length > 0);
      
      if (!hasKpiData && !hasTableData && !hasChartData) {
        console.warn('⚠️ Financial Summary returned no data for period:', { startDate, endDate, propertyId: filters.propertyId });
        console.log('This could indicate:');
        console.log('- No payments with status "completed", "paid", or "success"');
        console.log('- No expenses in the date range');
        console.log('- User lacks permission to view properties');
        console.log('- Property ownership/management assignments are missing');
      } else {
        console.log('✅ Financial Summary loaded successfully:', {
          hasKpiData,
          hasTableData, 
          hasChartData,
          totalIncome: reportResponse?.kpis?.total_income || 0,
          totalExpenses: reportResponse?.kpis?.total_expenses || 0
        });
      }
      
      // Normalize table data for Financial Summary - flatten revenue_sources and expense_categories
      let normalizedTable: any[] = [];
      
      if (reportResponse?.table && typeof reportResponse.table === 'object' && !Array.isArray(reportResponse.table)) {
        const tableObj = reportResponse.table as any;
        const { revenue_sources = [], expense_categories = [] } = tableObj;
        const totalIncome = reportResponse?.kpis?.total_income || 0;
        const totalExpenses = reportResponse?.kpis?.total_expenses || 0;
        
        // Add revenue sources as Income rows
        if (Array.isArray(revenue_sources)) {
          revenue_sources.forEach((item: any) => {
            normalizedTable.push({
              category: item.property_name || item.category || 'Revenue',
              type: 'Income',
              amount: item.amount || 0,
              percentage: totalIncome > 0 ? ((item.amount || 0) / totalIncome * 100) : 0
            });
          });
        }
        
        // Add expense categories as Expense rows
        if (Array.isArray(expense_categories)) {
          expense_categories.forEach((item: any) => {
            normalizedTable.push({
              category: item.category || 'Expense',
              type: 'Expense', 
              amount: item.amount || 0,
              percentage: totalExpenses > 0 ? ((item.amount || 0) / totalExpenses * 100) : 0
            });
          });
        }
      } else if (Array.isArray(reportResponse?.table)) {
        normalizedTable = reportResponse.table;
      }

      // Add fallback rows if table is empty but we have KPI data
      if (normalizedTable.length === 0 && hasKpiData) {
        const totalIncome = reportResponse?.kpis?.total_income || 0;
        const totalExpenses = reportResponse?.kpis?.total_expenses || 0;
        
        if (totalIncome > 0) {
          normalizedTable.push({
            category: 'Total Revenue',
            type: 'Income',
            amount: totalIncome,
            percentage: 100
          });
        }
        
        if (totalExpenses > 0) {
          normalizedTable.push({
            category: 'Total Expenses',
            type: 'Expense',
            amount: totalExpenses,
            percentage: 100
          });
        }
      }

      return {
        kpis: reportResponse?.kpis || {},
        charts: reportResponse?.charts || {},
        table: normalizedTable
      };
    } catch (error) {
      // Serialize error
      let serialized;
      try { serialized = JSON.stringify(error, Object.getOwnPropertyNames(error)); } catch (e) { serialized = String(error); }
      console.error('Failed to fetch financial summary report:', serialized);

      // Detect missing column errors (Postgres 42703) which usually mean the RPC function is out-of-sync with code
      const errObj: any = error as any;
      if (errObj && (errObj.code === '42703' || (typeof errObj.message === 'string' && errObj.message.includes('column')))) {
        console.error('🔧 SQL column missing error detected when running get_financial_summary_report. This typically means the stored function in the database does not match the expected implementation in migrations. Suggested fixes:');
        console.error('- Run the latest DB migrations to recreate get_financial_summary_report so it includes total_income / total_expenses aliases.');
        console.error('- Inspect the function body in supabase/migrations/*get_financial_summary_report*.sql and ensure the CTE producing kpis aliases columns as total_income and total_expenses.');
        console.error('- If you cannot run migrations, consider temporarily falling back to a simplified client-side summary or contact your DBA.');
      }

      return {
        kpis: {},
        charts: {},
        table: []
      };
    }
  },
};

// Helper function to calculate date ranges with support for all presets
function calculateDateRange(periodPreset: string, startDate?: string, endDate?: string) {
  const now = new Date();
  let calculatedStartDate: string;
  let calculatedEndDate: string;

  if (startDate && endDate) {
    return { startDate, endDate };
  }

  switch (periodPreset) {
    case 'current_period':
      calculatedStartDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      calculatedEndDate = now.toISOString().split('T')[0];
      break;
    case 'last_12_months':
      calculatedStartDate = new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString().split('T')[0];
      calculatedEndDate = now.toISOString().split('T')[0];
      break;
    case 'ytd':
      calculatedStartDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      calculatedEndDate = now.toISOString().split('T')[0];
      break;
    case 'last_6_months':
      calculatedStartDate = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().split('T')[0];
      calculatedEndDate = now.toISOString().split('T')[0];
      break;
    case 'next_90_days':
      calculatedStartDate = now.toISOString().split('T')[0];
      calculatedEndDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case 'as_of_today':
      calculatedStartDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      calculatedEndDate = now.toISOString().split('T')[0];
      break;
    default:
      calculatedStartDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      calculatedEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  }

  return { startDate: calculatedStartDate, endDate: calculatedEndDate };
}

export const getReportData = async (queryId: string, filters: ReportFilters): Promise<ReportData> => {
  console.time(`Report Query: ${queryId}`);
  console.log(`🔄 Fetching report data for ${queryId}`, { filters });
  
  const queryFunction = reportQueries[queryId as keyof typeof reportQueries];
  
  if (!queryFunction) {
    console.warn(`⚠️ No query function found for queryId: ${queryId}`);
    console.timeEnd(`Report Query: ${queryId}`);
    return { 
      kpis: {}, 
      charts: {}, 
      table: [] 
    };
  }

  try {
    const result = await queryFunction(filters);
    
    // Performance monitoring
    const hasData = Object.values(result.kpis).some(v => v > 0) || 
                   Object.values(result.charts).some(arr => Array.isArray(arr) && arr.length > 0) || 
                   result.table.length > 0;
    
    if (hasData) {
      console.log(`✅ Report ${queryId} loaded successfully:`, {
        kpiCount: Object.keys(result.kpis).length,
        chartCount: Object.keys(result.charts).length,
        tableRows: result.table.length
      });
    } else {
      console.log(`📊 Report ${queryId} returned empty data`);
    }
    
    // Ensure all KPI values default to 0 instead of undefined
    const defaultedKpis = Object.keys(result.kpis).reduce((acc, key) => {
      acc[key] = result.kpis[key] ?? 0;
      return acc;
    }, {} as Record<string, number>);

    // Limit table data for performance (first 1000 rows)
    const optimizedTable = result.table.length > 1000 
      ? result.table.slice(0, 1000)
      : result.table;

    if (result.table.length > 1000) {
      console.log(`⚡ Table data limited to 1000 rows for performance (was ${result.table.length})`);
    }

    console.timeEnd(`Report Query: ${queryId}`);
    
    return {
      kpis: defaultedKpis,
      charts: result.charts || {},
      table: optimizedTable
    };
  } catch (error) {
    console.error(`❌ Failed to fetch data for report ${queryId}:`, error);
    console.timeEnd(`Report Query: ${queryId}`);
    return { 
      kpis: {}, 
      charts: {}, 
      table: [] 
    };
  }
};
