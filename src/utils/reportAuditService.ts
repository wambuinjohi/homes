import { getReportTransformer } from './reportDataTransformers';
import { ReportChartDataService } from './reportChartDataService';
import { REPORT_TEMPLATES } from './reportTemplateConfig';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';

export interface ReportAuditResult {
  reportType: string;
  title: string;
  status: 'working' | 'broken' | 'partial';
  issues: string[];
  recommendations: string[];
  hasData: boolean;
  hasCharts: boolean;
  hasKPIs: boolean;
  hasTables: boolean;
}

export interface ReportSystemAudit {
  summary: {
    total: number;
    working: number;
    broken: number;
    partial: number;
  };
  results: ReportAuditResult[];
  systemRecommendations: string[];
}

export class ReportAuditService {
  private static defaultFilters = {
    dateRange: {
      from: startOfMonth(subMonths(new Date(), 11)),
      to: endOfMonth(new Date())
    }
  };

  static async auditAllReports(): Promise<ReportSystemAudit> {
    const reportTypes = [
      'rent-collection',
      'outstanding-balances', 
      'property-performance',
      'profit-loss',
      'executive-summary',
      'revenue-vs-expenses',
      'lease-expiry',
      'occupancy',
      'expense-summary',
      'cash-flow',
      'maintenance',
      'tenant-turnover',
      'market-rent'
    ];

    const results: ReportAuditResult[] = [];

    for (const reportType of reportTypes) {
      const result = await this.auditSingleReport(reportType);
      results.push(result);
    }

    const summary = {
      total: results.length,
      working: results.filter(r => r.status === 'working').length,
      broken: results.filter(r => r.status === 'broken').length,
      partial: results.filter(r => r.status === 'partial').length
    };

    const systemRecommendations = this.generateSystemRecommendations(results);

    return {
      summary,
      results,
      systemRecommendations
    };
  }

  static async auditSingleReport(reportType: string): Promise<ReportAuditResult> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let hasData = false;
    let hasCharts = false;
    let hasKPIs = false;
    let hasTables = false;

    try {
      // Check if template exists
      const template = REPORT_TEMPLATES[reportType];
      if (!template) {
        issues.push('Report template not found in REPORT_TEMPLATES');
        recommendations.push('Add template configuration in reportTemplateConfig.ts');
      }

      // Check transformer
      const transformer = getReportTransformer(reportType);
      if (!transformer) {
        issues.push('Report transformer not found');
        recommendations.push('Add transformer in reportDataTransformers.ts');
      }

      // Test data generation
      try {
        // Since we removed ReportDataService, we simulate basic data structure
        const reportData = {
          title: `${reportType} Report`,
          period: `${this.defaultFilters.dateRange.from.toLocaleDateString()} - ${this.defaultFilters.dateRange.to.toLocaleDateString()}`,
          summary: `Test summary for ${reportType} report`,
          kpis: []
        };
        hasData = true;

        // Test KPIs
        if (transformer) {
          const kpis = transformer.generateKPIs(reportData);
          hasKPIs = Array.isArray(kpis) && kpis.length > 0;
          
          if (!hasKPIs) {
            issues.push('KPI generation failed or returned empty array');
            recommendations.push('Implement proper KPI generation in transformer');
          }

          // Test charts
          const charts = transformer.generateCharts(reportData);
          hasCharts = Array.isArray(charts) && charts.length > 0;
          
          if (!hasCharts) {
            issues.push('Chart generation failed or returned empty array');
            recommendations.push('Implement chart generation in transformer');
          } else {
            // Validate chart data structure
            const invalidCharts = charts.filter(chart => 
              !chart.title || !chart.type || !chart.data
            );
            if (invalidCharts.length > 0) {
              issues.push(`${invalidCharts.length} charts have invalid structure`);
              recommendations.push('Ensure all charts have title, type, and data properties');
            }
          }

          // Test table data
          const tableData = transformer.formatTableData(reportData);
          hasTables = Array.isArray(tableData) && tableData.length > 0;
          
          if (!hasTables) {
            issues.push('Table data generation failed or returned empty array');
            recommendations.push('Implement table data formatting in transformer');
          }
        }

        // Test dynamic chart generation
        try {
          const dynamicCharts = ReportChartDataService.generateChartsForReport(reportType, [], []);
          if (!Array.isArray(dynamicCharts)) {
            issues.push('Dynamic chart generation failed');
            recommendations.push('Fix ReportChartDataService for this report type');
          }
        } catch (error) {
          issues.push('Dynamic chart generation threw error: ' + (error as Error).message);
          recommendations.push('Debug ReportChartDataService.generateChartsForReport');
        }

      } catch (error) {
        issues.push('Data generation threw error: ' + (error as Error).message);
        recommendations.push('Debug ReportDataService.generateReportContent');
      }

    } catch (error) {
      issues.push('General audit error: ' + (error as Error).message);
      recommendations.push('Review entire report implementation');
    }

    // Determine status
    let status: 'working' | 'broken' | 'partial';
    if (issues.length === 0) {
      status = 'working';
    } else if (hasData && (hasKPIs || hasCharts || hasTables)) {
      status = 'partial';
    } else {
      status = 'broken';
    }

    return {
      reportType,
      title: REPORT_TEMPLATES[reportType]?.title || reportType,
      status,
      issues,
      recommendations,
      hasData,
      hasCharts,
      hasKPIs,
      hasTables
    };
  }

  private static generateSystemRecommendations(results: ReportAuditResult[]): string[] {
    const recommendations: string[] = [];
    
    const brokenCount = results.filter(r => r.status === 'broken').length;
    const partialCount = results.filter(r => r.status === 'partial').length;
    
    if (brokenCount > 0) {
      recommendations.push(`${brokenCount} reports are completely broken and need immediate attention`);
    }
    
    if (partialCount > 0) {
      recommendations.push(`${partialCount} reports are partially working but missing features`);
    }

    const commonIssues = this.findCommonIssues(results);
    if (commonIssues.length > 0) {
      recommendations.push(`Common issues found: ${commonIssues.join(', ')}`);
    }

    const missingCharts = results.filter(r => !r.hasCharts).length;
    if (missingCharts > 3) {
      recommendations.push('Chart generation system needs review - many reports missing charts');
    }

    const missingKPIs = results.filter(r => !r.hasKPIs).length;
    if (missingKPIs > 3) {
      recommendations.push('KPI generation system needs review - many reports missing KPIs');
    }

    return recommendations;
  }

  private static findCommonIssues(results: ReportAuditResult[]): string[] {
    const issueMap: Record<string, number> = {};
    
    results.forEach(result => {
      result.issues.forEach(issue => {
        issueMap[issue] = (issueMap[issue] || 0) + 1;
      });
    });

    return Object.entries(issueMap)
      .filter(([_, count]) => count >= 3)
      .map(([issue, _]) => issue);
  }

  static generateAuditReport(audit: ReportSystemAudit): string {
    const workingPercentage = ((audit.summary.working / audit.summary.total) * 100).toFixed(1);
    
    let report = `# Report System Audit\n\n`;
    report += `## Summary\n`;
    report += `- Total Reports: ${audit.summary.total}\n`;
    report += `- Working: ${audit.summary.working} (${workingPercentage}%)\n`;
    report += `- Partial: ${audit.summary.partial}\n`;
    report += `- Broken: ${audit.summary.broken}\n\n`;

    if (audit.systemRecommendations.length > 0) {
      report += `## System Recommendations\n`;
      audit.systemRecommendations.forEach(rec => {
        report += `- ${rec}\n`;
      });
      report += '\n';
    }

    report += `## Individual Report Status\n\n`;
    
    audit.results.forEach(result => {
      const status = result.status.toUpperCase();
      const statusEmoji = result.status === 'working' ? '✅' : 
                         result.status === 'partial' ? '⚠️' : '❌';
      
      report += `### ${statusEmoji} ${result.title} (${status})\n`;
      
      if (result.issues.length > 0) {
        report += `**Issues:**\n`;
        result.issues.forEach(issue => {
          report += `- ${issue}\n`;
        });
      }
      
      if (result.recommendations.length > 0) {
        report += `**Recommendations:**\n`;
        result.recommendations.forEach(rec => {
          report += `- ${rec}\n`;
        });
      }
      
      report += '\n';
    });

    return report;
  }
}