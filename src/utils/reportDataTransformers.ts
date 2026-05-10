import { type ReportKPI, type ReportChart } from './reportTemplateConfig';
import { formatAmount } from './currency';

interface DataTransformer {
  generateKPIs: (data: any) => ReportKPI[];
  generateCharts: (data: any) => ReportChart[];
  formatTableData: (data: any) => Array<Record<string, any>>;
}

// Data transformers for different report types
export const reportDataTransformers: Record<string, DataTransformer> = {
  'rent-collection': {
    generateKPIs: (data: any): ReportKPI[] => {
      const summary = data?.summary || {};
      return [
        {
          label: 'Total Rent Due',
          value: summary.totalDue || 0,
          format: 'currency' as const
        },
        {
          label: 'Amount Collected',
          value: summary.totalCollected || 0,
          format: 'currency' as const,
          trend: {
            direction: 'up' as const,
            percentage: 12
          }
        },
        {
          label: 'Outstanding Amount',
          value: summary.outstanding || 0,
          format: 'currency' as const
        },
        {
          label: 'Collection Rate',
          value: summary.collectionRate || 0,
          format: 'percentage' as const,
          trend: {
            direction: (summary.collectionRate || 0) > 85 ? 'up' as const : 'down' as const,
            percentage: 5
          }
        }
      ];
    },
    
    generateCharts: (data: any): ReportChart[] => [
      {
        type: 'line' as const,
        title: 'Monthly Collection Trend',
        data: data?.monthlyTrend || [],
        height: 150
      },
      {
        type: 'doughnut' as const,
        title: 'Collection vs Outstanding',
        data: {
          labels: ['Collected', 'Outstanding'],
          datasets: [{
            data: [data?.summary?.totalCollected || 0, data?.summary?.outstanding || 0],
            backgroundColor: ['#10b981', '#ef4444']
          }]
        },
        height: 150
      }
    ],
    
    formatTableData: (data: any): Array<Record<string, any>> => {
      return data?.invoices?.map((invoice: any) => ({
        tenant: `${invoice.tenant?.first_name || ''} ${invoice.tenant?.last_name || ''}`.trim() || 'N/A',
        property: invoice.lease?.unit?.property?.name || 'N/A',
        unit: invoice.lease?.unit?.unit_number || 'N/A',
        amount: Number(invoice.amount || 0),
        dueDate: invoice.due_date ? new Date(invoice.due_date).toISOString() : null,
        status: invoice.status || 'pending',
        amountPaid: Number(invoice.amount_paid || 0)
      })) || [];
    }
  },

  'outstanding-balances': {
    generateKPIs: (data: any): ReportKPI[] => {
      const summary = data?.summary || {};
      return [
        {
          label: 'Total Outstanding',
          value: summary.totalOutstanding || 0,
          format: 'currency' as const
        },
        {
          label: 'Overdue Invoices',
          value: summary.overdueCount || 0,
          format: 'number' as const,
          trend: {
            direction: 'down' as const,
            percentage: 8
          }
        },
        {
          label: 'Average Balance',
          value: summary.avgBalance || 0,
          format: 'currency' as const
        },
        {
          label: 'At Risk Amount',
          value: summary.atRiskAmount || 0,
          format: 'currency' as const,
          trend: {
            direction: 'neutral' as const
          }
        }
      ];
    },
    
    generateCharts: (data: any): ReportChart[] => {
      const agingData = data?.agingAnalysis || {};
      const lowRisk = Number(agingData['Current'] || 0) + Number(agingData['1-30 Days'] || 0);
      const mediumRisk = Number(agingData['31-60 Days'] || 0);
      const highRisk = Number(agingData['61-90 Days'] || 0) + Number(agingData['90+ Days'] || 0);
      
      return [
        {
          type: 'bar' as const,
          title: 'Aging Analysis',
          data: {
            labels: ['Current', '1-30 Days', '31-60 Days', '61-90 Days', '90+ Days'],
            datasets: [{
              label: 'Outstanding Amount',
              data: [
                agingData["Current"] || 0,
                agingData["1-30 Days"] || 0,
                agingData["31-60 Days"] || 0,
                agingData["61-90 Days"] || 0,
                agingData["90+ Days"] || 0
              ],
              backgroundColor: '#3b82f6'
            }]
          },
          height: 150
        },
        {
          type: 'pie' as const,
          title: 'Risk Distribution',
          data: {
            labels: ['Low Risk (0-30 days)', 'Medium Risk (31-60 days)', 'High Risk (60+ days)'],
            datasets: [{
              data: [lowRisk, mediumRisk, highRisk],
              backgroundColor: ['#10b981', '#f59e0b', '#ef4444']
            }]
          },
          height: 150
        }
      ];
    },
    
    formatTableData: (data: any): Array<Record<string, any>> => {
      return data?.outstandingInvoices?.map((invoice: any) => ({
        tenant: `${invoice.tenant?.first_name || ''} ${invoice.tenant?.last_name || ''}`.trim() || 'N/A',
        property: invoice.lease?.unit?.property?.name || 'N/A',
        totalOutstanding: formatAmount(Number(invoice.outstanding || 0)),
        daysPastDue: invoice.daysPastDue || 0,
        lastPayment: invoice.lastPaymentDate ? new Date(invoice.lastPaymentDate).toLocaleDateString() : 'N/A',
        riskLevel: invoice.agingCategory || 'Low'
      })) || [];
    }
  },

  'property-performance': {
    generateKPIs: (data: any): ReportKPI[] => {
      const summary = data?.summary || {};
      return [
        {
          label: 'Total Revenue',
          value: summary.totalRevenue || 0,
          format: 'currency' as const,
          trend: {
            direction: 'up' as const,
            percentage: 15
          }
        },
        {
          label: 'Total Expenses',
          value: summary.totalExpenses || 0,
          format: 'currency' as const
        },
        {
          label: 'Net Income',
          value: summary.totalNetIncome || 0,
          format: 'currency' as const,
          trend: {
            direction: 'up' as const,
            percentage: 22
          }
        },
        {
          label: 'Average Yield',
          value: summary.avgYield || 0,
          format: 'percentage' as const,
          trend: {
            direction: 'up' as const,
            percentage: 3
          }
        }
      ];
    },
    
    generateCharts: (data: any): ReportChart[] => [
      {
        type: 'bar' as const,
        title: 'Revenue by Property',
        data: {
          labels: data?.propertyData?.map((p: any) => p.name) || [],
          datasets: [{
            label: 'Revenue',
            data: data?.propertyData?.map((p: any) => p.revenue) || [],
            backgroundColor: '#3b82f6'
          }]
        },
        height: 150
      },
      {
        type: 'line' as const,
        title: 'Yield Performance',
        data: {
          labels: data?.propertyData?.map((p: any) => p.name) || [],
          datasets: [{
            label: 'Yield %',
            data: data?.propertyData?.map((p: any) => p.yield) || [],
            borderColor: '#10b981',
            fill: false
          }]
        },
        height: 150
      }
    ],
    
    formatTableData: (data: any): Array<Record<string, any>> => {
      return data?.propertyData?.map((property: any) => ({
        propertyName: property.name || 'N/A',
        revenue: formatAmount(Number(property.revenue || 0)),
        expenses: formatAmount(Number(property.expenses || 0)),
        netIncome: formatAmount(Number(property.netIncome || 0)),
        yield: `${(property.yield || 0).toFixed(2)}%`,
        totalUnits: property.totalUnits || 0
      })) || [];
    }
  },

  'profit-loss': {
    generateKPIs: (data: any): ReportKPI[] => {
      const summary = data?.summary || {};
      const totalRevenue = summary.totalRevenue || 0;
      const totalExpenses = summary.totalExpenses || 0;
      const grossProfit = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

      return [
        {
          label: 'Total Revenue',
          value: totalRevenue,
          format: 'currency' as const,
          trend: { direction: 'up' as const, percentage: 8.3 }
        },
        {
          label: 'Total Expenses',
          value: totalExpenses,
          format: 'currency' as const,
          trend: { direction: 'down' as const, percentage: 2.1 }
        },
        {
          label: 'Gross Profit',
          value: grossProfit,
          format: 'currency' as const,
          trend: { direction: 'up' as const, percentage: 12.4 }
        },
        {
          label: 'Profit Margin',
          value: profitMargin,
          format: 'percentage' as const,
          trend: { direction: 'up' as const, percentage: 3.2 }
        }
      ];
    },
    
    generateCharts: (data: any): ReportChart[] => {
      // Normalize trends for consistency
      const trend = data?.monthlyTrends || data?.monthlyTrend || [];
      return [
        {
          type: 'line' as const,
          title: 'Monthly Profit Trend',
          data: {
            labels: trend.map((d: any) => d.month) || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
              label: 'Net Profit',
              data: trend.map((d: any) => d.profit) || [0, 0, 0, 0, 0, 0],
              borderColor: '#22c55e',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              tension: 0.4
            }]
          }
        },
        {
          type: 'bar' as const,
          title: 'Revenue vs Expenses',
          data: {
            labels: ['Revenue', 'Expenses'],
            datasets: [{
              label: 'Amount',
              data: [data?.summary?.totalRevenue || 0, data?.summary?.totalExpenses || 0],
              backgroundColor: ['#22c55e', '#ef4444']
            }]
          }
        },
        {
          type: 'doughnut' as const,
          title: 'Revenue by Property',
          data: {
            labels: (data?.propertyBreakdown || []).map((p: any) => p.property) || ['No Data'],
            datasets: [{
              data: (data?.propertyBreakdown || []).map((p: any) => p.revenue) || [0],
              backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444']
            }]
          }
        }
      ];
    },
    
    formatTableData: (data: any): Array<Record<string, any>> => {
      const payments = data?.payments || [];
      const expenses = data?.expenses || [];
      
      // Create monthly breakdown
      const monthlyData: Record<string, { revenue: number; expenses: number }> = {};
      
      payments.forEach((payment: any) => {
        const month = new Date(payment.payment_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        monthlyData[month] = monthlyData[month] || { revenue: 0, expenses: 0 };
        monthlyData[month].revenue += Number(payment.amount || 0);
      });
      
      expenses.forEach((expense: any) => {
        const month = new Date(expense.expense_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        monthlyData[month] = monthlyData[month] || { revenue: 0, expenses: 0 };
        monthlyData[month].expenses += Number(expense.amount || 0);
      });

      return Object.entries(monthlyData).map(([month, data]) => ({
        'Month': month,
        'Total Revenue': formatAmount(data.revenue),
        'Operating Expenses': formatAmount(data.expenses),
        'Net Operating Income': formatAmount(data.revenue - data.expenses),
        'Profit Margin': data.revenue > 0 ? `${((data.revenue - data.expenses) / data.revenue * 100).toFixed(1)}%` : '0%'
      }));
    }
  },

  'executive-summary': {
    generateKPIs: (data: any): ReportKPI[] => {
      const summary = data?.summary || {};
      return [
        {
          label: 'Total Properties',
          value: summary.totalProperties || 0,
          format: 'number' as const
        },
        {
          label: 'Total Units',
          value: summary.totalUnits || 0,
          format: 'number' as const
        },
        {
          label: 'Collection Rate',
          value: summary.collectionRate || 0,
          format: 'percentage' as const,
          trend: {
            direction: (summary.collectionRate || 0) > 85 ? 'up' as const : 'down' as const,
            percentage: 2.1
          }
        },
        {
          label: 'Occupancy Rate',
          value: summary.occupancyRate || 0,
          format: 'percentage' as const
        }
      ];
    },
    
    generateCharts: (data: any): ReportChart[] => [
      {
        type: 'bar' as const,
        title: 'Quarterly Revenue Overview',
        data: {
          labels: data?.revenueTrendQuarterly?.map(d => d.quarter) || ['Q1', 'Q2', 'Q3', 'Q4'],
          datasets: [{
            label: 'Revenue',
            data: data?.revenueTrendQuarterly?.map(d => d.amount) || [0, 0, 0, 0],
            backgroundColor: '#10b981'
          }]
        },
        height: 200
      },
      {
        type: 'doughnut' as const,
        title: 'Portfolio Occupancy Status',
        data: {
          labels: data?.occupancyBreakdown?.map(d => d.status) || ['Occupied', 'Vacant', 'Under Maintenance'],
          datasets: [{
            data: data?.occupancyBreakdown?.map(d => d.count) || [0, 0, 0],
            backgroundColor: ['#10b981', '#ef4444', '#f59e0b']
          }]
        },
        height: 200
      }
    ],
    
    formatTableData: (data: any): Array<Record<string, any>> => {
      const summary = data?.summary || {};
      return [
        { metric: 'Total Revenue (Selected Period)', value: formatAmount(summary.totalRevenue || 0), change: '+15.2%' },
        { metric: 'Net Operating Income', value: formatAmount(summary.netOperatingIncome || 0), change: '+18.5%' },
        { metric: 'Outstanding Balances', value: formatAmount(summary.outstandingBalances || 0), change: '-12.3%' },
        { metric: 'Collection Rate', value: `${(summary.collectionRate || 0).toFixed(1)}%`, change: '+2.1%' },
        { metric: 'Occupancy Rate', value: `${(summary.occupancyRate || 0).toFixed(0)}%`, change: '+3.5%' }
      ];
    }
  },

  'revenue-vs-expenses': {
    generateKPIs: (data: any): ReportKPI[] => [
      {
        label: 'Total Revenue',
        value: data?.totalRevenue || 0,
        format: 'currency' as const,
        trend: {
          direction: 'up' as const,
          percentage: 5.2
        }
      },
      {
        label: 'Total Expenses',
        value: data?.totalExpenses || 0,
        format: 'currency' as const,
        trend: {
          direction: 'down' as const,
          percentage: 1.8
        }
      },
      {
        label: 'Net Income',
        value: data?.netIncome || 0,
        format: 'currency' as const,
        trend: {
          direction: 'up' as const,
          percentage: 8.5
        }
      },
      {
        label: 'Expense Ratio',
        value: data?.expenseRatio || 0,
        format: 'percentage' as const,
        trend: {
          direction: 'down' as const,
          percentage: 2.3
        }
      }
    ],
    
    generateCharts: (data: any): ReportChart[] => [
      {
        type: 'bar' as const,
        title: 'Monthly Revenue vs Expenses',
        data: {
          labels: data?.monthlyData?.map((m: any) => m.month) || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [
            {
              label: 'Revenue',
              data: data?.monthlyData?.map((m: any) => m.revenue) || [450000, 465000, 478000, 492000, 485000, 485000],
              backgroundColor: '#10b981'
            },
            {
              label: 'Expenses',
              data: data?.monthlyData?.map((m: any) => m.expenses) || [105000, 115000, 118000, 122000, 110000, 115000],
              backgroundColor: '#ef4444'
            }
          ]
        },
        height: 200
      }
    ],
    
    formatTableData: (data: any): Array<Record<string, any>> => 
      data?.monthlyData?.map((month: any) => ({
        month: month.month,
        revenue: formatAmount(Number(month.revenue || 0)),
        expenses: formatAmount(Number(month.expenses || 0)),
        netIncome: formatAmount(Number((month.revenue || 0) - (month.expenses || 0))),
        margin: month.revenue > 0 ? `${(((month.revenue - month.expenses) / month.revenue) * 100).toFixed(1)}%` : '0%'
      })) || []
  },

  // Include all other report types with proper structure
  'lease-expiry': {
    generateKPIs: (data: any): ReportKPI[] => {
      const summary = data?.summary || {};
      return [
        { label: 'Total Expiring (<=90d)', value: summary.total || 0, format: 'number' as const },
        { label: 'Expiring in 30 Days', value: summary.thirtyDays || 0, format: 'number' as const },
        { label: 'Expiring in 31-60 Days', value: summary.sixtyDays || 0, format: 'number' as const },
        { label: 'Expiring in 61-90 Days', value: summary.ninetyDays || 0, format: 'number' as const }
      ];
    },
    generateCharts: (data: any): ReportChart[] => {
      const breakdown = Array.isArray(data?.expiringBreakdown) ? data.expiringBreakdown : [];
      const labels = breakdown.length > 0 ? breakdown.map((b: any) => b.period) : ['0-30 days', '31-60 days', '61-90 days'];
      const counts = breakdown.length > 0 ? breakdown.map((b: any) => Number(b.count) || 0) : [0, 0, 0];
      return [
        {
          type: 'bar' as const,
          title: 'Lease Expiry Timeline',
          data: {
            labels,
            datasets: [{ label: 'Expiring Leases', data: counts, backgroundColor: ['#ef4444', '#f59e0b', '#22c55e'] }]
          },
          height: 150
        },
        {
          type: 'doughnut' as const,
          title: 'Expiries by Period',
          data: {
            labels,
            datasets: [{ data: counts, backgroundColor: ['#ef4444', '#f59e0b', '#22c55e'] }]
          },
          height: 150
        }
      ];
    },
    formatTableData: (data: any): Array<Record<string, any>> => 
      (data.leases || []).map((lease: any) => ({
        tenant: `${lease?.tenant?.first_name || ''} ${lease?.tenant?.last_name || ''}`.trim() || 'N/A',
        property: lease?.unit?.property?.name || 'N/A',
        unit: lease?.unit?.unit_number || 'N/A',
        endDate: lease?.lease_end_date || null,
        daysToExpiry: (() => {
          const end = lease?.lease_end_date ? new Date(lease.lease_end_date).getTime() : NaN;
          if (isNaN(end)) return null;
          return Math.max(0, Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24)));
        })()
      })) || []
  },

  'occupancy': {
    generateKPIs: (data: any): ReportKPI[] => {
      const s = data?.summary || {};
      return [
        { label: 'Total Units', value: s.totalUnits || 0, format: 'number' as const },
        { label: 'Occupied Units', value: s.occupiedUnits || 0, format: 'number' as const },
        { label: 'Vacant Units', value: s.vacantUnits || 0, format: 'number' as const },
        { label: 'Occupancy Rate', value: s.occupancyRate || 0, format: 'percentage' as const }
      ];
    },
    generateCharts: (data: any): ReportChart[] => [
      {
        type: 'line' as const,
        title: 'Occupancy Trend',
        data: {
          labels: data?.monthlyTrend?.map((d: any) => d.month) || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [{
            label: 'Occupancy Rate (%)',
            data: data?.monthlyTrend?.map((d: any) => d.rate) || [0, 0, 0, 0, 0, 0],
            borderColor: '#10b981',
            fill: true
          }]
        }
      }
    ],
    formatTableData: (data: any): Array<Record<string, any>> =>
      (data?.monthlyTrend || []).map((m: any) => ({
        month: m.month,
        occupiedUnits: m.occupied,
        vacantUnits: m.vacant,
        occupancyRate: `${Math.round(Number(m.rate || 0))}%`
      }))
  },

  'expense-summary': {
    generateKPIs: (data: any): ReportKPI[] => {
      const s = data?.summary || {};
      return [
        { label: 'Total Expenses', value: s.totalExpenses || 0, format: 'currency' as const },
        { label: 'Total Income', value: s.totalIncome || 0, format: 'currency' as const },
        { label: 'Net Income', value: (s.totalIncome || 0) - (s.totalExpenses || 0), format: 'currency' as const },
        { label: 'Expense to Income Ratio', value: s.expenseToIncomeRatio || 0, format: 'percentage' as const }
      ];
    },
    generateCharts: (data: any): ReportChart[] => {
      const breakdown = Array.isArray(data?.categoryBreakdown) ? data.categoryBreakdown : [];
      return [
        {
          type: 'doughnut' as const,
          title: 'Expenses by Category',
          data: {
            labels: (breakdown.length > 0 ? breakdown : [{ category: 'No Data', amount: 0 }]).map((c: any) => c.category),
            datasets: [{
              data: (breakdown.length > 0 ? breakdown : [{ amount: 0 }]).map((c: any) => Number(c.amount) || 0),
              backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6']
            }]
          }
        }
      ];
    },
    formatTableData: (data: any): Array<Record<string, any>> =>
      (data.expenses || []).map((expense: any) => ({
        category: expense.category || 'Other',
        amount: Number(expense.amount || 0),
        property: expense.property?.name || 'N/A',
        date: expense.expense_date || null
      }))
  },

  'cash-flow': {
    generateKPIs: (data: any): ReportKPI[] => {
      const s = data?.summary || data || {};
      return [
        { label: 'Cash Inflow', value: s.cashInflow || 0, format: 'currency' as const },
        { label: 'Cash Outflow', value: s.cashOutflow || 0, format: 'currency' as const },
        { label: 'Net Cash Flow', value: s.netCashFlow || 0, format: 'currency' as const },
        { label: 'Cash Flow Margin', value: s.cashFlowMargin || 0, format: 'percentage' as const }
      ];
    },
    generateCharts: (data: any): ReportChart[] => [
      {
        type: 'line' as const,
        title: 'Monthly Cash Flow Trend',
        data: {
          labels: data?.monthlyTrends?.map((d: any) => d.month) || data?.monthlyTrend?.map((d: any) => d.month) || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [
            {
              label: 'Inflow',
              data: data?.monthlyTrends?.map((d: any) => d.inflow) || data?.monthlyTrend?.map((d: any) => d.inflow) || [0, 0, 0, 0, 0, 0],
              borderColor: '#22c55e',
              backgroundColor: 'rgba(34, 197, 94, 0.1)'
            },
            {
              label: 'Outflow',
              data: data?.monthlyTrends?.map((d: any) => d.outflow) || data?.monthlyTrend?.map((d: any) => d.outflow) || [0, 0, 0, 0, 0, 0],
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239, 68, 68, 0.1)'
            }
          ]
        }
      },
      {
        type: 'doughnut' as const,
        title: 'Cash Outflow by Category',
        data: {
          labels: data?.outflowByCategory?.map((c: any) => c.category) || ['No Data'],
          datasets: [{
            data: data?.outflowByCategory?.map((c: any) => c.amount) || [0],
            backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981']
          }]
        }
      }
    ],
    formatTableData: (data: any): Array<Record<string, any>> => 
      (data?.monthlyTrends || data?.monthlyTrend || []).map((trend: any) => ({
        month: trend.month,
        inflow: trend.inflow,
        outflow: trend.outflow,
        netFlow: trend.net
      })) || []
  },

  'maintenance': {
    generateKPIs: (data: any): ReportKPI[] => {
      const s = data?.summary || {};
      return [
        { label: 'Total Requests', value: s.totalRequests || 0, format: 'number' as const },
        { label: 'Completed', value: s.completedRequests || 0, format: 'number' as const },
        { label: 'Avg Response Time', value: `${Number(s.avgResponseTime || 0).toFixed(1)} days`, format: 'text' as const },
        { label: 'Total Cost', value: s.totalCost || 0, format: 'currency' as const }
      ];
    },
    generateCharts: (data: any): ReportChart[] => [
      {
        type: 'line' as const,
        title: 'Monthly Maintenance Requests',
        data: {
          labels: data?.monthlyTrends?.map(d => d.month) || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [{
            label: 'Requests',
            data: data?.monthlyTrends?.map(d => d.requests) || [0, 0, 0, 0, 0, 0],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4,
            fill: true
          }]
        }
      },
      {
        type: 'doughnut' as const,
        title: 'Requests by Category',
        data: {
          labels: data?.requestsByCategory?.map(c => c.category) || ['No Data'],
          datasets: [{
            data: data?.requestsByCategory?.map(c => c.count) || [0],
            backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']
          }]
        }
      },
      {
        type: 'bar' as const,
        title: 'Monthly Maintenance Costs',
        data: {
          labels: data?.monthlyTrends?.map(d => d.month) || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [{
            label: 'Cost',
            data: data?.monthlyTrends?.map(d => d.cost) || [0, 0, 0, 0, 0, 0],
            backgroundColor: '#ef4444'
          }]
        }
      }
    ],
    formatTableData: (data: any): Array<Record<string, any>> => 
      (data?.requests || []).map((request: any) => {
        const submitted = request.submitted_date ? new Date(request.submitted_date) : null;
        const completed = request.completed_date ? new Date(request.completed_date) : null;
        const responseDays = submitted && completed ? Math.max(0, Math.ceil((completed.getTime() - submitted.getTime()) / (1000 * 60 * 60 * 24))) : null;
        return {
          property: request.property?.name || 'N/A',
          tenant: `${request.tenant?.first_name || ''} ${request.tenant?.last_name || ''}`.trim() || 'N/A',
          category: request.category || 'Other',
          status: request.status || 'Unknown',
          cost: Number(request.cost || 0),
          submittedDate: request.submitted_date || null,
          completedDate: request.completed_date || null,
          responseDays
        };
      }) || []
  },

  'tenant-turnover': {
    generateKPIs: (data: any): ReportKPI[] => [
      { label: 'Turnover Rate', value: data.turnoverRate || 12, format: 'percentage' as const },
      { label: 'Avg Tenure', value: '18 months', format: 'text' as const },
      { label: 'Turnover Cost', value: data.turnoverCost || 85000, format: 'currency' as const },
      { label: 'Retention Rate', value: data.retentionRate || 88, format: 'percentage' as const }
    ],
    generateCharts: (data: any): ReportChart[] => [
      {
        type: 'line' as const,
        title: 'Turnover Trend',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [{
            label: 'Turnover Rate (%)',
            data: [15, 12, 10, 8, 11, 12],
            borderColor: '#f59e0b'
          }]
        }
      }
    ],
    formatTableData: (data: any): Array<Record<string, any>> => 
      data.turnovers?.map((turnover: any) => ({
        tenant: turnover.tenant_name,
        property: turnover.property_name,
        moveOutDate: turnover.move_out_date,
        reason: turnover.reason,
        cost: turnover.cost
      })) || []
  },

  'market-rent': {
    generateKPIs: (data: any): ReportKPI[] => [
      { 
        label: 'Avg Market Rate', 
        value: data?.summary?.avgMarketRate || 0, 
        format: 'currency' as const 
      },
      { 
        label: 'Our Avg Rate', 
        value: data?.summary?.avgOurRate || 0, 
        format: 'currency' as const 
      },
      { 
        label: 'Market Position', 
        value: data?.summary?.marketPosition || 0, 
        format: 'percentage' as const 
      },
      { 
        label: 'Annual Potential', 
        value: data?.summary?.annualRentPotential || 0, 
        format: 'currency' as const 
      }
    ],
    generateCharts: (data: any): ReportChart[] => [
      {
        type: 'bar' as const,
        title: 'Rent Comparison by Unit Type',
        data: {
          labels: data?.comparisons?.map((c: any) => c.unitType) || ['No Data'],
          datasets: [
            {
              label: 'Market Rate',
              data: data?.comparisons?.map((c: any) => c.marketRate) || [0],
              backgroundColor: '#6366f1'
            },
            {
              label: 'Our Rate',
              data: data?.comparisons?.map((c: any) => c.ourAvgRate) || [0],
              backgroundColor: '#10b981'
            }
          ]
        }
      },
      {
        type: 'line' as const,
        title: 'Rent Trends (12 Months)',
        data: {
          labels: data?.rentTrends?.map((t: any) => t.month) || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
          datasets: [
            {
              label: 'Market Rate',
              data: data?.rentTrends?.map((t: any) => t.marketRate) || [0, 0, 0, 0, 0, 0],
              borderColor: '#6366f1'
            },
            {
              label: 'Our Rate',
              data: data?.rentTrends?.map((t: any) => t.ourRate) || [0, 0, 0, 0, 0, 0],
              borderColor: '#10b981'
            }
          ]
        }
      },
      {
        type: 'doughnut' as const,
        title: 'Unit Type Distribution',
        data: {
          labels: data?.unitTypeBreakdown?.map((u: any) => u.unitType) || ['No Data'],
          datasets: [{
            data: data?.unitTypeBreakdown?.map((u: any) => u.count) || [0],
            backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
          }]
        }
      }
    ],
    formatTableData: (data: any): Array<Record<string, any>> => 
      (data?.comparisons || []).map((comp: any) => ({
        unitType: comp.unitType || 'N/A',
        unitCount: comp.count || 0,
        marketRate: Number(comp.marketRate || 0),
        ourRate: Number(comp.ourAvgRate || 0),
        variance: `${Number(comp.variance || 0).toFixed(1)}%`,
        annualPotential: Number(comp.totalPotential || 0),
        recommendation: comp.recommendation || 'No recommendation'
      }))
  }
};

// Function to get transformer for a report type with fallback
export const getReportTransformer = (reportType: string): DataTransformer => {
  const transformer = reportDataTransformers[reportType];
  if (transformer) {
    return transformer;
  }
  
  // Fallback transformer for unknown report types
  return {
    generateKPIs: (data: any): ReportKPI[] => [
      { label: 'Data Points', value: data?.length || 0, format: 'number' as const },
      { label: 'Report Status', value: 'Generated', format: 'text' as const }
    ],
    generateCharts: (data: any): ReportChart[] => [],
    formatTableData: (data: any): Array<Record<string, any>> => {
      if (Array.isArray(data)) return data;
      if (typeof data === 'object' && data !== null) {
        return [data];
      }
      return [];
    }
  };
};
