interface ReportKPI {
  id?: string;
  label: string;
  value: string | number;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    percentage?: number;
  };
  format?: 'currency' | 'percentage' | 'number' | 'text';
}

interface ReportChart {
  id?: string;
  type: 'line' | 'bar' | 'doughnut' | 'pie' | 'area';
  title: string;
  description?: string;
  data: any;
  options?: any;
  width?: number;
  height?: number;
}

interface ReportSection {
  title: string;
  type: 'summary' | 'kpis' | 'charts' | 'table' | 'text';
  content: any;
  pageBreakBefore?: boolean;
  pageBreakAfter?: boolean;
}

export interface ReportTemplate {
  title: string;
  subtitle?: string;
  sections: ReportSection[];
  layout: 'standard' | 'executive' | 'detailed';
}

export const REPORT_TEMPLATES: Record<string, ReportTemplate> = {
  'rent-collection': {
    title: 'Rent Collection Report',
    sections: [
      {
        title: 'Executive Summary',
        type: 'summary',
        content: 'summary'
      },
      {
        title: 'Key Performance Indicators',
        type: 'kpis',
        content: 'kpis'
      },
      {
        title: 'Collection Analytics',
        type: 'charts',
        content: 'charts'
      },
      {
        title: 'Collection Details',
        type: 'table',
        content: 'tableData',
        pageBreakBefore: true
      }
    ],
    layout: 'standard'
  },
  'outstanding-balances': {
    title: 'Outstanding Balances Report',
    sections: [
      {
        title: 'Executive Summary',
        type: 'summary',
        content: 'summary'
      },
      {
        title: 'Balance Overview',
        type: 'kpis',
        content: 'kpis'
      },
      {
        title: 'Aging Analysis',
        type: 'charts',
        content: 'charts'
      },
      {
        title: 'Outstanding Balance Details',
        type: 'table',
        content: 'tableData',
        pageBreakBefore: true
      }
    ],
    layout: 'standard'
  },
  'property-performance': {
    title: 'Property Performance Report',
    sections: [
      {
        title: 'Executive Summary',
        type: 'summary',
        content: 'summary'
      },
      {
        title: 'Performance Metrics',
        type: 'kpis',
        content: 'kpis'
      },
      {
        title: 'Revenue & Yield Analysis',
        type: 'charts',
        content: 'charts'
      },
      {
        title: 'Property Performance Details',
        type: 'table',
        content: 'tableData',
        pageBreakBefore: true
      }
    ],
    layout: 'standard'
  },
  'profit-loss': {
    title: 'Profit & Loss Report',
    sections: [
      {
        title: 'Executive Summary',
        type: 'summary',
        content: 'summary'
      },
      {
        title: 'Financial Overview',
        type: 'kpis',
        content: 'kpis'
      },
      {
        title: 'Revenue vs Expenses Trend',
        type: 'charts',
        content: 'charts'
      },
      {
        title: 'Detailed P&L Statement',
        type: 'table',
        content: 'tableData',
        pageBreakBefore: true
      }
    ],
    layout: 'standard'
  },
  'executive-summary': {
    title: 'Executive Summary Report',
    subtitle: 'Comprehensive Portfolio Overview',
    sections: [
      {
        title: 'Portfolio Overview',
        type: 'summary',
        content: 'summary'
      },
      {
        title: 'Key Performance Indicators',
        type: 'kpis',
        content: 'kpis'
      },
      {
        title: 'Portfolio Performance',
        type: 'charts',
        content: 'charts'
      },
      {
        title: 'Financial Metrics',
        type: 'table',
        content: 'tableData'
      }
    ],
    layout: 'executive'
  },
  'revenue-vs-expenses': {
    title: 'Revenue vs Expenses Analysis',
    subtitle: 'Income and Cost Comparison Report',
    sections: [
      {
        title: 'Revenue vs Expenses Overview',
        type: 'summary',
        content: 'summary'
      },
      {
        title: 'Financial Metrics',
        type: 'kpis',
        content: 'kpis'
      },
      {
        title: 'Monthly Comparison',
        type: 'charts',
        content: 'charts'
      },
      {
        title: 'Detailed Breakdown',
        type: 'table',
        content: 'tableData'
      }
    ],
    layout: 'standard'
  },
  'lease-expiry': {
    title: 'Lease Expiry Report',
    sections: [
      {
        title: 'Executive Summary',
        type: 'summary',
        content: 'summary'
      },
      {
        title: 'Expiry Overview',
        type: 'kpis',
        content: 'kpis'
      },
      {
        title: 'Expiry Timeline',
        type: 'charts',
        content: 'charts'
      },
      {
        title: 'Lease Expiry Details',
        type: 'table',
        content: 'tableData',
        pageBreakBefore: true
      }
    ],
    layout: 'standard'
  },
  'occupancy': {
    title: 'Unit Occupancy Report',
    sections: [
      {
        title: 'Executive Summary',
        type: 'summary',
        content: 'summary'
      },
      {
        title: 'Occupancy Metrics',
        type: 'kpis',
        content: 'kpis'
      },
      {
        title: 'Occupancy Trends',
        type: 'charts',
        content: 'charts'
      },
      {
        title: 'Unit Status Details',
        type: 'table',
        content: 'tableData',
        pageBreakBefore: true
      }
    ],
    layout: 'standard'
  },
  'expense-summary': {
    title: 'Expense Summary Report',
    sections: [
      {
        title: 'Executive Summary',
        type: 'summary',
        content: 'summary'
      },
      {
        title: 'Expense Overview',
        type: 'kpis',
        content: 'kpis'
      },
      {
        title: 'Expense Breakdown',
        type: 'charts',
        content: 'charts'
      },
      {
        title: 'Expense Details',
        type: 'table',
        content: 'tableData',
        pageBreakBefore: true
      }
    ],
    layout: 'standard'
  },
  'cash-flow': {
    title: 'Cash Flow Analysis',
    sections: [
      {
        title: 'Executive Summary',
        type: 'summary',
        content: 'summary'
      },
      {
        title: 'Cash Flow Metrics',
        type: 'kpis',
        content: 'kpis'
      },
      {
        title: 'Cash Flow Trends',
        type: 'charts',
        content: 'charts'
      },
      {
        title: 'Cash Flow Details',
        type: 'table',
        content: 'tableData',
        pageBreakBefore: true
      }
    ],
    layout: 'standard'
  },
  'maintenance': {
    title: 'Maintenance Analytics',
    sections: [
      {
        title: 'Executive Summary',
        type: 'summary',
        content: 'summary'
      },
      {
        title: 'Service Metrics',
        type: 'kpis',
        content: 'kpis'
      },
      {
        title: 'Maintenance Trends',
        type: 'charts',
        content: 'charts'
      },
      {
        title: 'Maintenance Details',
        type: 'table',
        content: 'tableData',
        pageBreakBefore: true
      }
    ],
    layout: 'standard'
  },
  'tenant-turnover': {
    title: 'Tenant Turnover Report',
    sections: [
      { title: 'Executive Summary', type: 'summary', content: 'summary' },
      { title: 'Turnover Metrics', type: 'kpis', content: 'kpis' },
      { title: 'Turnover Trends', type: 'charts', content: 'charts' },
      { title: 'Turnover Details', type: 'table', content: 'tableData', pageBreakBefore: true }
    ],
    layout: 'standard'
  },
  'market-rent': {
    title: 'Market Rent Analysis',
    sections: [
      { title: 'Executive Summary', type: 'summary', content: 'summary' },
      { title: 'Market Metrics', type: 'kpis', content: 'kpis' },
      { title: 'Comparative Charts', type: 'charts', content: 'charts' },
      { title: 'Market Details', type: 'table', content: 'tableData', pageBreakBefore: true }
    ],
    layout: 'standard'
  }
};

export type { ReportKPI, ReportChart, ReportSection };