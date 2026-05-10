import jsPDF from 'jspdf';

export interface LayoutConstraints {
  pageHeight: number;
  pageWidth: number;
  margins: { top: number; bottom: number; left: number; right: number };
  headerHeight: number;
  footerHeight: number;
}

export class PDFLayoutOptimizer {
  private pdf: jsPDF;
  private constraints: LayoutConstraints;

  constructor(pdf: jsPDF, constraints: LayoutConstraints) {
    this.pdf = pdf;
    this.constraints = constraints;
  }

  /**
   * Calculate available content height on current page
   */
  getAvailableHeight(currentY: number): number {
    const usablePageHeight = this.constraints.pageHeight - this.constraints.margins.bottom - this.constraints.footerHeight;
    return usablePageHeight - currentY;
  }

  /**
   * Check if content will fit on current page, considering section breaks
   */
  willContentFit(currentY: number, requiredHeight: number, allowPartialContent = false): boolean {
    const availableHeight = this.getAvailableHeight(currentY);
    
    if (allowPartialContent) {
      // For tables or lists, allow partial content if at least 30% can fit
      return availableHeight >= (requiredHeight * 0.3);
    }
    
    return availableHeight >= requiredHeight;
  }

  /**
   * Smart page break with section awareness
   */
  addPageBreakIfNeeded(currentY: number, requiredHeight: number, sectionType: 'header' | 'kpi' | 'chart' | 'table' | 'content'): number {
    if (!this.willContentFit(currentY, requiredHeight, sectionType === 'table')) {
      this.pdf.addPage();
      return this.constraints.margins.top + this.constraints.headerHeight + 8; // Account for header
    }
    return currentY;
  }

  /**
   * Calculate optimal column widths for tables
   */
  calculateColumnWidths(headers: string[], availableWidth: number): number[] {
    const minColumnWidth = 20; // Minimum column width in mm
    const maxColumns = Math.floor(availableWidth / minColumnWidth);
    
    if (headers.length <= maxColumns) {
      // Equal width columns
      const columnWidth = availableWidth / headers.length;
      return new Array(headers.length).fill(columnWidth);
    }
    
    // Prioritize important columns (those with shorter names or common patterns)
    const priorities = headers.map((header, index) => ({
      index,
      priority: this.getColumnPriority(header),
      width: minColumnWidth
    }));
    
    // Sort by priority and assign remaining space
    priorities.sort((a, b) => b.priority - a.priority);
    
    const remainingWidth = availableWidth - (headers.length * minColumnWidth);
    const highPriorityColumns = priorities.slice(0, Math.min(3, priorities.length));
    const extraWidthPerColumn = remainingWidth / highPriorityColumns.length;
    
    const widths = new Array(headers.length).fill(minColumnWidth);
    highPriorityColumns.forEach(col => {
      widths[col.index] += extraWidthPerColumn;
    });
    
    return widths;
  }

  /**
   * Determine column priority based on header content
   */
  private getColumnPriority(header: string): number {
    const headerLower = header.toLowerCase();
    
    // High priority columns
    if (headerLower.includes('name') || headerLower.includes('tenant') || headerLower.includes('property')) {
      return 10;
    }
    
    // Medium priority columns
    if (headerLower.includes('amount') || headerLower.includes('rent') || headerLower.includes('date') || headerLower.includes('status')) {
      return 8;
    }
    
    // Standard priority
    if (headerLower.includes('description') || headerLower.includes('type') || headerLower.includes('unit')) {
      return 6;
    }
    
    // Lower priority for IDs, timestamps, etc.
    if (headerLower.includes('id') || headerLower.includes('created') || headerLower.includes('updated')) {
      return 3;
    }
    
    return 5; // Default priority
  }

  /**
   * Optimize content layout to prevent orphaned sections
   */
  preventOrphanedContent(currentY: number, contentSections: { height: number; type: string }[]): number {
    let optimizedY = currentY;
    const availableHeight = this.getAvailableHeight(currentY);
    
    // If multiple small sections can fit together, keep them together
    let combinedHeight = 0;
    let sectionsToKeepTogether = 0;
    
    for (const section of contentSections) {
      if (combinedHeight + section.height <= availableHeight) {
        combinedHeight += section.height;
        sectionsToKeepTogether++;
      } else {
        break;
      }
    }
    
    // If we can't fit at least 2 sections, move to next page
    if (sectionsToKeepTogether < 2 && contentSections.length > 1) {
      this.pdf.addPage();
      optimizedY = this.constraints.margins.top + this.constraints.headerHeight + 8;
    }
    
    return optimizedY;
  }

  /**
   * Get optimal spacing between sections based on content density
   */
  getOptimalSpacing(sectionType: 'title' | 'kpi' | 'chart' | 'table' | 'text', contentDensity: 'low' | 'medium' | 'high'): number {
    const baseSpacing = {
      title: 8,
      kpi: 6,
      chart: 8,
      table: 6,
      text: 4
    };
    
    const densityMultiplier = {
      low: 1.5,
      medium: 1.0,
      high: 0.7
    };
    
    return baseSpacing[sectionType] * densityMultiplier[contentDensity];
  }

  /**
   * Check if we're near the bottom of the page
   */
  isNearPageBottom(currentY: number, threshold = 30): boolean {
    const availableHeight = this.getAvailableHeight(currentY);
    return availableHeight <= threshold;
  }
}
