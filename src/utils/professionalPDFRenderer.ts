import jsPDF from 'jspdf';
import { Chart as ChartJS } from 'chart.js';
import { formatAmount } from './currency';

// Zira Homes Brand Colors
const BRAND_COLORS = {
  navy: '#1A1E3F',
  orange: '#FF6B35', 
  lightGrey: '#F5F5F5',
  success: '#4CAF50',
  warning: '#FBBC05',
  error: '#EA4335',
  white: '#FFFFFF',
  text: '#2C3E50',
  textMuted: '#6C757D'
};

export interface PDFReportData {
  reportTitle: string;
  reportType: string;
  landlordName?: string;
  dateGenerated: string;
  executiveSummary: string;
  kpiData: Array<{
    label: string;
    value: string;
    icon?: string;
    color?: string;
  }>;
  chartData?: any;
  tableData?: Array<Record<string, any>>;
  additionalSections?: Array<{
    title: string;
    content: string;
  }>;
}

export class ProfessionalPDFRenderer {
  private pdf: jsPDF;
  private currentY: number = 0;
  private pageHeight: number;
  private pageWidth: number;
  private margins = { top: 20, bottom: 30, left: 20, right: 20 };

  constructor() {
    this.pdf = new jsPDF('portrait', 'mm', 'a4');
    this.pageHeight = this.pdf.internal.pageSize.height;
    this.pageWidth = this.pdf.internal.pageSize.width;
  }

  private checkPageBreak(requiredHeight: number): void {
    if (this.currentY + requiredHeight > this.pageHeight - this.margins.bottom) {
      this.pdf.addPage();
      this.currentY = this.margins.top;
      this.addWatermark();
    }
  }

  private addWatermark(): void {
    this.pdf.saveGraphicsState();
    this.pdf.setGState(this.pdf.GState({ opacity: 0.1 }));
    this.pdf.setTextColor(26, 30, 63); // Navy
    this.pdf.setFontSize(60);
    this.pdf.setFont('helvetica', 'bold');
    
    this.pdf.text('ZIRA HOMES', this.pageWidth / 2, this.pageHeight / 2, {
      angle: 45,
      align: 'center'
    });
    
    this.pdf.restoreGraphicsState();
  }

  private addHeader(data: PDFReportData): void {
    // Navy header background
    this.pdf.setFillColor(26, 30, 63);
    this.pdf.rect(0, 0, this.pageWidth, 35, 'F');
    
    // Zira Homes logo/text
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(24);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('ZIRA HOMES', this.margins.left, 22);
    
    // Date generated
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.text(`Generated: ${data.dateGenerated}`, this.pageWidth - this.margins.right - 40, 18);
    
    // Report title
    this.pdf.setTextColor(26, 30, 63);
    this.pdf.setFontSize(20);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(data.reportTitle, this.margins.left, 50);
    
    // Prepared for subtitle
    if (data.landlordName) {
      this.pdf.setFontSize(12);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(108, 117, 125);
      this.pdf.text(`Prepared for: ${data.landlordName}`, this.margins.left, 60);
      this.currentY = 75;
    } else {
      this.currentY = 65;
    }
  }

  private addExecutiveSummary(summary: string): void {
    this.checkPageBreak(25);
    
    this.pdf.setTextColor(26, 30, 63);
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Executive Summary', this.margins.left, this.currentY);
    this.currentY += 8;
    
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(44, 62, 80);
    
    const summaryLines = this.pdf.splitTextToSize(summary, this.pageWidth - this.margins.left - this.margins.right);
    this.pdf.text(summaryLines, this.margins.left, this.currentY);
    this.currentY += summaryLines.length * 4 + 10;
  }

  private addKPICards(kpiData: Array<{ label: string; value: string; color?: string }>): void {
    this.checkPageBreak(40);
    
    this.pdf.setTextColor(26, 30, 63);
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Key Performance Indicators', this.margins.left, this.currentY);
    this.currentY += 12;
    
    const cardSpacing = 6;
    const cardWidth = (this.pageWidth - this.margins.left - this.margins.right - (3 * cardSpacing)) / 4;
    const cardHeight = 32; // Increased height for better padding
    const cardPadding = Math.max(6, cardWidth * 0.06); // Dynamic padding
    
    kpiData.slice(0, 4).forEach((kpi, index) => {
      const x = this.margins.left + index * (cardWidth + cardSpacing);
      
      // Card background with subtle gradient effect
      this.pdf.setFillColor(248, 250, 252); // Very light blue-grey
      this.pdf.rect(x, this.currentY, cardWidth, cardHeight, 'F');
      
      // Enhanced card border
      this.pdf.setDrawColor(26, 30, 63);
      this.pdf.setLineWidth(0.5);
      this.pdf.rect(x, this.currentY, cardWidth, cardHeight);
      
      // Add subtle inner shadow effect
      this.pdf.setDrawColor(230, 230, 230);
      this.pdf.setLineWidth(0.2);
      this.pdf.line(x + 0.5, this.currentY + 0.5, x + cardWidth - 0.5, this.currentY + 0.5);
      this.pdf.line(x + 0.5, this.currentY + 0.5, x + 0.5, this.currentY + cardHeight - 0.5);
      
      // KPI Value with enhanced positioning and fitting
      this.pdf.setTextColor(26, 30, 63);
      this.pdf.setFont('helvetica', 'bold');
      
      const maxValueWidth = cardWidth - cardPadding * 2;
      const fittedValue = this.fitCurrencyTextInWidth(kpi.value, maxValueWidth, 14, 9);
      this.pdf.setFontSize(fittedValue.fontSize);
      
      // Center-align value text
      const valueWidth = this.pdf.getTextWidth(fittedValue.text);
      const valueCenterX = x + (cardWidth - valueWidth) / 2;
      this.pdf.text(fittedValue.text, valueCenterX, this.currentY + cardHeight * 0.45);
      
      // KPI label with better positioning
      this.pdf.setTextColor(100, 116, 139); // Slightly darker grey for better contrast
      this.pdf.setFont('helvetica', 'normal');
      
      const maxLabelWidth = cardWidth - cardPadding * 2;
      const fittedLabel = this.fitTextInWidth(kpi.label, maxLabelWidth, 8, 6);
      this.pdf.setFontSize(fittedLabel.fontSize);
      
      // Center-align label text
      const labelWidth = this.pdf.getTextWidth(fittedLabel.text);
      const labelCenterX = x + (cardWidth - labelWidth) / 2;
      this.pdf.text(fittedLabel.text, labelCenterX, this.currentY + cardHeight - 7);
    });
    
    this.currentY += cardHeight + 15;
  }

  private addDataTable(
    title: string, 
    headers: string[], 
    data: Array<Record<string, any>>,
    maxRows: number = 10
  ): void {
    this.checkPageBreak(50);
    
    this.pdf.setTextColor(26, 30, 63);
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(title, this.margins.left, this.currentY);
    this.currentY += 10;
    
    const tableWidth = this.pageWidth - this.margins.left - this.margins.right;
    const colWidth = tableWidth / headers.length;
    const rowHeight = 8;
    
    // Table headers
    this.pdf.setFillColor(26, 30, 63);
    this.pdf.rect(this.margins.left, this.currentY, tableWidth, rowHeight, 'F');
    
    this.pdf.setTextColor(255, 255, 255);
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'bold');
    
    headers.forEach((header, index) => {
      this.pdf.text(header, this.margins.left + index * colWidth + 2, this.currentY + 6);
    });
    
    this.currentY += rowHeight;
    
    // Table data
    const limitedData = data.slice(0, maxRows);
    limitedData.forEach((row, rowIndex) => {
      // Alternating row colors
      if (rowIndex % 2 === 0) {
        this.pdf.setFillColor(249, 249, 249);
        this.pdf.rect(this.margins.left, this.currentY, tableWidth, rowHeight, 'F');
      }
      
      this.pdf.setTextColor(44, 62, 80);
      this.pdf.setFontSize(8);
      this.pdf.setFont('helvetica', 'normal');
      
      headers.forEach((header, colIndex) => {
        const cellValue = row[header] || '';
        const text = typeof cellValue === 'number' && header.toLowerCase().includes('amount') 
          ? formatAmount(cellValue)
          : String(cellValue);
        
        this.pdf.text(
          this.pdf.splitTextToSize(text, colWidth - 4)[0] || '',
          this.margins.left + colIndex * colWidth + 2,
          this.currentY + 6
        );
      });
      
      this.currentY += rowHeight;
    });
    
    this.currentY += 10;
  }

  private addFooter(pageNumber: number, totalPages: number): void {
    const footerY = this.pageHeight - 20;
    
    // Footer line
    this.pdf.setDrawColor(233, 236, 239);
    this.pdf.line(this.margins.left, footerY, this.pageWidth - this.margins.right, footerY);
    
    // Footer content
    this.pdf.setTextColor(108, 117, 125);
    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'normal');
    
    this.pdf.text('Zira Homes © 2025 – www.zira-tech.com', this.margins.left, footerY + 5);
    this.pdf.text(`Page ${pageNumber} of ${totalPages}`, this.pageWidth - this.margins.right - 30, footerY + 5);
    this.pdf.text('Phone: +254-757-878-023', this.margins.left, footerY + 9);
    this.pdf.text('Email: info@ziratech.com', this.margins.left, footerY + 13);
    this.pdf.text('Website: zira-tech.com', this.margins.left, footerY + 17);
  }

  private getCompactValue(text: string): string {
    // Extract numeric value for compact formatting
    const numericMatch = text.match(/([\d,.-]+)/);
    if (!numericMatch) return text;
    
    const numStr = numericMatch[1].replace(/,/g, '');
    const num = parseFloat(numStr);
    
    if (isNaN(num)) return text;
    
    // Format large numbers compactly
    const prefix = text.substring(0, text.indexOf(numericMatch[1]));
    const suffix = text.substring(text.indexOf(numericMatch[1]) + numericMatch[1].length);
    
    if (Math.abs(num) >= 1000000) {
      return `${prefix}${(num / 1000000).toFixed(1)}M${suffix}`;
    } else if (Math.abs(num) >= 1000) {
      return `${prefix}${(num / 1000).toFixed(1)}K${suffix}`;
    }
    
    return text;
  }

  private fitCurrencyTextInWidth(text: string, maxWidth: number, maxFontSize: number = 12, minFontSize: number = 6): { text: string; fontSize: number } {
    let fontSize = maxFontSize;
    
    // Extract currency symbol and numeric part
    const currencyMatch = text.match(/([^\d\s,.-]+)?\s*([\d,.-]+)\s*([^\d\s,.-]+)?/);
    const prefix = currencyMatch?.[1] || '';
    const number = currencyMatch?.[2] || text;
    const suffix = currencyMatch?.[3] || '';
    
    // Try original text at different font sizes
    while (fontSize >= minFontSize) {
      this.pdf.setFontSize(fontSize);
      const textWidth = this.pdf.getTextWidth(text);
      
      if (textWidth <= maxWidth) {
        return { text, fontSize };
      }
      
      fontSize -= 0.5;
    }
    
    // If still too wide, try compact formatting
    const compactText = this.getCompactValue(text);
    fontSize = maxFontSize;
    
    while (fontSize >= minFontSize) {
      this.pdf.setFontSize(fontSize);
      const textWidth = this.pdf.getTextWidth(compactText);
      
      if (textWidth <= maxWidth) {
        return { text: compactText, fontSize };
      }
      
      fontSize -= 0.5;
    }
    
    // Last resort: truncate with ellipsis
    fontSize = minFontSize;
    this.pdf.setFontSize(fontSize);
    
    let truncated = text;
    while (this.pdf.getTextWidth(truncated + '...') > maxWidth && truncated.length > 3) {
      truncated = truncated.slice(0, -1);
    }
    
    return { text: truncated + '...', fontSize };
  }

  private fitTextInWidth(text: string, maxWidth: number, maxFontSize: number = 12, minFontSize: number = 6): { text: string; fontSize: number } {
    let fontSize = maxFontSize;
    let fittedText = text;
    
    // Try original text at different font sizes
    while (fontSize >= minFontSize) {
      this.pdf.setFontSize(fontSize);
      const textWidth = this.pdf.getTextWidth(fittedText);
      
      if (textWidth <= maxWidth) {
        return { text: fittedText, fontSize };
      }
      
      fontSize -= 0.5;
    }
    
    // If still doesn't fit, try compact number formatting
    const numberMatch = text.match(/[\d,]+\.?\d*/);
    if (numberMatch) {
      const numStr = numberMatch[0].replace(/,/g, '');
      const num = parseFloat(numStr);
      if (!isNaN(num)) {
        if (num >= 1000000) {
          fittedText = `${(num / 1000000).toFixed(1)}M`;
        } else if (num >= 1000) {
          fittedText = `${(num / 1000).toFixed(1)}K`;
        }
        
        // Try again with formatted number
        fontSize = maxFontSize;
        while (fontSize >= minFontSize) {
          this.pdf.setFontSize(fontSize);
          const textWidth = this.pdf.getTextWidth(fittedText);
          
          if (textWidth <= maxWidth) {
            return { text: fittedText, fontSize };
          }
          
          fontSize -= 0.5;
        }
      }
    }
    
    // Last resort: truncate with ellipsis
    fontSize = minFontSize;
    this.pdf.setFontSize(fontSize);
    while (fittedText.length > 0) {
      const testText = fittedText.length <= 3 ? fittedText : fittedText.substring(0, fittedText.length - 3) + '...';
      const textWidth = this.pdf.getTextWidth(testText);
      
      if (textWidth <= maxWidth) {
        return { text: testText, fontSize };
      }
      
      fittedText = fittedText.substring(0, fittedText.length - 1);
    }
    
    return { text: '...', fontSize: minFontSize };
  }

  public async generatePDF(data: PDFReportData): Promise<void> {
    // Add watermark
    this.addWatermark();
    
    // Add header
    this.addHeader(data);
    
    // Add executive summary
    this.addExecutiveSummary(data.executiveSummary);
    
    // Add KPI cards
    if (data.kpiData && data.kpiData.length > 0) {
      this.addKPICards(data.kpiData);
    }
    
    // Add data table if available
    if (data.tableData && data.tableData.length > 0) {
      const headers = Object.keys(data.tableData[0]);
      this.addDataTable('Detailed Data', headers, data.tableData);
    }
    
    // Add additional sections
    if (data.additionalSections) {
      data.additionalSections.forEach(section => {
        this.checkPageBreak(20);
        
        this.pdf.setTextColor(26, 30, 63);
        this.pdf.setFontSize(14);
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.text(section.title, this.margins.left, this.currentY);
        this.currentY += 8;
        
        this.pdf.setFontSize(10);
        this.pdf.setFont('helvetica', 'normal');
        this.pdf.setTextColor(44, 62, 80);
        
        const contentLines = this.pdf.splitTextToSize(section.content, this.pageWidth - this.margins.left - this.margins.right);
        this.pdf.text(contentLines, this.margins.left, this.currentY);
        this.currentY += contentLines.length * 4 + 10;
      });
    }
    
    // Add footers to all pages
    const totalPages = this.pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      this.pdf.setPage(i);
      this.addFooter(i, totalPages);
    }
    
    // Download the PDF
    const fileName = `${data.reportTitle.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
    this.pdf.save(fileName);
  }
}