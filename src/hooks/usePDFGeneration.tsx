
import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UnifiedPDFRenderer } from '@/utils/unifiedPDFRenderer';
import { PDFTemplateService } from '@/utils/pdfTemplateService';
import { buildUnifiedReportContent } from '@/utils/reportContentBuilder';
import { getReportData } from '@/lib/reporting/queries';
import { getReportConfig } from '@/lib/reporting/config';
import { toast } from 'sonner';

interface PDFGenerationState {
  isGenerating: boolean;
  progress: number;
  currentStep: string;
  isComplete: boolean;
}

export const usePDFGeneration = () => {
  const queryClient = useQueryClient();
  const [state, setState] = useState<PDFGenerationState>({
    isGenerating: false,
    progress: 0,
    currentStep: '',
    isComplete: false
  });

  const updateProgress = useCallback((progress: number, step: string) => {
    setState(prev => ({
      ...prev,
      progress,
      currentStep: step
    }));
  }, []);

  const generatePDF = useCallback(async (
    reportTitle: string,
    reportId: string,
    queryId: string,
    filters: any,
    includeCharts: boolean = false, // Disable charts for uniform, reliable PDFs
    options: { 
      tableOnly?: boolean;
      includeKPIs?: boolean;
      kpiFitOneRow?: boolean;
    } = {}
  ) => {
    const startTime = performance.now();
    
    try {
      setState({
        isGenerating: true,
        progress: 0,
        currentStep: 'Initializing PDF generation...',
        isComplete: false
      });

      // Step 1: Get report configuration
      updateProgress(10, 'Loading report configuration...');
      const reportConfig = getReportConfig(reportId);
      if (!reportConfig) {
        throw new Error(`Report configuration not found for: ${reportId}`);
      }

      // Step 2: Try to use cached report data first for instant PDF generation
      updateProgress(25, 'Loading report data...');
      console.time('PDF Report Data Fetch');
      
      // Try to get cached data first
      const cachedData = queryClient.getQueryData(['report-data', queryId, filters]);
      let reportData;
      
      if (cachedData) {
        console.log('Using cached report data for PDF generation');
        reportData = cachedData;
      } else {
        console.log('Fetching fresh report data for PDF generation');
        reportData = await getReportData(queryId, filters);
        // Cache the data for next time
        queryClient.setQueryData(['report-data', queryId, filters], reportData);
      }
      
      console.timeEnd('PDF Report Data Fetch');
      
      console.log('Fetched report data:', reportData);

      // Step 3: Fetch template and branding (use Admin role for consistent report styling)
      updateProgress(45, 'Loading PDF template and branding...');
      const { template, branding } = await PDFTemplateService.getTemplateAndBranding(
        'report' as any,
        'Admin'
      );
      
      console.log('PDF template and branding loaded:', {
        templateId: template?.id,
        templateName: template?.name,
        brandingCompany: branding?.companyName,
        role: 'Admin'
      });

      // Step 4: Build report content
      updateProgress(65, 'Building report content...');
      const period = filters.periodPreset?.replace(/_/g, ' ') || 'Current Period';
      const reportContent = buildUnifiedReportContent({
        reportType: reportId, // Use kebab-case reportId for content building
        period,
        sourceData: reportData,
        summaryOverride: reportConfig.description,
      });

      // Step 5: Initialize PDF renderer with progress callback
      updateProgress(75, 'Initializing PDF renderer...');
      const pdfRenderer = new UnifiedPDFRenderer();

      // Set up progress callback for PDF renderer
      pdfRenderer.setProgressCallback((progress: number, step: string) => {
        // Map PDF renderer progress (0-100) to our remaining progress range (75-98)
        const mappedProgress = 75 + (progress * 0.23); // 23% range for PDF rendering
        updateProgress(mappedProgress, step);
      });

      // Step 6: Generate PDF with progress tracking
      updateProgress(78, 'Rendering PDF document...');
      const document = {
        type: 'report' as const,
        title: reportTitle,
        content: {
          type: reportId,
          reportPeriod: reportContent.period,
          summary: reportContent.summary,
          kpis: reportContent.kpis,
          tableData: reportContent.tableData,
          charts: [], // No charts for uniform, reliable PDFs
          includeCharts: false, // Focus on KPIs and tables only
          reportConfig: reportConfig, // Pass config for proper table formatting
          layoutOptions: { 
            tableOnly: options.tableOnly || false,
            includeKPIs: options.includeKPIs !== false,
            kpiFitOneRow: options.kpiFitOneRow !== false
          }
        },
      };

      await pdfRenderer.generateDocument(document, branding, null, null, template);

      // Step 7: Download PDF
      updateProgress(100, 'PDF generated successfully!');

      // Calculate execution time and log report generation
      const endTime = performance.now();
      const executionTimeMs = Math.round(endTime - startTime);
      
      // Log the report generation for KPI tracking
      try {
        const { useReportGeneration } = await import('./useReportGeneration');
        const { logReportGeneration } = useReportGeneration();
        await logReportGeneration(reportId, filters, executionTimeMs);
        console.log('📊 Successfully logged report generation:', { reportId, executionTimeMs });
      } catch (logError) {
        console.warn('Failed to log report generation:', logError);
      }

      setState(prev => ({
        ...prev,
        isComplete: true,
        currentStep: 'PDF generated successfully!'
      }));

      toast.success('PDF report generated successfully');
      
      // Reset state after 2 seconds
      setTimeout(() => {
        setState({
          isGenerating: false,
          progress: 0,
          currentStep: '',
          isComplete: false
        });
      }, 2000);

    } catch (error) {
      console.error('PDF generation failed:', error);
      toast.error('Failed to generate PDF report');
      setState({
        isGenerating: false,
        progress: 0,
        currentStep: '',
        isComplete: false
      });
    }
  }, [updateProgress]);

  return {
    ...state,
    generatePDF
  };
};
