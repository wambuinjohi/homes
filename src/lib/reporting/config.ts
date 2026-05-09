import { ReportConfig, Role } from './types';

export const reportConfigs: ReportConfig[] = [
  {
    id: 'rent-collection',
    title: 'Rent Collection Report',
    description: 'Track rent collection performance and outstanding balances',
    defaultPeriod: 'current_period',
    roles: ['admin', 'landlord'],
    queryId: 'rent_collection',
    kpis: [
      { key: 'total_collected', label: 'Total Collected', format: 'currency' },
      { key: 'collection_rate', label: 'Collection Rate', format: 'percent', decimals: 1 },
      { key: 'outstanding_amount', label: 'Outstanding', format: 'currency' },
      { key: 'late_payments', label: 'Late Payments', format: 'number' }
    ],
    charts: [
      {
        id: 'collection_trend',
        type: 'line',
        title: 'Collection Trend',
        xKey: 'month',
        yKeys: ['collected', 'expected']
      },
      {
        id: 'payment_status',
        type: 'pie',
        title: 'Payment Status Distribution'
      }
    ],
    table: {
      columns: [
        { key: 'payment_date', label: 'Date', align: 'left', format: 'date' },
        { key: 'property_name', label: 'Property', align: 'left' },
        { key: 'unit_number', label: 'Unit', align: 'left' },
        { key: 'tenant_name', label: 'Tenant', align: 'left' },
        { key: 'amount_due', label: 'Amount Due', align: 'right', format: 'currency' },
        { key: 'amount_paid', label: 'Amount Paid', align: 'right', format: 'currency' },
        { key: 'status', label: 'Status', align: 'center' }
      ]
    }
  },
  {
    id: 'financial-summary',
    title: 'Financial Summary',
    description: 'Comprehensive financial overview including income and expenses',
    defaultPeriod: 'last_12_months',
    roles: ['admin', 'landlord'],
    queryId: 'financial_summary',
    kpis: [
      { key: 'total_income', label: 'Total Income', format: 'currency' },
      { key: 'total_expenses', label: 'Total Expenses', format: 'currency' },
      { key: 'net_profit', label: 'Net Profit', format: 'currency' },
      { key: 'profit_margin', label: 'Profit Margin', format: 'percent', decimals: 1 }
    ],
    charts: [
      {
        id: 'income_vs_expenses',
        type: 'bar',
        title: 'Income vs Expenses',
        xKey: 'month',
        yKeys: ['income', 'expenses']
      },
      {
        id: 'expense_breakdown',
        type: 'donut',
        title: 'Expense Breakdown'
      }
    ],
    table: {
      columns: [
        { key: 'category', label: 'Category', align: 'left' },
        { key: 'type', label: 'Type', align: 'center' },
        { key: 'amount', label: 'Amount', align: 'right', format: 'currency' },
        { key: 'percentage', label: 'Percentage', align: 'right', format: 'percent' }
      ]
    }
  },
  {
    id: 'occupancy-report',
    title: 'Unit Occupancy Report',
    description: 'Track property occupancy rates and vacancy trends',
    defaultPeriod: 'current_period',
    roles: ['admin', 'landlord'],
    queryId: 'occupancy_report',
    kpis: [
      { key: 'occupancy_rate', label: 'Occupancy Rate', format: 'percent', decimals: 0 },
      { key: 'total_units', label: 'Total Units', format: 'number' },
      { key: 'occupied_units', label: 'Occupied Units', format: 'number' },
      { key: 'vacant_units', label: 'Vacant Units', format: 'number' }
    ],
    charts: [
      {
        id: 'occupancy_trend',
        type: 'area',
        title: 'Occupancy Trend',
        xKey: 'month',
        yKeys: ['occupancy_rate']
      },
      {
        id: 'property_occupancy',
        type: 'bar',
        title: 'Occupancy by Property',
        xKey: 'property',
        yKeys: ['occupied', 'vacant']
      }
    ],
    table: {
      columns: [
        { key: 'property_name', label: 'Property', align: 'left' },
        { key: 'total_units', label: 'Total Units', align: 'right', format: 'number' },
        { key: 'occupied_units', label: 'Occupied', align: 'right', format: 'number' },
        { key: 'occupancy_rate', label: 'Occupancy Rate', align: 'right', format: 'percent', decimals: 0 }
      ]
    }
  },
  {
    id: 'maintenance-report',
    title: 'Maintenance Analytics',
    description: 'Track maintenance requests and resolution times',
    defaultPeriod: 'last_6_months',
    roles: ['admin', 'landlord'],
    queryId: 'maintenance_report',
    kpis: [
      { key: 'total_requests', label: 'Total Requests', format: 'number' },
      { key: 'completed_requests', label: 'Completed', format: 'number' },
      { key: 'avg_resolution_time', label: 'Avg Resolution Time', format: 'duration' },
      { key: 'total_cost', label: 'Total Cost', format: 'currency' }
    ],
    charts: [
      {
        id: 'requests_by_status',
        type: 'pie',
        title: 'Requests by Status'
      },
      {
        id: 'monthly_requests',
        type: 'bar',
        title: 'Monthly Requests',
        xKey: 'month',
        yKeys: ['requests']
      }
    ],
    table: {
      columns: [
        { key: 'created_date', label: 'Date', align: 'left', format: 'date' },
        { key: 'property_name', label: 'Property', align: 'left' },
        { key: 'category', label: 'Category', align: 'left' },
        { key: 'status', label: 'Status', align: 'center' },
        { key: 'cost', label: 'Cost', align: 'right', format: 'currency' }
      ]
    }
  },
  {
    id: 'lease-expiry',
    title: 'Lease Expiry Report',
    description: 'Track upcoming lease expirations and renewals',
    defaultPeriod: 'next_90_days',
    roles: ['admin', 'landlord'],
    queryId: 'lease_expiry',
    kpis: [
      { key: 'expiring_leases', label: 'Expiring Leases', format: 'number' },
      { key: 'renewal_rate', label: 'Renewal Rate', format: 'percent', decimals: 1 },
      { key: 'potential_revenue_loss', label: 'Potential Revenue Loss', format: 'currency' },
      { key: 'avg_lease_duration', label: 'Avg Lease Duration', format: 'duration' }
    ],
    charts: [
      {
        id: 'expiry_timeline',
        type: 'bar',
        title: 'Lease Expiries by Month',
        xKey: 'month',
        yKeys: ['expiring']
      }
    ],
    table: {
      columns: [
        { key: 'lease_end_date', label: 'Lease End Date', align: 'left', format: 'date' },
        { key: 'property_name', label: 'Property', align: 'left' },
        { key: 'unit_number', label: 'Unit', align: 'left' },
        { key: 'tenant_name', label: 'Tenant', align: 'left' },
        { key: 'monthly_rent', label: 'Monthly Rent', align: 'right', format: 'currency' },
        { key: 'days_until_expiry', label: 'Days Left', align: 'right', format: 'number' }
      ]
    }
  },
  {
    id: 'tenant-turnover',
    title: 'Tenant Turnover Report',
    description: 'Analyze tenant retention and turnover patterns',
    defaultPeriod: 'last_12_months',
    roles: ['admin', 'landlord'],
    queryId: 'tenant_turnover',
    kpis: [
      { key: 'turnover_rate', label: 'Turnover Rate', format: 'percent', decimals: 1 },
      { key: 'avg_tenancy_duration', label: 'Avg Tenancy Duration', format: 'duration' },
      { key: 'new_tenants', label: 'New Tenants', format: 'number' },
      { key: 'departed_tenants', label: 'Departed Tenants', format: 'number' }
    ],
    charts: [
      {
        id: 'turnover_trend',
        type: 'line',
        title: 'Turnover Trend',
        xKey: 'month',
        yKeys: ['turnover_rate']
      }
    ],
    table: {
      columns: [
        { key: 'lease_end_date', label: 'Lease End Date', align: 'left', format: 'date' },
        { key: 'property_name', label: 'Property', align: 'left' },
        { key: 'unit_number', label: 'Unit', align: 'left' },
        { key: 'tenant_name', label: 'Former Tenant', align: 'left' },
        { key: 'tenancy_duration', label: 'Tenancy Duration', align: 'right', format: 'duration' }
      ]
    }
  },
  {
    id: 'outstanding-balances',
    title: 'Outstanding Balances',
    description: 'Aging analysis of unpaid invoices and at-risk accounts',
    defaultPeriod: 'as_of_today',
    roles: ['admin', 'landlord'],
    queryId: 'outstanding_balances',
    kpis: [
      { key: 'total_outstanding', label: 'Total Outstanding', format: 'currency' },
      { key: 'overdue_count', label: 'Overdue Invoices', format: 'number' },
      { key: 'avg_balance', label: 'Average Balance', format: 'currency' },
      { key: 'at_risk_amount', label: 'At Risk Amount', format: 'currency' }
    ],
    charts: [
      { id: 'aging_analysis', type: 'bar', xKey: 'aging_bucket', yKeys: ['amount'] },
      { id: 'risk_breakdown', type: 'donut' }
    ],
    table: {
      columns: [
        { key: 'due_date', label: 'Due Date', align: 'left', format: 'date' },
        { key: 'tenant_name', label: 'Tenant', align: 'left' },
        { key: 'property_name', label: 'Property', align: 'left' },
        { key: 'outstanding_amount', label: 'Outstanding', format: 'currency', align: 'right' },
        { key: 'days_overdue', label: 'Days Overdue', format: 'number', align: 'right' },
        { key: 'risk_level', label: 'Risk Level', align: 'center' }
      ]
    }
  },
  {
    id: 'property-performance',
    title: 'Property Performance',
    description: 'Revenue vs expenses analysis and yield per property',
    defaultPeriod: 'ytd',
    roles: ['admin', 'landlord'],
    queryId: 'property_performance',
    kpis: [
      { key: 'total_revenue', label: 'Total Revenue', format: 'currency' },
      { key: 'total_expenses', label: 'Total Expenses', format: 'currency' },
      { key: 'net_income', label: 'Net Income', format: 'currency' },
      { key: 'avg_yield', label: 'Average Yield', format: 'percent', decimals: 2 }
    ],
    charts: [
      { id: 'revenue_vs_expenses', type: 'bar', xKey: 'property_name', yKeys: ['revenue', 'expenses'] },
      { id: 'yield_comparison', type: 'line', xKey: 'property_name', yKeys: ['yield'] }
    ],
    table: {
      columns: [
        { key: 'report_period', label: 'Date', align: 'left', format: 'date' },
        { key: 'property_name', label: 'Property', align: 'left' },
        { key: 'revenue', label: 'Revenue', format: 'currency', align: 'right' },
        { key: 'expenses', label: 'Expenses', format: 'currency', align: 'right' },
        { key: 'net_income', label: 'Net Income', format: 'currency', align: 'right' },
        { key: 'yield', label: 'Yield %', format: 'percent', align: 'right' }
      ]
    }
  },
  {
    id: 'profit-loss',
    title: 'Profit & Loss Report',
    description: 'Comprehensive P&L statement with revenue and expense breakdown',
    defaultPeriod: 'last_12_months',
    roles: ['admin', 'landlord'],
    queryId: 'profit_loss',
    kpis: [
      { key: 'total_revenue', label: 'Total Revenue', format: 'currency' },
      { key: 'total_expenses', label: 'Total Expenses', format: 'currency' },
      { key: 'gross_profit', label: 'Gross Profit', format: 'currency' },
      { key: 'profit_margin', label: 'Profit Margin', format: 'percent', decimals: 1 }
    ],
    charts: [
      { id: 'monthly_pnl', type: 'bar', xKey: 'month', yKeys: ['revenue', 'expenses', 'profit'] },
      { id: 'expense_breakdown', type: 'pie' }
    ],
    table: {
      columns: [
        { key: 'transaction_date', label: 'Date', align: 'left', format: 'date' },
        { key: 'category', label: 'Category', align: 'left' },
        { key: 'amount', label: 'Amount', format: 'currency', align: 'right' },
        { key: 'percentage', label: 'Percentage', format: 'percent', align: 'right' }
      ]
    }
  },
  {
    id: 'revenue-vs-expenses',
    title: 'Revenue vs Expenses',
    description: 'Detailed comparison of income and operational costs',
    defaultPeriod: 'last_12_months',
    roles: ['admin', 'landlord'],
    queryId: 'revenue_vs_expenses',
    kpis: [
      { key: 'total_revenue', label: 'Total Revenue', format: 'currency' },
      { key: 'total_expenses', label: 'Total Expenses', format: 'currency' },
      { key: 'net_income', label: 'Net Income', format: 'currency' },
      { key: 'expense_ratio', label: 'Expense Ratio', format: 'percent', decimals: 1 }
    ],
    charts: [
      { id: 'monthly_comparison', type: 'line', xKey: 'month', yKeys: ['revenue', 'expenses'] },
      { id: 'trend_analysis', type: 'area', xKey: 'month', yKeys: ['net_income'] }
    ],
    table: {
      columns: [
        { key: 'report_date', label: 'Date', align: 'left', format: 'date' },
        { key: 'month', label: 'Month', align: 'left' },
        { key: 'revenue', label: 'Revenue', format: 'currency', align: 'right' },
        { key: 'expenses', label: 'Expenses', format: 'currency', align: 'right' },
        { key: 'net_income', label: 'Net Income', format: 'currency', align: 'right' }
      ]
    }
  },
  {
    id: 'expense-summary',
    title: 'Expense Summary',
    description: 'Property maintenance and operational costs by category',
    defaultPeriod: 'last_12_months',
    roles: ['admin', 'landlord'],
    queryId: 'expense_summary',
    kpis: [
      { key: 'total_expenses', label: 'Total Expenses', format: 'currency' },
      { key: 'maintenance_costs', label: 'Maintenance Costs', format: 'currency' },
      { key: 'operational_costs', label: 'Operational Costs', format: 'currency' },
      { key: 'expense_per_unit', label: 'Expense per Unit', format: 'currency' }
    ],
    charts: [
      { id: 'expense_categories', type: 'pie' },
      { id: 'monthly_expenses', type: 'bar', xKey: 'month', yKeys: ['expenses'] }
    ],
    table: {
      columns: [
        { key: 'expense_date', label: 'Date', align: 'left', format: 'date' },
        { key: 'expense_category', label: 'Category', align: 'left' },
        { key: 'description', label: 'Description', align: 'left' },
        { key: 'amount', label: 'Amount', format: 'currency', align: 'right' },
        { key: 'property_name', label: 'Property', align: 'left' },
        { key: 'vendor', label: 'Vendor', align: 'left' }
      ]
    }
  },
  {
    id: 'cash-flow',
    title: 'Cash Flow Analysis',
    description: 'Monthly cash inflows and outflows with projections',
    defaultPeriod: 'last_12_months',
    roles: ['admin', 'landlord'],
    queryId: 'cash_flow',
    kpis: [
      { key: 'cash_inflow', label: 'Cash Inflow', format: 'currency' },
      { key: 'cash_outflow', label: 'Cash Outflow', format: 'currency' },
      { key: 'net_cash_flow', label: 'Net Cash Flow', format: 'currency' },
      { key: 'cash_flow_margin', label: 'Cash Flow Margin', format: 'percent', decimals: 1 }
    ],
    charts: [
      { id: 'cash_flow_trend', type: 'line', xKey: 'month', yKeys: ['inflow', 'outflow', 'net'] },
      { id: 'cash_flow_breakdown', type: 'area', xKey: 'month', yKeys: ['inflow', 'outflow'], stacked: true }
    ],
    table: {
      columns: [
        { key: 'period_end', label: 'Date', align: 'left', format: 'date' },
        { key: 'month', label: 'Month', align: 'left' },
        { key: 'inflow', label: 'Cash Inflow', format: 'currency', align: 'right' },
        { key: 'outflow', label: 'Cash Outflow', format: 'currency', align: 'right' },
        { key: 'net_flow', label: 'Net Cash Flow', format: 'currency', align: 'right' }
      ]
    }
  },
  {
    id: 'market-rent',
    title: 'Market Rent Analysis',
    description: 'Rent comparison with market rates and optimization opportunities',
    defaultPeriod: 'current_period',
    roles: ['admin', 'landlord'],
    queryId: 'market_rent',
    kpis: [
      { key: 'avg_market_rent', label: 'Avg Market Rent', format: 'currency' },
      { key: 'avg_current_rent', label: 'Avg Current Rent', format: 'currency' },
      { key: 'rent_variance', label: 'Rent Variance', format: 'percent', decimals: 1 },
      { key: 'optimization_potential', label: 'Optimization Potential', format: 'currency' },
      { key: 'platform_avg_rent', label: 'Platform Avg Rent', format: 'currency' },
      { key: 'total_sample_size', label: 'Sample Size', format: 'number' },
      { key: 'unit_types_analyzed', label: 'Unit Types', format: 'number' },
      { key: 'locations_analyzed', label: 'Locations', format: 'number' }
    ],
    charts: [
      { id: 'rent_comparison', type: 'bar', xKey: 'property', yKeys: ['current_rent', 'market_rent'] },
      { id: 'rent_by_type', type: 'bar', xKey: 'unit_type', yKeys: ['avg_rent', 'median_rent'] },
      { id: 'rent_by_location', type: 'bar', xKey: 'location', yKeys: ['avg_rent'] },
      { id: 'yearly_trends', type: 'line', xKey: 'year', yKeys: ['avg_rent'] },
      { id: 'variance_analysis', type: 'line', xKey: 'property', yKeys: ['variance'] }
    ],
    table: {
      columns: [
        { key: 'analysis_date', label: 'Date', align: 'left', format: 'date' },
        { key: 'property_name', label: 'Property', align: 'left' },
        { key: 'unit_type', label: 'Unit Type', align: 'left' },
        { key: 'current_rent', label: 'Current Rent', format: 'currency', align: 'right' },
        { key: 'market_rent', label: 'Market Rent', format: 'currency', align: 'right' },
        { key: 'variance', label: 'Variance', format: 'percent', align: 'right' }
      ]
    }
  },
  {
    id: 'executive-summary',
    title: 'Executive Summary Report',
    description: 'Comprehensive portfolio overview with key metrics and insights',
    defaultPeriod: 'current_period',
    roles: ['admin', 'landlord'],
    queryId: 'executive_summary',
    kpis: [
      { key: 'total_properties', label: 'Total Properties', format: 'number' },
      { key: 'total_units', label: 'Total Units', format: 'number' },
      { key: 'collection_rate', label: 'Collection Rate', format: 'percent', decimals: 1 },
      { key: 'occupancy_rate', label: 'Occupancy Rate', format: 'percent', decimals: 0 }
    ],
    charts: [
      { id: 'portfolio_overview', type: 'bar', xKey: 'month', yKeys: ['revenue', 'expenses'] },
      { id: 'property_performance', type: 'pie' }
    ],
    table: {
      columns: [
        { key: 'report_date', label: 'Date', align: 'left', format: 'date' },
        { key: 'property_name', label: 'Property', align: 'left' },
        { key: 'units', label: 'Units', format: 'number', align: 'center' },
        { key: 'revenue', label: 'Revenue', format: 'currency', align: 'right' },
        { key: 'occupancy', label: 'Occupancy', format: 'percent', decimals: 0, align: 'right' }
      ]
    }
  }
];

export const getReportConfig = (reportId: string): ReportConfig | undefined => {
  return reportConfigs.find(config => config.id === reportId);
};

export const getReportsForRole = (role: Role): ReportConfig[] => {
  return reportConfigs.filter(config => config.roles.includes(role));
};
