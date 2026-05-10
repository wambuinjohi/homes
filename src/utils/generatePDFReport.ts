import { getReportData } from '@/lib/reporting/queries';
import { getReportConfig } from '@/lib/reporting/config';
import { ReportFilters } from '@/lib/reporting/types';
import { UnifiedPDFRenderer } from '@/utils/unifiedPDFRenderer';
import { PDFTemplateService } from '@/utils/pdfTemplateService';
import { buildUnifiedReportContent } from '@/utils/reportContentBuilder';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const generatePDFReport = async (
  reportId: string, 
  filters: ReportFilters,
  cachedReportData?: any // Accept cached data to avoid refetching
) => {
  const startTime = performance.now();
  
  try {
    console.log('Starting PDF generation for:', reportId, filters);
    console.time('Total PDF Generation');
    
    // Get report configuration
    const reportConfig = getReportConfig(reportId);
    if (!reportConfig) {
      throw new Error(`Report configuration not found for: ${reportId}`);
    }
    
    // Use cached data if provided, otherwise fetch fresh data
    let reportData;
    if (cachedReportData) {
      console.log('Using cached report data for PDF generation');
      reportData = cachedReportData;
    } else {
      console.log('Fetching fresh report data for PDF generation');
      reportData = await getReportData(reportConfig.queryId, filters);
    }
    
    console.log('Report data ready:', reportData);
    
    // Get PDF template and branding (cached internally) - use Admin role for reports
    const { template, branding } = await PDFTemplateService.getTemplateAndBranding(
      'report' as any,
      'Admin' as any
    );
    
    console.log('PDF template and branding loaded for report:', {
      templateId: template?.id,
      templateName: template?.name,
      brandingCompany: branding?.companyName,
      role: 'Admin'
    });
    
    // Use unified report content builder for consistent formatting
    const reportContent = buildUnifiedReportContent({
      reportType: reportId,
      period: filters.periodPreset?.replace(/_/g, ' ') || 'Current Period',
      sourceData: reportData,
      summaryOverride: reportConfig.description
    });
    
    // Transform to UnifiedPDFRenderer format
    const documentContent = {
      type: 'report' as const,
      title: reportConfig.title,
      content: {
        type: reportId,
        reportPeriod: reportContent.period,
        summary: reportContent.summary,
        kpis: reportContent.kpis,
        tableData: reportContent.tableData,
        charts: [], // No charts for uniform, reliable PDFs
        includeCharts: false, // Focus on KPIs and tables only
        reportConfig: reportConfig // Pass config for proper table formatting
      },
    };
    
    // Generate PDF using UnifiedPDFRenderer with proper parameter order
    const pdfRenderer = new UnifiedPDFRenderer();
    await pdfRenderer.generateDocument(documentContent, branding, null, null, template);
    
    // Calculate execution time and log report generation
    const endTime = performance.now();
    const executionTimeMs = Math.round(endTime - startTime);
    
    // Log the report generation for KPI tracking
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { error } = await supabase
          .from('report_runs')
          .insert({
            user_id: user.id,
            report_type: reportId,
            filters: filters as any, // Cast to any to handle JSON type
            status: 'completed',
            execution_time_ms: executionTimeMs,
            metadata: {
              timestamp: new Date().toISOString(),
              user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
            } as any
          });

        if (error) {
          console.error('Failed to log PDF report generation:', error);
        } else {
          console.log('📊 Successfully logged PDF report generation:', { reportId, executionTimeMs });
        }
      }
    } catch (logError) {
      console.warn('Failed to log PDF report generation:', logError);
    }
    
    console.timeEnd('Total PDF Generation');
    toast.success('PDF report generated successfully');
    
  } catch (error) {
    console.error('PDF generation failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate PDF report';
    toast.error(errorMessage);
    throw error;
  }
};
