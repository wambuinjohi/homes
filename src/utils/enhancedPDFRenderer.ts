import jsPDF from 'jspdf';
import { ChartToPDFRenderer, ChartDataConfig } from './chartToPDFRenderer';
import { BrandingService, BrandingData } from './brandingService';
import { compactCurrency } from './currency';

// BrandingData is now imported from brandingService

export interface KPIData {
  label: string;
  value: string;
  icon?: string;
  color?: string;
  trend?: 'up' | 'down' | 'stable';
  change?: string;
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie' | 'doughnut';
  title: string;
  data: any;
  options?: any;
}

export interface ReportContent {
  title: string;
  period: string;
  summary: string;
  kpis: KPIData[];
  charts: ChartConfig[];
  tableData?: Array<Record<string, any>>;
}

export class EnhancedPDFRenderer {
  private pdf: jsPDF;
  private currentY: number = 0;
  private pageHeight: number;
  private pageWidth: number;
  private margins = { top: 10, bottom: 15, left: 10, right: 10 };
  private availableWidth: number;

  constructor() {
    this.pdf = new jsPDF('portrait', 'mm', 'a4');
    this.pageHeight = this.pdf.internal.pageSize.height;
    this.pageWidth = this.pdf.internal.pageSize.width;
    this.availableWidth = this.pageWidth - this.margins.left - this.margins.right;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 37, g: 99, b: 235 };
  }

  private checkPageBreak(requiredHeight: number, branding: BrandingData): void {
    // Enhanced page break with proper footer positioning
    const footerSpace = 30; // Reserve space for footer (increased for multi-line footer)
    if (this.currentY + requiredHeight > this.pageHeight - this.margins.bottom - footerSpace) {
      this.addFooter(branding); // Add footer to current page before breaking
      this.pdf.addPage();
      this.currentY = this.margins.top;
    }
  }

  private async addHeader(branding: BrandingData): Promise<void> {
    const headerHeight = 30;
    
    // Professional gradient header with proper isolation
    const primaryColor = this.hexToRgb(branding.primaryColor);
    this.pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
    this.pdf.rect(0, 0, this.pageWidth, headerHeight, 'F');
    
    // Elegant white logo background circle for contrast
    if (branding.logoUrl) {
      this.pdf.setFillColor(255, 255, 255);
      this.pdf.circle(20, 15, 8, 'F');
    }
    
    // Logo with professional sizing and positioning
    let logoWidth = 28;
    if (branding.logoUrl) {
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          logoImg.onload = resolve;
          logoImg.onerror = reject;
          logoImg.src = branding.logoUrl!;
        });
        
        const logoSize = 14;
        this.pdf.addImage(branding.logoUrl!, 'PNG', 13, 8, logoSize, logoSize);
      } catch (error) {
        console.warn('Failed to load logo:', error);
        logoWidth = 15;
      }
    }
    
    // Professional company branding with proper hierarchy
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(branding.companyName, logoWidth + 15, 12);
    
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text(branding.companyTagline, logoWidth + 15, 18);
    
    // Contact info aligned to the right
    this.pdf.setFontSize(8);
    this.pdf.text(branding.companyEmail, this.pageWidth - 15, 12, { align: 'right' });
    this.pdf.text(branding.companyPhone, this.pageWidth - 15, 18, { align: 'right' });
    
    // Professional separator line with shadow effect
    this.pdf.setDrawColor(255, 255, 255);
    this.pdf.setLineWidth(0.5);
    this.pdf.line(0, headerHeight, this.pageWidth, headerHeight);
    
    // Subtle shadow under header
    this.pdf.setFillColor(0, 0, 0, 0.05);
    this.pdf.rect(0, headerHeight, this.pageWidth, 2, 'F');
    
    this.currentY = headerHeight + 8;
  }

  private addFooter(branding: BrandingData): void {
    const footerY = this.pageHeight - 25;
    const footerHeight = 20;
    
    // Professional footer background - matches unifiedPDFRenderer design
    this.pdf.setFillColor(245, 245, 245);
    this.pdf.rect(0, footerY, this.pageWidth, footerHeight, 'F');
    
    // Elegant top border with professional styling
    this.pdf.setDrawColor(203, 213, 225);
    this.pdf.setLineWidth(0.3);
    this.pdf.line(0, footerY, this.pageWidth, footerY);
    
    // Company details using branding data - comprehensive footer layout
    this.pdf.setTextColor(80, 80, 80);
    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'normal');
    
    // Multi-line footer with complete contact details (matches UnifiedPDFRenderer)
    const footerLine1 = `${branding.companyName} | ${branding.companyPhone} | ${branding.companyEmail}`;
    const footerLine2 = `${branding.companyAddress} | ${branding.websiteUrl || ''}`;
    const footerLine3 = branding.footerText;
    
    this.pdf.text(footerLine1, 15, footerY + 4);
    this.pdf.text(footerLine2, 15, footerY + 8);
    this.pdf.text(footerLine3, 15, footerY + 12);
    
    // Right side - Page number and generation date
    const pageNumber = this.pdf.getCurrentPageInfo().pageNumber;
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
    
    this.pdf.setFontSize(8);
    this.pdf.text(`Page ${pageNumber}`, this.pageWidth - 15, footerY + 8, { align: 'right' });
    this.pdf.setFontSize(7);
    this.pdf.text(`Generated: ${currentDate}`, this.pageWidth - 15, footerY + 12, { align: 'right' });
  }

  private addReportTitle(title: string, period: string, branding: BrandingData): void {
    // Compact title with elegant styling
    const titleColor = this.hexToRgb(branding.primaryColor);
    this.pdf.setTextColor(titleColor.r, titleColor.g, titleColor.b);
    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(title, 15, this.currentY);
    
    // Period subtitle with reduced spacing
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text(period, 15, this.currentY + 6);
    
    // Add decorative underline
    this.pdf.setDrawColor(titleColor.r, titleColor.g, titleColor.b);
    this.pdf.setLineWidth(0.3);
    this.pdf.line(15, this.currentY + 9, 100, this.currentY + 9);
    
    this.currentY += 18;
  }

  private addExecutiveSummary(summary: string, branding: BrandingData): void {
    // Professional section header with enhanced hierarchy
    const sectionColor = this.hexToRgb(branding.primaryColor);
    this.pdf.setTextColor(sectionColor.r, sectionColor.g, sectionColor.b);
    this.pdf.setFontSize(13);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Executive Summary', 15, this.currentY);
    
    // Professional accent line with gradient effect
    this.pdf.setDrawColor(sectionColor.r, sectionColor.g, sectionColor.b);
    this.pdf.setLineWidth(0.8);
    this.pdf.line(15, this.currentY + 2, 80, this.currentY + 2);
    
    // Thinner accent line underneath
    this.pdf.setLineWidth(0.3);
    this.pdf.line(15, this.currentY + 3, 80, this.currentY + 3);
    
    this.currentY += 10;
    
    // Professional summary box with enhanced styling
    const summaryHeight = 20;
    
    // Subtle gradient background
    this.pdf.setFillColor(248, 250, 252);
    this.pdf.rect(15, this.currentY, this.pageWidth - 30, summaryHeight, 'F');
    
    // Left accent border
    this.pdf.setFillColor(sectionColor.r, sectionColor.g, sectionColor.b);
    this.pdf.rect(15, this.currentY, 3, summaryHeight, 'F');
    
    // Professional border with rounded appearance
    this.pdf.setDrawColor(203, 213, 225);
    this.pdf.setLineWidth(0.3);
    this.pdf.rect(15, this.currentY, this.pageWidth - 30, summaryHeight, 'S');
    
    // Content with proper typography
    this.pdf.setTextColor(30, 41, 59);
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    const summaryLines = this.pdf.splitTextToSize(summary, this.pageWidth - 50);
    this.pdf.text(summaryLines, 22, this.currentY + 6);
    
    this.currentY += summaryHeight + 15;
  }

  private addKPICards(kpis: KPIData[], branding: BrandingData): void {
    // Professional section header
    const sectionColor = this.hexToRgb(branding.primaryColor);
    this.pdf.setTextColor(sectionColor.r, sectionColor.g, sectionColor.b);
    this.pdf.setFontSize(13);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Key Performance Indicators', 15, this.currentY);
    
    // Professional accent line with gradient effect
    this.pdf.setDrawColor(sectionColor.r, sectionColor.g, sectionColor.b);
    this.pdf.setLineWidth(0.8);
    this.pdf.line(15, this.currentY + 2, 110, this.currentY + 2);
    
    this.currentY += 12;
    
    // Professional 4-cards-per-row layout with enhanced spacing
    const cardsPerRow = 4;
    const cardSpacing = 4;
    const cardWidth = (this.availableWidth - (cardsPerRow - 1) * cardSpacing) / cardsPerRow;
    const cardHeight = 20;
    
    kpis.forEach((kpi, index) => {
      const row = Math.floor(index / cardsPerRow);
      const col = index % cardsPerRow;
      const xPos = 15 + (col * (cardWidth + cardSpacing));
      const yPos = this.currentY + (row * (cardHeight + cardSpacing));
      
      // Professional card with subtle gradient background
      this.pdf.setFillColor(255, 255, 255);
      this.pdf.rect(xPos, yPos, cardWidth, cardHeight, 'F');
      
      // Enhanced left accent border with gradient effect
      const gradientStart = this.hexToRgb(branding.primaryColor);
      this.pdf.setFillColor(gradientStart.r, gradientStart.g, gradientStart.b);
      this.pdf.rect(xPos, yPos, 3, cardHeight, 'F');
      
      // Professional shadow and border
      this.pdf.setDrawColor(203, 213, 225);
      this.pdf.setLineWidth(0.3);
      this.pdf.rect(xPos, yPos, cardWidth, cardHeight, 'S');
      
      // Enhanced value display with better typography and text fitting
      const valueColor = this.hexToRgb(branding.primaryColor);
      this.pdf.setTextColor(valueColor.r, valueColor.g, valueColor.b);
      this.pdf.setFontSize(12);
      this.pdf.setFont('helvetica', 'bold');
      const fittedValue = this.fitTextToCardWidth(kpi.value, cardWidth - 10, 12);
      this.pdf.setFontSize(fittedValue.fontSize);
      this.pdf.text(fittedValue.text, xPos + 5, yPos + 10);
      
      // Professional label with proper spacing
      this.pdf.setTextColor(71, 85, 105);
      this.pdf.setFontSize(7);
      this.pdf.setFont('helvetica', 'normal');
      const labelLines = this.pdf.splitTextToSize(kpi.label, cardWidth - 10);
      this.pdf.text(labelLines, xPos + 5, yPos + 15);
      
      // Enhanced trend indicator with professional styling
      if (kpi.trend) {
        const trendColor = kpi.trend === 'up' ? '#059669' : kpi.trend === 'down' ? '#dc2626' : '#6b7280';
        const trendRgb = this.hexToRgb(trendColor);
        this.pdf.setTextColor(trendRgb.r, trendRgb.g, trendRgb.b);
        this.pdf.setFontSize(12);
        const trendSymbol = kpi.trend === 'up' ? '↗' : kpi.trend === 'down' ? '↘' : '→';
        this.pdf.text(trendSymbol, xPos + cardWidth - 10, yPos + 8);
        
        // Add trend percentage if available
        if (kpi.change) {
          this.pdf.setFontSize(6);
          this.pdf.text(kpi.change, xPos + cardWidth - 10, yPos + 16, { align: 'right' });
        }
      }
    });
    
    const totalRows = Math.ceil(kpis.length / cardsPerRow);
    this.currentY += (totalRows * (cardHeight + cardSpacing)) + 15;
  }

  private async addCharts(charts: ChartConfig[], branding: BrandingData): Promise<void> {
    if (charts.length === 0) return;
    
    // Professional section header
    const sectionColor = this.hexToRgb(branding.primaryColor);
    this.pdf.setTextColor(sectionColor.r, sectionColor.g, sectionColor.b);
    this.pdf.setFontSize(13);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Visual Analytics', 15, this.currentY);
    
    // Professional accent line with gradient effect
    this.pdf.setDrawColor(sectionColor.r, sectionColor.g, sectionColor.b);
    this.pdf.setLineWidth(0.8);
    this.pdf.line(15, this.currentY + 2, 85, this.currentY + 2);
    
    this.currentY += 12;
    
    // Process charts with enhanced spacing and layout
    for (let i = 0; i < charts.length; i += 2) {
      this.checkPageBreak(70, branding);
      
      const chart1 = charts[i];
      const chart2 = charts[i + 1];
      
      if (chart2 && chart1.type !== 'pie' && chart2.type !== 'pie') {
        // Professional side-by-side layout for compatible charts
        await this.addSideBySideCharts(chart1, chart2, branding);
      } else {
        // Enhanced single chart layout
        await this.addSingleChart(chart1, branding);
        if (chart2) {
          await this.addSingleChart(chart2, branding);
        }
      }
    }
  }

  private async addSideBySideCharts(chart1: ChartConfig, chart2: ChartConfig, branding: BrandingData): Promise<void> {
    const chartWidth = (this.pageWidth - 35) / 2;
    const chartHeight = 45;
    
    try {
      // Generate first chart
      const chartConfig1: ChartDataConfig = {
        type: chart1.type,
        data: chart1.data,
        options: { ...chart1.options, responsive: false, maintainAspectRatio: false, animation: false }
      };
      const chartBase64_1 = await ChartToPDFRenderer.renderChartToBase64(chartConfig1);
      
      // Generate second chart
      const chartConfig2: ChartDataConfig = {
        type: chart2.type,
        data: chart2.data,
        options: { ...chart2.options, responsive: false, maintainAspectRatio: false, animation: false }
      };
      const chartBase64_2 = await ChartToPDFRenderer.renderChartToBase64(chartConfig2);
      
      // Add chart titles
      this.pdf.setTextColor(51, 65, 85);
      this.pdf.setFontSize(10);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text(chart1.title, 15, this.currentY);
      this.pdf.text(chart2.title, 15 + chartWidth + 5, this.currentY);
      
      this.currentY += 6;
      
      // Add chart backgrounds and images
      this.pdf.setFillColor(255, 255, 255);
      this.pdf.rect(15, this.currentY, chartWidth, chartHeight, 'F');
      this.pdf.rect(15 + chartWidth + 5, this.currentY, chartWidth, chartHeight, 'F');
      
      // Add subtle borders
      this.pdf.setDrawColor(226, 232, 240);
      this.pdf.setLineWidth(0.2);
      this.pdf.rect(15, this.currentY, chartWidth, chartHeight, 'S');
      this.pdf.rect(15 + chartWidth + 5, this.currentY, chartWidth, chartHeight, 'S');
      
      this.pdf.addImage(chartBase64_1, 'PNG', 15, this.currentY, chartWidth, chartHeight);
      this.pdf.addImage(chartBase64_2, 'PNG', 15 + chartWidth + 5, this.currentY, chartWidth, chartHeight);
      
      this.currentY += chartHeight + 10;
      
    } catch (error) {
      console.warn('Failed to render side-by-side charts:', error);
      await this.addSingleChart(chart1, branding);
      await this.addSingleChart(chart2, branding);
    }
  }

  private async addSingleChart(chart: ChartConfig, branding: BrandingData): Promise<void> {
    this.checkPageBreak(70, branding);
    
    // Professional chart title with enhanced styling
    this.pdf.setTextColor(30, 41, 59);
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(chart.title, 15, this.currentY);
    
    // Add subtle subtitle if chart has additional context
    this.pdf.setTextColor(100, 116, 139);
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text('Monthly Data Analysis', 15, this.currentY + 5);
    
    this.currentY += 12;
    
    try {
      // Enhanced chart configuration with professional styling
      const chartConfig: ChartDataConfig = {
        type: chart.type,
        data: chart.data,
        options: {
          ...chart.options,
          responsive: false,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            ...chart.options?.plugins,
            legend: {
              display: true,
              position: 'top',
              labels: { 
                usePointStyle: true, 
                padding: 12, 
                font: { size: 9 },
                boxWidth: 12
              }
            },
            title: {
              display: false // Title handled separately for better control
            }
          },
          scales: {
            ...chart.options?.scales,
            x: {
              ...chart.options?.scales?.x,
              grid: { display: true, color: '#f1f5f9' },
              ticks: { font: { size: 8 } }
            },
            y: {
              ...chart.options?.scales?.y,
              grid: { display: true, color: '#f1f5f9' },
              ticks: { font: { size: 8 } }
            }
          }
        }
      };
      
      const chartBase64 = await ChartToPDFRenderer.renderChartToBase64(chartConfig);
      
      // Professional chart container with enhanced styling
      const chartWidth = this.pageWidth - 30;
      const chartHeight = 55;
      
      // Chart background with professional border
      this.pdf.setFillColor(255, 255, 255);
      this.pdf.rect(15, this.currentY, chartWidth, chartHeight, 'F');
      
      // Enhanced border with subtle shadow effect
      this.pdf.setDrawColor(203, 213, 225);
      this.pdf.setLineWidth(0.4);
      this.pdf.rect(15, this.currentY, chartWidth, chartHeight, 'S');
      
      // Add subtle shadow
      this.pdf.setFillColor(0, 0, 0, 0.03);
      this.pdf.rect(16, this.currentY + 1, chartWidth, chartHeight, 'F');
      
      this.pdf.addImage(chartBase64, 'PNG', 15, this.currentY, chartWidth, chartHeight);
      this.currentY += chartHeight + 15;
      
    } catch (error) {
      console.warn('Failed to render chart:', error);
      this.pdf.setTextColor(100, 116, 139);
      this.pdf.setFontSize(9);
      this.pdf.text('Chart rendering temporarily unavailable', 15, this.currentY);
      this.currentY += 20;
    }
  }

  private addDataTable(data: Array<Record<string, any>>, branding: BrandingData): void {
    if (!data || data.length === 0) return;
    
    // Calculate available space and table dimensions
    const headers = Object.keys(data[0]);
    const tableWidth = this.availableWidth;
    const colWidth = Math.max(20, tableWidth / headers.length); // Minimum column width
    const rowHeight = 4.5; // Ultra-compact row height
    const headerHeight = 6;
    
    // Check space for section header
    this.checkPageBreak(15, branding);
    
    // Ultra-compact section header
    const sectionColor = this.hexToRgb(branding.primaryColor);
    this.pdf.setTextColor(sectionColor.r, sectionColor.g, sectionColor.b);
    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Detailed Data', this.margins.left, this.currentY);
    
    // Micro accent line
    this.pdf.setDrawColor(sectionColor.r, sectionColor.g, sectionColor.b);
    this.pdf.setLineWidth(0.3);
    this.pdf.line(this.margins.left, this.currentY + 1, this.margins.left + 40, this.currentY + 1);
    
    this.currentY += 6;
    
    this.renderTableWithPagination(data, headers, tableWidth, colWidth, rowHeight, headerHeight, branding);
  }

  private renderTableWithPagination(
    data: Array<Record<string, any>>, 
    headers: string[], 
    tableWidth: number, 
    colWidth: number, 
    rowHeight: number, 
    headerHeight: number, 
    branding: BrandingData
  ): void {
    let currentDataIndex = 0;
    let isFirstTable = true;
    
    while (currentDataIndex < data.length) {
      // Calculate available space with proper buffer for footer
      const footerBuffer = 25; // Space for footer
      const availableSpace = this.pageHeight - this.margins.bottom - this.currentY - footerBuffer;
      const maxRowsOnPage = Math.floor((availableSpace - headerHeight) / rowHeight);
      const rowsToRender = Math.min(maxRowsOnPage, data.length - currentDataIndex);
      
      // If not enough space for header and at least 3 rows, start new page
      if (rowsToRender < 3 && availableSpace < (headerHeight + 3 * rowHeight)) {
        this.pdf.addPage();
        this.currentY = this.margins.top;
        this.addFooter(branding);
        isFirstTable = false;
        continue;
      }
      
      // Add continuation indicator for subsequent pages
      if (!isFirstTable && currentDataIndex > 0) {
        this.pdf.setTextColor(100, 116, 139);
        this.pdf.setFontSize(8);
        this.pdf.setFont('helvetica', 'italic');
        this.pdf.text('(Continued from previous page)', 15, this.currentY);
        this.currentY += 6;
      }
      
      // Render table header with proper styling
      this.renderTableHeader(headers, tableWidth, colWidth, headerHeight, branding);
      
      // Render data rows with enhanced styling
      const pageData = data.slice(currentDataIndex, currentDataIndex + rowsToRender);
      this.renderTableRows(pageData, headers, tableWidth, colWidth, rowHeight);
      
      // Add table border
      this.pdf.setDrawColor(226, 232, 240);
      this.pdf.setLineWidth(0.1);
      this.pdf.rect(this.margins.left, this.currentY - (rowsToRender * rowHeight) - headerHeight, 
                    tableWidth, (rowsToRender * rowHeight) + headerHeight, 'S');
      
      currentDataIndex += rowsToRender;
      
      // Add continuation indicator if there's more data
      if (currentDataIndex < data.length) {
        this.pdf.setTextColor(100, 116, 139);
        this.pdf.setFontSize(6);
        this.pdf.setFont('helvetica', 'italic');
        this.pdf.text(`Continued on next page (${data.length - currentDataIndex} more items)`, 
                     this.margins.left, this.currentY + 3);
        
        this.pdf.addPage();
        this.currentY = this.margins.top;
        this.addFooter(branding);
      } else {
        this.currentY += 5;
      }
    }
  }

  private renderTableHeader(headers: string[], tableWidth: number, colWidth: number, headerHeight: number, branding: BrandingData): void {
    const headerColor = this.hexToRgb(branding.primaryColor);
    
    // Ultra-compact header background
    this.pdf.setFillColor(headerColor.r, headerColor.g, headerColor.b);
    this.pdf.rect(this.margins.left, this.currentY, tableWidth, headerHeight, 'F');
    
    // Subtle gradient overlay
    this.pdf.setFillColor(Math.min(255, headerColor.r + 10), Math.min(255, headerColor.g + 10), Math.min(255, headerColor.b + 10));
    this.pdf.rect(this.margins.left, this.currentY + headerHeight - 1, tableWidth, 1, 'F');
    
    // Header text
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(6);
    this.pdf.setFont('helvetica', 'bold');
    
    headers.forEach((header, index) => {
      const headerText = header.charAt(0).toUpperCase() + header.slice(1).toLowerCase();
      const maxHeaderLength = Math.floor(colWidth / 1.2);
      const truncatedHeader = headerText.length > maxHeaderLength ? 
        headerText.substring(0, maxHeaderLength - 2) + '..' : headerText;
      
      this.pdf.text(truncatedHeader, this.margins.left + 1 + (index * colWidth), this.currentY + 4);
    });
    
    this.currentY += headerHeight;
  }

  private renderTableRows(data: Array<Record<string, any>>, headers: string[], tableWidth: number, colWidth: number, rowHeight: number): void {
    data.forEach((row, rowIndex) => {
      // Ultra-subtle alternating row colors
      if (rowIndex % 2 === 0) {
        this.pdf.setFillColor(252, 253, 254);
        this.pdf.rect(this.margins.left, this.currentY, tableWidth, rowHeight, 'F');
      }
      
      this.pdf.setTextColor(71, 85, 105);
      this.pdf.setFontSize(5.5);
      this.pdf.setFont('helvetica', 'normal');
      
      headers.forEach((header, index) => {
        const value = String(row[header] || '');
        const maxLength = Math.floor(colWidth / 1.1);
        const truncatedValue = value.length > maxLength ? 
          value.substring(0, maxLength - 2) + '..' : value;
        
        this.pdf.text(truncatedValue, this.margins.left + 1 + (index * colWidth), this.currentY + 3);
      });
      
      this.currentY += rowHeight;
    });
  }

  private fitTextToCardWidth(text: string, maxWidth: number, fontSize: number): { text: string; fontSize: number } {
    this.pdf.setFontSize(fontSize);
    const textWidth = this.pdf.getTextWidth(text);
    
    if (textWidth <= maxWidth) {
      return { text, fontSize };
    }
    
    // Try compact formatting for large numbers
    const compactText = this.getCompactValue(text);
    if (compactText !== text) {
      const compactWidth = this.pdf.getTextWidth(compactText);
      if (compactWidth <= maxWidth) {
        return { text: compactText, fontSize };
      }
    }
    
    // Scale down font size if needed
    const scaleFactor = maxWidth / textWidth;
    const newFontSize = Math.max(8, fontSize * scaleFactor);
    return { text, fontSize: newFontSize };
  }

  private getCompactValue(text: string): string {
    const numberMatch = text.match(/[\d,]+\.?\d*/);
    if (!numberMatch) return text;
    
    const numStr = numberMatch[0].replace(/,/g, '');
    const num = parseFloat(numStr);
    
    if (isNaN(num)) return text;
    
    // Use the new compactCurrency helper for consistent formatting
    const compactFormatted = compactCurrency(num);
    return text.replace(numberMatch[0], compactFormatted.replace(/^[A-Z]+ /, ''));
  }

  async generateReport(content: ReportContent, branding?: BrandingData): Promise<void> {
    // Load branding from localStorage if not provided (Super Admin integration)
    const finalBranding = branding || this.loadBrandingFromStorage();
    
    // Phase 1: Header Structure Redesign - Professional isolated header
    await this.addHeader(finalBranding);
    
    // Phase 2: Dynamic title with clear visual hierarchy
    this.addReportTitle(content.title, content.period, finalBranding);
    
    // Phase 3: Enhanced executive summary with professional styling
    this.addExecutiveSummary(content.summary, finalBranding);
    
    // Phase 4: Professional KPI cards with enhanced design
    this.addKPICards(content.kpis, finalBranding);
    
    // Phase 5: Chart integration with scalability and proper titles
    await this.addCharts(content.charts, finalBranding);
    
    // Phase 6: Dynamic table management with smart pagination
    if (content.tableData && content.tableData.length > 0) {
      this.addDataTable(content.tableData, finalBranding);
    }
    
    // Phase 7: Professional layout system - Fixed footer positioning
    this.addFooter(finalBranding);
    
    // Save with professional naming convention
    const timestamp = new Date().toISOString().split('T')[0];
    this.pdf.save(`${content.title.replace(/\s+/g, '_')}_${timestamp}.pdf`);
  }

  private loadBrandingFromStorage(): BrandingData {
    return BrandingService.loadBranding();
  }
}