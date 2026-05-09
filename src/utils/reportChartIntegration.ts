import { EnhancedChartRenderer, EnhancedChartConfig } from './enhancedChartRenderer';
import { BrandingData } from './brandingService';

export interface ReportChart {
  id: string;
  title: string;
  type: 'bar' | 'line' | 'pie' | 'doughnut';
  data: any;
  options?: any;
  description?: string;
}

export interface ReportKPI {
  id: string;
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'stable';
  change?: string;
  description?: string;
}

export class ReportChartIntegration {
  static async renderChartsForPDF(
    charts: ReportChart[], 
    branding: BrandingData
  ): Promise<Array<{ chart: ReportChart; imageData: string }>> {
    const results: Array<{ chart: ReportChart; imageData: string }> = [];
    
    for (const chart of charts) {
      try {
        const chartConfig: EnhancedChartConfig = {
          type: chart.type,
          data: chart.data,
          options: chart.options,
          title: chart.title,
          branding,
          dimensions: branding.reportLayout?.chartDimensions || 'standard'
        };
        
        const imageData = await EnhancedChartRenderer.renderChartForPDF(chartConfig);
        results.push({ chart, imageData });
      } catch (error) {
        console.error(`Failed to render chart ${chart.id}:`, error);
        // Continue with other charts even if one fails
      }
    }
    
    return results;
  }

  static formatKPIsForPDF(kpis: ReportKPI[], style: 'cards' | 'minimal' | 'detailed' = 'cards') {
    return kpis.map(kpi => ({
      ...kpi,
      displayStyle: style,
      formattedValue: this.formatKPIValue(kpi.value),
      trendSymbol: this.getTrendSymbol(kpi.trend),
      trendColor: this.getTrendColor(kpi.trend)
    }));
  }

  private static formatKPIValue(value: string): string {
    // Handle currency formatting
    if (value.includes('$') || value.includes('KES')) {
      const numMatch = value.match(/[\d,]+\.?\d*/);
      if (numMatch) {
        const num = parseFloat(numMatch[0].replace(/,/g, ''));
        if (num >= 1000000) {
          return `$${(num / 1000000).toFixed(1)}M`;
        } else if (num >= 1000) {
          return `$${(num / 1000).toFixed(1)}K`;
        }
      }
    }
    
    // Handle percentage formatting
    if (value.includes('%')) {
      return value;
    }
    
    // Handle count formatting
    const numMatch = value.match(/^\d+$/);
    if (numMatch) {
      const num = parseInt(numMatch[0]);
      if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}K`;
      }
    }
    
    return value;
  }

  private static getTrendSymbol(trend?: 'up' | 'down' | 'stable'): string {
    switch (trend) {
      case 'up': return '▲';
      case 'down': return '▼';
      case 'stable': return '●';
      default: return '';
    }
  }

  private static getTrendColor(trend?: 'up' | 'down' | 'stable'): string {
    switch (trend) {
      case 'up': return '#16a34a';
      case 'down': return '#dc2626';
      case 'stable': return '#6b7280';
      default: return '#6b7280';
    }
  }

  static createSampleChartData(reportType: string): ReportChart[] {
    switch (reportType) {
      case 'rent-collection':
        return [
          {
            id: 'monthly-collection',
            title: 'Monthly Rent Collection Trend',
            type: 'line',
            data: {
              labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
              datasets: [{
                label: 'Collections',
                data: [85000, 92000, 78000, 95000, 88000, 91000],
                fill: false,
                tension: 0.3
              }]
            }
          },
          {
            id: 'collection-rate',
            title: 'Collection Rate by Property',
            type: 'bar',
            data: {
              labels: ['Property A', 'Property B', 'Property C', 'Property D'],
              datasets: [{
                label: 'Collection Rate (%)',
                data: [95, 87, 92, 89]
              }]
            }
          }
        ];
      
      case 'occupancy':
        return [
          {
            id: 'occupancy-trend',
            title: 'Occupancy Rate Trend',
            type: 'line',
            data: {
              labels: ['Q1', 'Q2', 'Q3', 'Q4'],
              datasets: [{
                label: 'Occupancy Rate (%)',
                data: [88, 92, 87, 90],
                fill: true
              }]
            }
          }
        ];
      
      default:
        return [];
    }
  }

  static createSampleKPIs(reportType: string): ReportKPI[] {
    switch (reportType) {
      case 'rent-collection':
        return [
          {
            id: 'total-collected',
            label: 'Total Collected',
            value: '$125,430',
            trend: 'up',
            change: '+8.5%'
          },
          {
            id: 'collection-rate',
            label: 'Collection Rate',
            value: '92.3%',
            trend: 'stable',
            change: '+0.2%'
          },
          {
            id: 'outstanding',
            label: 'Outstanding',
            value: '$18,250',
            trend: 'down',
            change: '-12.1%'
          }
        ];
      
      case 'occupancy':
        return [
          {
            id: 'occupancy-rate',
            label: 'Overall Occupancy',
            value: '89.5%',
            trend: 'up',
            change: '+2.1%'
          },
          {
            id: 'vacant-units',
            label: 'Vacant Units',
            value: '12',
            trend: 'down',
            change: '-3'
          }
        ];
      
      default:
        return [
          {
            id: 'sample-metric',
            label: 'Sample Metric',
            value: '100',
            trend: 'stable'
          }
        ];
    }
  }
}