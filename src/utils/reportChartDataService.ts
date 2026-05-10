import { ReportChart, ReportKPI } from './reportTemplateConfig';
import { formatAmount } from './currency';

export interface ChartDataPoint {
  label: string;
  value: number;
  metadata?: any;
}

export interface TimeSeriesData {
  date: string;
  value: number;
  category?: string;
}

export class ReportChartDataService {
  /**
   * Generate charts based on report type and available data
   */
  static generateChartsForReport(
    reportType: string, 
    tableData: Array<Record<string, any>> = [], 
    kpis: ReportKPI[] = [],
    sourceData?: any
  ): ReportChart[] {
    console.log(`📊 ReportChartDataService.generateChartsForReport called:`, {
      reportType,
      tableDataLength: tableData.length,
      kpisLength: kpis.length,
      sourceDataKeys: sourceData ? Object.keys(sourceData) : 'no sourceData'
    });
    
    const charts: ReportChart[] = [];

    switch (reportType) {
      case 'rent-collection':
        charts.push(...this.createRentCollectionCharts(tableData, kpis, sourceData));
        break;
      case 'revenue-expenses':
      case 'revenue-vs-expenses':
        charts.push(...this.createRevenueExpenseCharts(tableData, kpis, sourceData));
        break;
      case 'maintenance':
        charts.push(...this.createMaintenanceCharts(tableData, kpis, sourceData));
        break;
      case 'occupancy':
        charts.push(...this.createOccupancyCharts(tableData, kpis, sourceData));
        break;
      case 'lease-expiry':
        charts.push(...this.createLeaseExpiryCharts(tableData, kpis, sourceData));
        break;
      case 'financial-summary':
      case 'executive-summary':
        charts.push(...this.createFinancialSummaryCharts(tableData, kpis, sourceData));
        break;
      case 'outstanding-balances':
        charts.push(...this.createOutstandingBalancesCharts(tableData, kpis, sourceData));
        break;
      case 'property-performance':
        charts.push(...this.createPropertyPerformanceCharts(tableData, kpis, sourceData));
        break;
      case 'profit-loss':
        charts.push(...this.createProfitLossCharts(tableData, kpis, sourceData));
        break;
      case 'expense-summary':
        charts.push(...this.createExpenseSummaryCharts(tableData, kpis, sourceData));
        break;
      case 'cash-flow':
        charts.push(...this.createCashFlowCharts(tableData, kpis, sourceData));
        break;
      case 'market-rent':
        charts.push(...this.createMarketRentCharts(reportType, sourceData, tableData));
        break;
      default:
        // Generic charts for unknown report types
        charts.push(...this.createGenericCharts(tableData, kpis));
    }

    return charts.filter(chart => this.hasValidData(chart));
  }

  private static createRentCollectionCharts(tableData: Array<Record<string, any>>, kpis: ReportKPI[], sourceData?: any): ReportChart[] {
    const charts: ReportChart[] = [];

    // Monthly collection trend - use pre-aggregated data if available
    console.log('🏠 createRentCollectionCharts called with:', { 
      dataLength: tableData.length, 
      sampleData: tableData.slice(0, 2),
      sourceDataTrend: sourceData?.monthlyTrend?.length || 0
    });
    
    let monthlyData;
    if (sourceData?.monthlyTrend && sourceData.monthlyTrend.length > 0) {
      // Use pre-aggregated monthly trend data
      monthlyData = sourceData.monthlyTrend.map((item: any) => ({
        label: item.month || item.label,
        value: item.amount || item.value || item.collected || 0
      }));
      console.log('📊 Using pre-aggregated monthly trend data:', monthlyData);
    } else {
      // Fallback to aggregating table data
      monthlyData = this.aggregateByMonth(tableData, 'dueDate', 'amount');
      console.log('📊 Fallback: aggregated table data result:', monthlyData);
    }
    if (monthlyData.length > 0) {
      charts.push({
        id: 'monthly-collection-trend',
        title: 'Monthly Rent Collection Trend',
        type: 'line',
        data: {
          labels: monthlyData.map(d => d.label),
          datasets: [{
            label: 'Collections',
            data: monthlyData.map(d => d.value),
            fill: false,
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function(value: any) {
                  return formatAmount(value);
                }
              }
            }
          }
        }
      });
    }

    // Collection status breakdown
    const statusData = this.aggregateByCategory(tableData, 'status', 'amount');
    if (statusData.length > 0) {
      charts.push({
        id: 'collection-status',
        title: 'Collection Status Breakdown',
        type: 'doughnut',
        data: {
          labels: statusData.map(d => this.formatStatusLabel(d.label)),
          datasets: [{
            data: statusData.map(d => d.value),
            borderWidth: 2
          }]
        },
        options: {
          plugins: {
            legend: {
              position: 'bottom' as const
            }
          }
        }
      });
    }

    return charts;
  }

  private static createRevenueExpenseCharts(tableData: Array<Record<string, any>>, kpis: ReportKPI[], sourceData?: any): ReportChart[] {
    const charts: ReportChart[] = [];

    // Revenue vs Expenses over time - use pre-aggregated data if available
    let revenueData, expenseData;
    
    if (sourceData?.monthlyData && Array.isArray(sourceData.monthlyData)) {
      // Use pre-aggregated monthly revenue/expense data
      revenueData = sourceData.monthlyData.map((item: any) => ({
        label: item.month || item.label,
        value: item.revenue || item.income || 0
      }));
      expenseData = sourceData.monthlyData.map((item: any) => ({
        label: item.month || item.label,
        value: item.expenses || item.expense || 0
      }));
    } else {
      // Fallback to table data aggregation
      revenueData = this.aggregateByMonth(
        tableData.filter(row => row.type === 'revenue' || row.amount > 0), 
        'date', 
        'amount'
      );
      expenseData = this.aggregateByMonth(
        tableData.filter(row => row.type === 'expense' || row.amount < 0), 
        'date', 
        'amount'
      );
    }

    if (revenueData.length > 0 || expenseData.length > 0) {
      const allMonths = [...new Set([...revenueData.map(d => d.label), ...expenseData.map(d => d.label)])].sort();
      
      charts.push({
        id: 'revenue-vs-expenses',
        title: 'Revenue vs Expenses Trend',
        type: 'bar',
        data: {
          labels: allMonths,
          datasets: [
            {
              label: 'Revenue',
              data: allMonths.map(month => {
                const dataPoint = revenueData.find(d => d.label === month);
                return dataPoint ? Math.abs(dataPoint.value) : 0;
              }),
            },
            {
              label: 'Expenses',
              data: allMonths.map(month => {
                const dataPoint = expenseData.find(d => d.label === month);
                return dataPoint ? Math.abs(dataPoint.value) : 0;
              }),
            }
          ]
        },
        options: {
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function(value: any) {
                  return formatAmount(value);
                }
              }
            }
          }
        }
      });
    }

    return charts;
  }

  private static createMaintenanceCharts(tableData: Array<Record<string, any>>, kpis: ReportKPI[], sourceData?: any): ReportChart[] {
    const charts: ReportChart[] = [];

    // 1) Requests by Category (prefer sourceData.requestsByCategory)
    let categoryData;
    if (Array.isArray(sourceData?.requestsByCategory)) {
      categoryData = sourceData.requestsByCategory.map((item: any) => ({
        label: item.category || item.label,
        value: Number(item.count ?? item.value ?? 0)
      }));
    } else {
      categoryData = this.aggregateByCategory(tableData, 'category', undefined, true);
    }
    if (categoryData.length > 0) {
      charts.push({
        id: 'maintenance-by-category',
        title: 'Maintenance Requests by Category',
        type: 'bar',
        data: {
          labels: categoryData.map(d => this.formatCategoryLabel(d.label)),
          datasets: [{
            label: 'Requests',
            data: categoryData.map(d => d.value)
          }]
        },
        options: {
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 } }
          }
        }
      });
    }

    // 2) Status Distribution (prefer sourceData.statusDistribution)
    if (Array.isArray(sourceData?.statusDistribution) && sourceData.statusDistribution.length > 0) {
      charts.push({
        id: 'maintenance-status-distribution',
        title: 'Request Status Distribution',
        type: 'doughnut',
        data: {
          labels: sourceData.statusDistribution.map((s: any) => this.formatStatusLabel(s.status || s.label)),
          datasets: [{
            data: sourceData.statusDistribution.map((s: any) => Number(s.count ?? s.value ?? 0)),
            borderWidth: 2
          }]
        },
        options: { plugins: { legend: { position: 'bottom' as const } } }
      });
    }

    // 2b) Priority Distribution (if available)
    if (Array.isArray(sourceData?.priorityDistribution) && sourceData.priorityDistribution.length > 0) {
      charts.push({
        id: 'maintenance-priority-distribution',
        title: 'Priority Distribution',
        type: 'doughnut',
        data: {
          labels: sourceData.priorityDistribution.map((p: any) => (p.priority || 'unknown').toString().toUpperCase()),
          datasets: [{
            data: sourceData.priorityDistribution.map((p: any) => Number(p.count ?? 0)),
            borderWidth: 2
          }]
        },
        options: { plugins: { legend: { position: 'bottom' as const } } }
      });
    }

    // 3) Monthly Trend (prefer sourceData.monthlyTrends)
    let monthlyRequests: Array<{ label: string; value: number }> = [];
    if (Array.isArray(sourceData?.monthlyTrends) && sourceData.monthlyTrends.length > 0) {
      monthlyRequests = sourceData.monthlyTrends.map((m: any) => ({
        label: m.month || m.label,
        value: Number(m.requests ?? m.value ?? 0)
      }));
    } else {
      // Fallback to aggregating table data
      monthlyRequests = this.aggregateByMonth(tableData, 'submittedDate', undefined, true);
    }
    if (monthlyRequests.length > 0) {
      charts.push({
        id: 'monthly-maintenance-trend',
        title: 'Monthly Maintenance Requests',
        type: 'line',
        data: {
          labels: monthlyRequests.map(d => d.label),
          datasets: [{
            label: 'Requests',
            data: monthlyRequests.map(d => d.value),
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
      });
    }

    // 3b) Completion Rate Trend (if available)
    if (Array.isArray(sourceData?.monthlyTrends) && sourceData.monthlyTrends.some((m: any) => typeof m.completionRate === 'number')) {
      charts.push({
        id: 'maintenance-completion-rate-trend',
        title: 'Completion Rate Trend',
        type: 'line',
        data: {
          labels: sourceData.monthlyTrends.map((m: any) => m.month || m.label),
          datasets: [{
            label: 'Completion Rate (%)',
            data: sourceData.monthlyTrends.map((m: any) => Number(m.completionRate || 0)),
            fill: true,
            tension: 0.3
          }]
        },
        options: { scales: { y: { beginAtZero: true, max: 100 } } }
      });
    }

    // 3c) Avg Response Time Trend (if available)
    if (Array.isArray(sourceData?.monthlyTrends) && sourceData.monthlyTrends.some((m: any) => typeof m.avgResponseTime === 'number')) {
      charts.push({
        id: 'maintenance-response-time-trend',
        title: 'Average Response Time (days)',
        type: 'line',
        data: {
          labels: sourceData.monthlyTrends.map((m: any) => m.month || m.label),
          datasets: [{
            label: 'Avg Days',
            data: sourceData.monthlyTrends.map((m: any) => Number(m.avgResponseTime || 0)),
            fill: true,
            tension: 0.3
          }]
        },
        options: { scales: { y: { beginAtZero: true } } }
      });
    }

    // 4) Monthly Costs (if available)
    if (Array.isArray(sourceData?.monthlyTrends) && sourceData.monthlyTrends.some((m: any) => Number(m.cost) > 0)) {
      charts.push({
        id: 'monthly-maintenance-costs',
        title: 'Monthly Maintenance Costs',
        type: 'bar',
        data: {
          labels: sourceData.monthlyTrends.map((m: any) => m.month || m.label),
          datasets: [{
            label: 'Cost',
            data: sourceData.monthlyTrends.map((m: any) => Number(m.cost) || 0)
          }]
        },
        options: {
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (value: any) => formatAmount(Number(value)) }
            }
          }
        }
      });
    }

    // 4b) Cost by Category (if available)
    if (Array.isArray(sourceData?.costByCategory) && sourceData.costByCategory.some((c: any) => Number(c.amount) > 0)) {
      charts.push({
        id: 'maintenance-cost-by-category',
        title: 'Cost by Category',
        type: 'doughnut',
        data: {
          labels: sourceData.costByCategory.map((c: any) => this.formatCategoryLabel(c.category || c.label)),
          datasets: [{
            data: sourceData.costByCategory.map((c: any) => Number(c.amount) || 0)
          }]
        },
        options: { plugins: { legend: { position: 'bottom' as const } } }
      });
    }

    // 4c) Top Properties by Cost (if available)
    if (Array.isArray(sourceData?.topPropertiesByCost) && sourceData.topPropertiesByCost.length > 0) {
      charts.push({
        id: 'maintenance-top-properties-cost',
        title: 'Top Properties by Maintenance Cost',
        type: 'bar',
        data: {
          labels: sourceData.topPropertiesByCost.map((p: any) => p.property || p.label),
          datasets: [{
            label: 'Cost',
            data: sourceData.topPropertiesByCost.map((p: any) => Number(p.amount) || 0)
          }]
        },
        options: {
          scales: { y: { beginAtZero: true, ticks: { callback: (v: any) => formatAmount(Number(v)) } } }
        }
      });
    }

    return charts;
  }

  private static createOccupancyCharts(tableData: Array<Record<string, any>>, kpis: ReportKPI[], sourceData?: any): ReportChart[] {
    const charts: ReportChart[] = [];

    // Occupancy rate over time - use pre-aggregated data if available
    let occupancyData;
    if (sourceData?.monthlyTrend && sourceData.monthlyTrend.length > 0) {
      occupancyData = sourceData.monthlyTrend.map((item: any) => ({
        label: item.month || item.label,
        value: item.occupancyRate || item.value || 0
      }));
    } else {
      occupancyData = this.aggregateByMonth(tableData, 'date', 'occupancyRate');
    }
    if (occupancyData.length > 0) {
      charts.push({
        id: 'occupancy-trend',
        title: 'Occupancy Rate Trend',
        type: 'line',
        data: {
          labels: occupancyData.map(d => d.label),
          datasets: [{
            label: 'Occupancy Rate (%)',
            data: occupancyData.map(d => d.value),
            fill: true,
            tension: 0.3
          }]
        },
        options: {
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: {
                callback: function(value: any) {
                  return value + '%';
                }
              }
            }
          }
        }
      });
    }

    return charts;
  }

  private static createLeaseExpiryCharts(tableData: Array<Record<string, any>>, kpis: ReportKPI[], sourceData?: any): ReportChart[] {
    const charts: ReportChart[] = [];

    // Prefer explicit breakdown from source data when available
    if (Array.isArray(sourceData?.expiringBreakdown) && sourceData.expiringBreakdown.length > 0) {
      const labels = sourceData.expiringBreakdown.map((b: any) => b.period || '');
      const values = sourceData.expiringBreakdown.map((b: any) => Number(b.count) || 0);

      charts.push({
        id: 'lease-expiry-timeline',
        title: 'Upcoming Lease Expiries',
        type: 'bar',
        data: {
          labels,
          datasets: [{ label: 'Expiring Leases', data: values }]
        },
        options: {
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1 }
            }
          }
        }
      });

      charts.push({
        id: 'lease-expiry-distribution',
        title: 'Expiries by Period',
        type: 'doughnut',
        data: {
          labels,
          datasets: [{ data: values }]
        },
        options: { plugins: { legend: { position: 'bottom' as const } } }
      });

      return charts;
    }

    // Fallback: aggregate expiry months from table data
    const expiryData = this.aggregateByMonth(tableData, 'endDate', undefined, true);
    if (expiryData.length > 0) {
      charts.push({
        id: 'lease-expiry-timeline',
        title: 'Upcoming Lease Expiries',
        type: 'bar',
        data: {
          labels: expiryData.map(d => d.label),
          datasets: [{ label: 'Expiring Leases', data: expiryData.map(d => d.value) }]
        },
        options: {
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1 }
            }
          }
        }
      });
    }

    return charts;
  }

  private static createFinancialSummaryCharts(tableData: Array<Record<string, any>>, kpis: ReportKPI[], sourceData?: any): ReportChart[] {
    const charts: ReportChart[] = [];

    // Prefer real Executive Summary data when available
    if (sourceData?.revenueTrendQuarterly && Array.isArray(sourceData.revenueTrendQuarterly) && sourceData.revenueTrendQuarterly.length > 0) {
      const qLabels = sourceData.revenueTrendQuarterly.map((q: any) => q.quarter || q.label);
      const qValues = sourceData.revenueTrendQuarterly.map((q: any) => Number(q.amount) || 0);
      charts.push({
        id: 'quarterly-revenue-overview',
        title: 'Quarterly Revenue Overview',
        type: 'bar',
        data: {
          labels: qLabels,
          datasets: [{
            label: 'Revenue',
            data: qValues
          }]
        },
        options: {
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function(value: any) {
                  return formatAmount(value);
                }
              }
            }
          }
        }
      });
    }

    if (sourceData?.occupancyBreakdown && Array.isArray(sourceData.occupancyBreakdown) && sourceData.occupancyBreakdown.length > 0) {
      charts.push({
        id: 'portfolio-occupancy-status',
        title: 'Portfolio Occupancy Status',
        type: 'doughnut',
        data: {
          labels: sourceData.occupancyBreakdown.map((o: any) => o.status || o.label),
          datasets: [{
            data: sourceData.occupancyBreakdown.map((o: any) => Number(o.count) || 0)
          }]
        },
        options: {
          plugins: { legend: { position: 'bottom' as const } }
        }
      });
    }

    // Fallback: show KPI bar if no structured source data available
    if (charts.length === 0 && kpis.length > 0) {
      const kpiValues = kpis
        .map(kpi => ({ label: kpi.label, value: this.extractNumericValue(kpi.value) }))
        .filter(item => item.value !== null);

      if (kpiValues.length > 0) {
        charts.push({
          id: 'financial-kpis',
          title: 'Key Financial Metrics',
          type: 'bar',
          data: {
            labels: kpiValues.map(item => item.label),
            datasets: [{
              label: 'Values',
              data: kpiValues.map(item => item.value as number)
            }]
          }
        });
      }
    }

    return charts;
  }

  private static createOutstandingBalancesCharts(tableData: Array<Record<string, any>>, kpis: ReportKPI[], sourceData?: any): ReportChart[] {
    const charts: ReportChart[] = [];

    // Use aging analysis data from sourceData if available
    let agingLabels = ['Current', '1-30 Days', '31-60 Days', '61-90 Days', '90+ Days'];
    let agingData = [0, 0, 0, 0, 0]; // fallback data
    
    if (sourceData?.agingAnalysis) {
      // sourceData.agingAnalysis is an object, not an array
      agingData = agingLabels.map(label => Number(sourceData.agingAnalysis[label] || 0));
    }

    charts.push({
      id: 'aging-analysis',
      title: 'Outstanding Balances by Age',
      type: 'bar',
      data: {
        labels: agingLabels,
        datasets: [{
          label: 'Outstanding Amount',
          data: agingData,
          backgroundColor: ['#22c55e', '#f59e0b', '#f59e0b', '#ef4444', '#7c2d12']
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value: any) {
                return formatAmount(value);
              }
            }
          }
        }
      }
    });

    // Risk distribution chart
    const lowRisk = Number(sourceData?.agingAnalysis?.['Current'] || 0) + Number(sourceData?.agingAnalysis?.['1-30 Days'] || 0);
    const mediumRisk = Number(sourceData?.agingAnalysis?.['31-60 Days'] || 0);
    const highRisk = Number(sourceData?.agingAnalysis?.['61-90 Days'] || 0) + Number(sourceData?.agingAnalysis?.['90+ Days'] || 0);

    if (lowRisk > 0 || mediumRisk > 0 || highRisk > 0) {
      charts.push({
        id: 'risk-distribution',
        title: 'Risk Distribution',
        type: 'doughnut',
        data: {
          labels: ['Low Risk (0-30 days)', 'Medium Risk (31-60 days)', 'High Risk (60+ days)'],
          datasets: [{
            data: [lowRisk, mediumRisk, highRisk],
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444']
          }]
        },
        options: {
          plugins: { 
            legend: { position: 'bottom' as const },
            tooltip: {
              callbacks: {
                label: function(context: any) {
                  return context.label + ': ' + formatAmount(Number(context.parsed));
                }
              }
            }
          }
        }
      });
    }

    return charts;
  }

  private static createPropertyPerformanceCharts(tableData: Array<Record<string, any>>, kpis: ReportKPI[], sourceData?: any): ReportChart[] {
    const charts: ReportChart[] = [];

    // Use property performance data from sourceData if available
    let propertyLabels: string[] = [];
    let revenueData: number[] = [];
    let yieldData: number[] = [];
    let expenseData: number[] = [];
    let netIncomeData: number[] = [];
    
    if (sourceData?.propertyData && Array.isArray(sourceData.propertyData)) {
      propertyLabels = sourceData.propertyData.map((item: any) => item.name || 'Property');
      revenueData = sourceData.propertyData.map((item: any) => Math.abs(item.revenue || 0));
      yieldData = sourceData.propertyData.map((item: any) => Math.abs(item.yield || 0));
      expenseData = sourceData.propertyData.map((item: any) => Math.abs(item.expenses || 0));
      netIncomeData = sourceData.propertyData.map((item: any) => Math.abs(item.netIncome || 0));
    } else if (tableData && tableData.length > 0) {
      // Fallback to table data
      propertyLabels = tableData.map((item: any) => item.propertyName || item.name || 'Property');
      revenueData = tableData.map((item: any) => this.extractNumericValue(item.revenue) || 0);
      yieldData = tableData.map((item: any) => this.extractNumericValue(item.yield) || 0);
      expenseData = tableData.map((item: any) => this.extractNumericValue(item.expenses) || 0);
      netIncomeData = tableData.map((item: any) => this.extractNumericValue(item.netIncome) || 0);
    }

    // If no data available, use fallback
    if (propertyLabels.length === 0) {
      propertyLabels = ['No Properties'];
      revenueData = [0];
      yieldData = [0];
      expenseData = [0];
      netIncomeData = [0];
    }

    // Property revenue chart
    charts.push({
      id: 'property-revenue',
      title: 'Revenue by Property',
      type: 'bar',
      data: {
        labels: propertyLabels,
        datasets: [{
          label: 'Revenue',
          data: revenueData,
          backgroundColor: '#3b82f6'
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value: any) {
                return this.formatAmount ? this.formatAmount(value) : value.toLocaleString();
              }
            }
          }
        }
      }
    });

    // Property yield performance chart
    charts.push({
      id: 'property-yield',
      title: 'Property Yield Performance',
      type: 'line',
      data: {
        labels: propertyLabels,
        datasets: [{
          label: 'Yield (%)',
          data: yieldData,
          borderColor: '#10b981',
          fill: false
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value: any) {
                return value + '%';
              }
            }
          }
        }
      }
    });

    return charts;
  }

  private static createProfitLossCharts(tableData: Array<Record<string, any>>, kpis: ReportKPI[], sourceData?: any): ReportChart[] {
    const charts: ReportChart[] = [];

    // Monthly P&L trend - prefer pre-aggregated data from source
    let labels: string[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    let revenueData: number[] = [0, 0, 0, 0, 0, 0];
    let expenseData: number[] = [0, 0, 0, 0, 0, 0];

    const trend = Array.isArray(sourceData?.monthlyTrends)
      ? sourceData.monthlyTrends
      : Array.isArray(sourceData?.monthlyTrend)
        ? sourceData.monthlyTrend
        : null;

    if (trend) {
      labels = trend.map((item: any) => item.month || item.label);
      revenueData = trend.map((item: any) => item.revenue || item.totalRevenue || 0);
      expenseData = trend.map((item: any) => item.expenses || item.totalExpenses || 0);
    } else if (tableData && tableData.length > 0) {
      // Fallback: try to aggregate from table monthly data if available
      const revenueMonthly = this.aggregateByMonth(
        tableData.filter(r => (r['Total Revenue'] ?? r['revenue'] ?? r['Revenue']) != null),
        'Month',
        'Total Revenue'
      );
      const expenseMonthly = this.aggregateByMonth(
        tableData.filter(r => (r['Operating Expenses'] ?? r['expenses'] ?? r['Expenses']) != null),
        'Month',
        'Operating Expenses'
      );
      const allMonths = [...new Set([...revenueMonthly.map(d => d.label), ...expenseMonthly.map(d => d.label)])].sort();
      labels = allMonths;
      revenueData = allMonths.map(m => revenueMonthly.find(d => d.label === m)?.value || 0);
      expenseData = allMonths.map(m => expenseMonthly.find(d => d.label === m)?.value || 0);
    }

    charts.push({
      id: 'monthly-pl-trend',
      title: 'Monthly Profit & Loss Trend',
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Revenue',
            data: revenueData,
            borderColor: '#22c55e',
            backgroundColor: '#22c55e20',
            fill: false,
            tension: 0.3
          },
          {
            label: 'Expenses',
            data: expenseData,
            borderColor: '#ef4444',
            backgroundColor: '#ef444420',
            fill: false,
            tension: 0.3
          }
        ]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (v: any) => formatAmount(v) }
          }
        }
      }
    });

    // Revenue vs Expenses summary (bar)
    const totalRevenue = sourceData?.summary?.totalRevenue ?? this.extractNumericValue(kpis.find(k => k.label.toLowerCase().includes('revenue'))?.value || 0) ?? 0;
    const totalExpenses = sourceData?.summary?.totalExpenses ?? this.extractNumericValue(kpis.find(k => k.label.toLowerCase().includes('expense'))?.value || 0) ?? 0;

    charts.push({
      id: 'revenue-vs-expenses-summary',
      title: 'Revenue vs Expenses',
      type: 'bar',
      data: {
        labels: ['Revenue', 'Expenses'],
        datasets: [{
          label: 'Amount',
          data: [totalRevenue, totalExpenses],
          backgroundColor: ['#22c55e', '#ef4444']
        }]
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: (v: any) => formatAmount(v) }
          }
        }
      }
    });

    // Revenue by Property (doughnut) if available
    if (Array.isArray(sourceData?.propertyBreakdown) && sourceData.propertyBreakdown.length > 0) {
      charts.push({
        id: 'revenue-by-property',
        title: 'Revenue by Property',
        type: 'doughnut',
        data: {
          labels: sourceData.propertyBreakdown.map((p: any) => p.property || p.name || 'Property'),
          datasets: [{
            data: sourceData.propertyBreakdown.map((p: any) => p.revenue || p.totalRevenue || 0),
            backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']
          }]
        }
      });
    }

    return charts;
  }

  private static createExpenseSummaryCharts(tableData: Array<Record<string, any>>, kpis: ReportKPI[], sourceData?: any): ReportChart[] {
    const charts: ReportChart[] = [];

    // Expenses by category - use pre-aggregated data if available
    let categoryLabels = ['Maintenance', 'Utilities', 'Insurance', 'Management', 'Other'];
    let categoryData = [145000, 98000, 75000, 120000, 47000];
    
    if (sourceData?.categoryBreakdown && Array.isArray(sourceData.categoryBreakdown)) {
      categoryLabels = sourceData.categoryBreakdown.map((item: any) => item.category || item.label);
      categoryData = sourceData.categoryBreakdown.map((item: any) => item.totalAmount || item.amount || item.value || 0);
    }

    charts.push({
      id: 'expenses-by-category',
      title: 'Expenses by Category',
      type: 'doughnut',
      data: {
        labels: categoryLabels,
        datasets: [{
          data: categoryData,
          backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6']
        }]
      }
    });

    return charts;
  }

  private static createCashFlowCharts(tableData: Array<Record<string, any>>, kpis: ReportKPI[], sourceData?: any): ReportChart[] {
    const charts: ReportChart[] = [];

    // Monthly cash flow - prefer pre-aggregated data if available
    let labels: string[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    let inflowData: number[] = [0, 0, 0, 0, 0, 0];
    let outflowData: number[] = [0, 0, 0, 0, 0, 0];
    
    if (Array.isArray(sourceData?.monthlyTrends)) {
      labels = sourceData.monthlyTrends.map((item: any) => item.month || item.label);
      inflowData = sourceData.monthlyTrends.map((item: any) => Number(item.inflow || item.cashInflow || 0));
      outflowData = sourceData.monthlyTrends.map((item: any) => Number(item.outflow || item.cashOutflow || 0));
    } else if (Array.isArray(sourceData?.monthlyTrend)) {
      labels = sourceData.monthlyTrend.map((item: any) => item.month || item.label);
      inflowData = sourceData.monthlyTrend.map((item: any) => Number(item.inflow || item.cashInflow || 0));
      outflowData = sourceData.monthlyTrend.map((item: any) => Number(item.outflow || item.cashOutflow || 0));
    }

    charts.push({
      id: 'monthly-cash-flow',
      title: 'Monthly Cash Flow',
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Inflow', data: inflowData, backgroundColor: '#22c55e' },
          { label: 'Outflow', data: outflowData, backgroundColor: '#ef4444' }
        ]
      }
    });

    // Outflow by Category if available
    if (Array.isArray(sourceData?.outflowByCategory) && sourceData.outflowByCategory.length > 0) {
      charts.push({
        id: 'outflow-by-category',
        title: 'Cash Outflow by Category',
        type: 'doughnut',
        data: {
          labels: sourceData.outflowByCategory.map((c: any) => c.category || 'Other'),
          datasets: [{
            data: sourceData.outflowByCategory.map((c: any) => Number(c.amount) || 0),
            backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6']
          }]
        },
        options: { plugins: { legend: { position: 'bottom' as const } } }
      });
    }

    return charts;
  }

  private static createGenericCharts(tableData: Array<Record<string, any>>, kpis: ReportKPI[]): ReportChart[] {
    const charts: ReportChart[] = [];

    // Try to create a generic chart from numeric columns
    if (tableData.length > 0) {
      const numericColumns = this.findNumericColumns(tableData);
      const dateColumns = this.findDateColumns(tableData);

      if (numericColumns.length > 0 && dateColumns.length > 0) {
        const timeData = this.aggregateByMonth(tableData, dateColumns[0], numericColumns[0]);
        if (timeData.length > 0) {
          charts.push({
            id: 'generic-trend',
            title: `${this.formatColumnName(numericColumns[0])} Over Time`,
            type: 'line',
            data: {
              labels: timeData.map(d => d.label),
              datasets: [{
                label: this.formatColumnName(numericColumns[0]),
                data: timeData.map(d => d.value),
                fill: false,
                tension: 0.3
              }]
            }
          });
        }
      }
    }

    return charts;
  }

  // Helper methods
  private static aggregateByMonth(
    data: Array<Record<string, any>>, 
    dateField: string, 
    valueField?: string,
    count: boolean = false
  ): ChartDataPoint[] {
    console.log('🔍 aggregateByMonth called with:', { 
      dataLength: data.length, 
      dateField, 
      valueField, 
      count,
      sampleRow: data[0]
    });
    
    if (!data || data.length === 0) return [];

    const monthlyData: Record<string, number> = {};

    data.forEach(row => {
      const dateValue = row[dateField];
      if (!dateValue) return;

      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return;

      const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });

      if (count) {
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
      } else if (valueField && row[valueField] !== undefined) {
        const extracted = this.extractNumericValue(row[valueField]);
        const value = extracted !== null ? extracted : 0;
        console.log(`📊 Processing ${monthKey}: raw=${row[valueField]}, extracted=${extracted}, value=${value}`);
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + value;
      }
    });
    
    console.log('📈 Final monthly aggregation:', monthlyData);

    return Object.entries(monthlyData)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => new Date(a.label).getTime() - new Date(b.label).getTime());
  }

  private static aggregateByCategory(
    data: Array<Record<string, any>>, 
    categoryField: string, 
    valueField: string | null,
    count: boolean = false
  ): ChartDataPoint[] {
    if (!data || data.length === 0) return [];

    const categoryData: Record<string, number> = {};

    data.forEach(row => {
      const category = row[categoryField] || 'Unknown';
      
      if (count) {
        categoryData[category] = (categoryData[category] || 0) + 1;
      } else if (valueField && row[valueField] !== undefined) {
        const extracted = this.extractNumericValue(row[valueField]);
        const value = extracted !== null ? extracted : 0;
        categoryData[category] = (categoryData[category] || 0) + value;
      }
    });

    return Object.entries(categoryData)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }

  private static findNumericColumns(data: Array<Record<string, any>>): string[] {
    if (!data || data.length === 0) return [];

    const sample = data[0];
    return Object.keys(sample).filter(key => {
      const value = sample[key];
      if (typeof value === 'number') return true;
      const extracted = this.extractNumericValue(value);
      return extracted !== null;
    });
  }

  private static findDateColumns(data: Array<Record<string, any>>): string[] {
    if (!data || data.length === 0) return [];

    const sample = data[0];
    return Object.keys(sample).filter(key => {
      const value = sample[key];
      return key.toLowerCase().includes('date') || 
             key.toLowerCase().includes('time') ||
             (typeof value === 'string' && !isNaN(Date.parse(value)));
    });
  }

  private static extractNumericValue(value: string | number): number | null {
    if (typeof value === 'number') return value;
    // Extract number from strings like "$1,234", "KES 5,000", "85%", formatAmount() outputs
    const numMatch = String(value).match(/[\d,]+\.?\d*/);
    if (numMatch) {
      const num = parseFloat(numMatch[0].replace(/,/g, ''));
      return isNaN(num) ? null : num;
    }
    return null;
  }

  private static formatStatusLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }

  private static formatCategoryLabel(category: string): string {
    return category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
  }

  private static formatColumnName(column: string): string {
    return column.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
  }

  private static hasValidData(chart: ReportChart): boolean {
    if (!chart.data?.datasets || chart.data.datasets.length === 0) return false;
    
    return chart.data.datasets.some((dataset: any) => 
      Array.isArray(dataset.data) && 
      dataset.data.length > 0 && 
      dataset.data.some((value: any) => value != null && value !== 0)
    );
  }

  private static createMarketRentCharts(reportType: string, sourceData: any, tableData: any[]): ReportChart[] {
    const charts: ReportChart[] = [];
    
    // 1) Rent Comparison by Unit Type
    if (Array.isArray(sourceData?.comparisons) && sourceData.comparisons.length > 0) {
      charts.push({
        id: 'rent-comparison-by-type',
        title: 'Rent Comparison by Unit Type',
        type: 'bar',
        data: {
          labels: sourceData.comparisons.map((c: any) => c.unitType),
          datasets: [
            {
              label: 'Market Rate',
              data: sourceData.comparisons.map((c: any) => Number(c.marketRate) || 0),
              backgroundColor: 'rgba(99, 102, 241, 0.8)',
              borderColor: 'rgb(99, 102, 241)',
              borderWidth: 1
            },
            {
              label: 'Our Rate',
              data: sourceData.comparisons.map((c: any) => Number(c.ourAvgRate) || 0),
              backgroundColor: 'rgba(16, 185, 129, 0.8)',
              borderColor: 'rgb(16, 185, 129)',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (value: any) => formatAmount(Number(value)) }
            }
          }
        }
      });
    }

    // 2) Market Position Overview (Doughnut)
    if (Array.isArray(sourceData?.unitTypeBreakdown) && sourceData.unitTypeBreakdown.length > 0) {
      charts.push({
        id: 'unit-type-distribution',
        title: 'Unit Type Distribution',
        type: 'doughnut',
        data: {
          labels: sourceData.unitTypeBreakdown.map((u: any) => u.unitType),
          datasets: [{
            data: sourceData.unitTypeBreakdown.map((u: any) => u.count),
            backgroundColor: [
              'rgba(99, 102, 241, 0.8)',
              'rgba(16, 185, 129, 0.8)',
              'rgba(245, 158, 11, 0.8)',
              'rgba(239, 68, 68, 0.8)',
              'rgba(139, 92, 246, 0.8)',
              'rgba(6, 182, 212, 0.8)'
            ],
            borderColor: [
              'rgb(99, 102, 241)',
              'rgb(16, 185, 129)',
              'rgb(245, 158, 11)',
              'rgb(239, 68, 68)',
              'rgb(139, 92, 246)',
              'rgb(6, 182, 212)'
            ],
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom' as const }
          }
        }
      });
    }

    // 3) Rent Trends Over Time
    if (Array.isArray(sourceData?.rentTrends) && sourceData.rentTrends.length > 0) {
      charts.push({
        id: 'rent-trends',
        title: 'Rent Trends (12 Months)',
        type: 'line',
        data: {
          labels: sourceData.rentTrends.map((t: any) => t.month),
          datasets: [
            {
              label: 'Market Rate',
              data: sourceData.rentTrends.map((t: any) => Number(t.marketRate) || 0),
              borderColor: 'rgb(99, 102, 241)',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              fill: true,
              tension: 0.3
            },
            {
              label: 'Our Rate',
              data: sourceData.rentTrends.map((t: any) => Number(t.ourRate) || 0),
              borderColor: 'rgb(16, 185, 129)',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              fill: true,
              tension: 0.3
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (value: any) => formatAmount(Number(value)) }
            }
          }
        }
      });
    }

    // 4) Rent Gap Analysis
    if (Array.isArray(sourceData?.rentTrends) && sourceData.rentTrends.some((t: any) => Number(t.gap) > 0)) {
      charts.push({
        id: 'rent-gap-analysis',
        title: 'Monthly Rent Gap (Potential)',
        type: 'bar',
        data: {
          labels: sourceData.rentTrends.map((t: any) => t.month),
          datasets: [{
            label: 'Gap (Market - Our Rate)',
            data: sourceData.rentTrends.map((t: any) => Number(t.gap) || 0),
            backgroundColor: 'rgba(245, 158, 11, 0.8)',
            borderColor: 'rgb(245, 158, 11)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: (value: any) => formatAmount(Number(value)) }
            }
          }
        }
      });
    }

    // 5) Property Performance Comparison
    if (Array.isArray(sourceData?.propertyData) && sourceData.propertyData.length > 0) {
      charts.push({
        id: 'property-market-performance',
        title: 'Property Market Performance (%)',
        type: 'bar',
        data: {
          labels: sourceData.propertyData.map((p: any) => p.name),
          datasets: [{
            label: 'Market Performance (%)',
            data: sourceData.propertyData.map((p: any) => Number(p.performance) || 0),
            backgroundColor: sourceData.propertyData.map((p: any) => {
              const perf = Number(p.performance) || 0;
              if (perf >= 100) return 'rgba(16, 185, 129, 0.8)'; // Green for above/at market
              if (perf >= 90) return 'rgba(245, 158, 11, 0.8)'; // Yellow for close to market
              return 'rgba(239, 68, 68, 0.8)'; // Red for below market
            }),
            borderColor: sourceData.propertyData.map((p: any) => {
              const perf = Number(p.performance) || 0;
              if (perf >= 100) return 'rgb(16, 185, 129)';
              if (perf >= 90) return 'rgb(245, 158, 11)';
              return 'rgb(239, 68, 68)';
            }),
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              max: 120,
              ticks: { callback: (value: any) => `${value}%` }
            }
          }
        }
      });
    }

    // 6) Variance Analysis (if data has variance info)
    if (Array.isArray(sourceData?.comparisons) && sourceData.comparisons.some((c: any) => Number(c.variance) !== 0)) {
      charts.push({
        id: 'rent-variance-analysis',
        title: 'Rent Variance from Market (%)',
        type: 'bar',
        data: {
          labels: sourceData.comparisons.map((c: any) => c.unitType),
          datasets: [{
            label: 'Variance (%)',
            data: sourceData.comparisons.map((c: any) => Number(c.variance) || 0),
            backgroundColor: sourceData.comparisons.map((c: any) => {
              const variance = Number(c.variance) || 0;
              if (variance > 5) return 'rgba(16, 185, 129, 0.8)'; // Green for above market
              if (variance >= -5) return 'rgba(245, 158, 11, 0.8)'; // Yellow for market aligned
              return 'rgba(239, 68, 68, 0.8)'; // Red for below market
            }),
            borderColor: sourceData.comparisons.map((c: any) => {
              const variance = Number(c.variance) || 0;
              if (variance > 5) return 'rgb(16, 185, 129)';
              if (variance >= -5) return 'rgb(245, 158, 11)';
              return 'rgb(239, 68, 68)';
            }),
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          scales: {
            y: {
              ticks: { callback: (value: any) => `${value}%` }
            }
          }
        }
      });
    }

    return charts;
  }
}