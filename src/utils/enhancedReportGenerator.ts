import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { BrandingData } from './brandingService';
import { getGlobalCurrencySync } from './currency';

export interface EnhancedReportData {
  title: string;
  period: string;
  property: string;
  data: any[];
  type: 'financial' | 'occupancy' | 'maintenance' | 'rent-roll';
  kpis?: Array<{ label: string; value: string; trend?: 'up' | 'down' | 'stable' }>;
  summary?: string;
  branding?: BrandingData;
}

export const generateEnhancedHTMLReport = async (reportData: EnhancedReportData): Promise<string> => {
  const reportHtml = createEnhancedReportHTML(reportData);
  
  // Create a new window for preview
  const previewWindow = window.open('', '_blank', 'width=1000,height=800');
  if (previewWindow) {
    previewWindow.document.write(reportHtml);
    previewWindow.document.close();
    return 'Enhanced report preview opened';
  }
  throw new Error('Failed to open preview window');
};

export const generateEnhancedReportPDF = async (reportData: EnhancedReportData): Promise<void> => {
  // Create temporary container with optimized dimensions
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = createEnhancedReportHTML(reportData);
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.width = '1200px'; // Wider for better chart rendering
  tempDiv.style.backgroundColor = 'white';
  document.body.appendChild(tempDiv);

  try {
    const reportContainer = tempDiv.querySelector('.enhanced-report-content') as HTMLElement;
    
    // Enhanced html2canvas options for better quality
    const canvas = await html2canvas(reportContainer, {
      scale: 2.5, // Higher resolution
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 1200,
      height: reportContainer.scrollHeight,
      scrollX: 0,
      scrollY: 0,
      foreignObjectRendering: true
    });

    // Create optimized PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png', 1.0);
    
    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const marginTop = 10;
    const marginBottom = 10;
    const availableHeight = pageHeight - marginTop - marginBottom;
    
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let currentY = marginTop;
    let remainingHeight = imgHeight;
    let pageNumber = 1;
    
    // Smart page splitting algorithm
    while (remainingHeight > 0) {
      const heightToAdd = Math.min(remainingHeight, availableHeight);
      const sourceY = imgHeight - remainingHeight;
      
      if (pageNumber > 1) {
        pdf.addPage();
      }
      
      pdf.addImage(
        imgData, 
        'PNG', 
        0, 
        currentY, 
        imgWidth, 
        heightToAdd
      );
      
      remainingHeight -= heightToAdd;
      pageNumber++;
      currentY = marginTop;
    }
    
    // Enhanced filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `${reportData.title.toLowerCase().replace(/\s+/g, '-')}-${reportData.period}-${timestamp}.pdf`;
    pdf.save(filename);
    
  } finally {
    document.body.removeChild(tempDiv);
  }
};

const createEnhancedReportHTML = (reportData: EnhancedReportData): string => {
  const branding = reportData.branding;
  const layoutDensity = branding?.reportLayout?.layoutDensity || 'standard';
  const contentFlow = branding?.reportLayout?.contentFlow || 'traditional';
  
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${reportData.title}</title>
      <style>
        ${getEnhancedReportStyles(layoutDensity, contentFlow, branding)}
      </style>
    </head>
    <body>
      <div class="enhanced-report-content">
        ${generateEnhancedHeader(reportData, branding)}
        ${generateMetaSection(reportData, currentDate, layoutDensity)}
        ${generateKPISection(reportData.kpis || [], layoutDensity, branding)}
        ${generateSummarySection(reportData.summary, layoutDensity)}
        ${generateEnhancedReportContent(reportData, contentFlow)}
        ${generateEnhancedFooter(branding, currentDate)}
      </div>
    </body>
    </html>
  `;
};

const getEnhancedReportStyles = (layoutDensity: string, contentFlow: string, branding?: BrandingData): string => {
  const primaryColor = branding?.primaryColor || '#1B365D';
  const secondaryColor = branding?.secondaryColor || '#F36F21';
  
  const spacingMultiplier = layoutDensity === 'compact' ? 0.7 : layoutDensity === 'spacious' ? 1.4 : 1.0;
  const basePadding = 20 * spacingMultiplier;
  const baseMargin = 15 * spacingMultiplier;
  
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.4;
      color: #2d3748;
      background: #ffffff;
    }
    
    .enhanced-report-content {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: ${basePadding}px;
      min-height: 100vh;
    }
    
    .report-header {
      background: linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd);
      color: white;
      padding: ${basePadding}px;
      margin-bottom: ${baseMargin}px;
      border-radius: 8px;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    
    .report-header h1 {
      font-size: ${32 * spacingMultiplier}px;
      margin-bottom: ${8 * spacingMultiplier}px;
      font-weight: 700;
    }
    
    .report-header .subtitle {
      font-size: ${16 * spacingMultiplier}px;
      opacity: 0.9;
    }
    
    .meta-section {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: ${baseMargin}px;
      padding: ${basePadding}px;
      background: #f7fafc;
      border-radius: 8px;
      margin-bottom: ${baseMargin}px;
      border-left: 4px solid ${secondaryColor};
    }
    
    .meta-item {
      text-align: center;
    }
    
    .meta-label {
      font-weight: 600;
      color: #4a5568;
      font-size: ${12 * spacingMultiplier}px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: ${4 * spacingMultiplier}px;
    }
    
    .meta-value {
      font-size: ${16 * spacingMultiplier}px;
      color: #1a202c;
      font-weight: 500;
    }
    
    .kpi-section {
      margin-bottom: ${baseMargin * 1.5}px;
    }
    
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: ${baseMargin * 0.8}px;
      margin-bottom: ${baseMargin}px;
    }
    
    .kpi-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: ${basePadding * 0.8}px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      border-top: 3px solid ${secondaryColor};
      transition: transform 0.2s ease;
    }
    
    .kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0,0,0,0.1);
    }
    
    .kpi-value {
      font-size: ${28 * spacingMultiplier}px;
      font-weight: 700;
      color: ${primaryColor};
      margin-bottom: ${6 * spacingMultiplier}px;
      line-height: 1.1;
    }
    
    .kpi-label {
      color: #718096;
      font-size: ${13 * spacingMultiplier}px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    
    .summary-section {
      background: linear-gradient(135deg, #f7fafc, #edf2f7);
      border-radius: 8px;
      padding: ${basePadding}px;
      margin-bottom: ${baseMargin}px;
      border-left: 4px solid ${primaryColor};
    }
    
    .summary-title {
      font-size: ${18 * spacingMultiplier}px;
      font-weight: 600;
      color: ${primaryColor};
      margin-bottom: ${baseMargin * 0.5}px;
    }
    
    .summary-text {
      font-size: ${14 * spacingMultiplier}px;
      line-height: 1.6;
      color: #4a5568;
    }
    
    .content-section {
      margin-bottom: ${baseMargin * 1.2}px;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 1px 6px rgba(0,0,0,0.05);
    }
    
    .section-title {
      font-size: ${20 * spacingMultiplier}px;
      font-weight: 600;
      color: white;
      background: ${primaryColor};
      padding: ${basePadding * 0.6}px ${basePadding}px;
      margin: 0;
    }
    
    .section-content {
      padding: ${basePadding}px;
    }
    
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: ${13 * spacingMultiplier}px;
    }
    
    .data-table th,
    .data-table td {
      border: 1px solid #e2e8f0;
      padding: ${12 * spacingMultiplier}px;
      text-align: left;
    }
    
    .data-table th {
      background: #f7fafc;
      font-weight: 600;
      color: #2d3748;
      text-transform: uppercase;
      font-size: ${11 * spacingMultiplier}px;
      letter-spacing: 0.5px;
    }
    
    .data-table tr:nth-child(even) {
      background: #f9fafb;
    }
    
    .data-table tr:hover {
      background: #edf2f7;
    }
    
    .enhanced-footer {
      text-align: center;
      color: #718096;
      font-size: ${12 * spacingMultiplier}px;
      padding-top: ${baseMargin}px;
      border-top: 2px solid #e2e8f0;
      margin-top: ${baseMargin * 2}px;
    }
    
    .footer-branding {
      font-weight: 600;
      color: ${primaryColor};
      margin-bottom: ${4 * spacingMultiplier}px;
    }
    
    .chart-container {
      margin: ${baseMargin}px 0;
      padding: ${basePadding}px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    
    @media print {
      .enhanced-report-content {
        padding: ${basePadding * 0.7}px;
      }
      
      .report-header {
        -webkit-print-color-adjust: exact;
        color-adjust: exact;
      }
    }
  `;
};

const generateEnhancedHeader = (reportData: EnhancedReportData, branding?: BrandingData): string => {
  return `
    <div class="report-header">
      <h1>${reportData.title}</h1>
      <div class="subtitle">${branding?.companyName || 'Property Management System'} - Comprehensive Analysis</div>
    </div>
  `;
};

const generateMetaSection = (reportData: EnhancedReportData, currentDate: string, layoutDensity: string): string => {
  return `
    <div class="meta-section">
      <div class="meta-item">
        <div class="meta-label">Property</div>
        <div class="meta-value">${reportData.property}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Report Period</div>
        <div class="meta-value">${reportData.period}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Report Type</div>
        <div class="meta-value">${reportData.type.charAt(0).toUpperCase() + reportData.type.slice(1)}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Generated</div>
        <div class="meta-value">${currentDate}</div>
      </div>
    </div>
  `;
};

const generateKPISection = (kpis: any[], layoutDensity: string, branding?: BrandingData): string => {
  if (!kpis || kpis.length === 0) return '';
  
  const kpiCards = kpis.map(kpi => `
    <div class="kpi-card">
      <div class="kpi-value">${kpi.value}</div>
      <div class="kpi-label">${kpi.label}</div>
    </div>
  `).join('');
  
  return `
    <div class="kpi-section">
      <div class="kpi-grid">
        ${kpiCards}
      </div>
    </div>
  `;
};

const generateSummarySection = (summary?: string, layoutDensity?: string): string => {
  if (!summary) return '';
  
  return `
    <div class="summary-section">
      <div class="summary-title">Executive Summary</div>
      <div class="summary-text">${summary}</div>
    </div>
  `;
};

const generateEnhancedReportContent = (reportData: EnhancedReportData, contentFlow: string): string => {
  switch (reportData.type) {
    case 'financial':
      return generateEnhancedFinancialContent(reportData);
    case 'occupancy':
      return generateEnhancedOccupancyContent(reportData);
    case 'maintenance':
      return generateEnhancedMaintenanceContent(reportData);
    case 'rent-roll':
      return generateEnhancedRentRollContent(reportData);
    default:
      return generateEnhancedGenericContent(reportData);
  }
};

const generateEnhancedFinancialContent = (reportData: EnhancedReportData): string => {
  const currency = getGlobalCurrencySync();
  return `
    <div class="content-section">
      <div class="section-title">Revenue Analysis</div>
      <div class="section-content">
        <table class="data-table">
          <thead>
            <tr>
              <th>Revenue Source</th>
              <th>Amount (${currency})</th>
              <th>% of Total</th>
              <th>vs Last Period</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Rental Income</td><td>420,000</td><td>93.3%</td><td>+5.2%</td></tr>
            <tr><td>Late Fees</td><td>18,000</td><td>4.0%</td><td>-2.1%</td></tr>
            <tr><td>Service Charges</td><td>12,000</td><td>2.7%</td><td>+1.8%</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="content-section">
      <div class="section-title">Expense Breakdown</div>
      <div class="section-content">
        <table class="data-table">
          <thead>
            <tr>
              <th>Expense Category</th>
              <th>Amount (${currency})</th>
              <th>% of Revenue</th>
              <th>Budget vs Actual</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Maintenance & Repairs</td><td>85,000</td><td>18.9%</td><td>+12.5%</td></tr>
            <tr><td>Utilities</td><td>45,000</td><td>10.0%</td><td>-3.2%</td></tr>
            <tr><td>Management Fees</td><td>22,500</td><td>5.0%</td><td>0.0%</td></tr>
            <tr><td>Insurance</td><td>15,000</td><td>3.3%</td><td>+2.1%</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
};

const generateEnhancedOccupancyContent = (reportData: EnhancedReportData): string => {
  return `
    <div class="content-section">
      <div class="section-title">Unit Occupancy Status</div>
      <div class="section-content">
        <table class="data-table">
          <thead>
            <tr>
              <th>Unit Type</th>
              <th>Total Units</th>
              <th>Occupied</th>
              <th>Vacant</th>
              <th>Occupancy Rate</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>1 Bedroom</td><td>12</td><td>10</td><td>2</td><td>83.3%</td></tr>
            <tr><td>2 Bedroom</td><td>8</td><td>7</td><td>1</td><td>87.5%</td></tr>
            <tr><td>3 Bedroom</td><td>4</td><td>4</td><td>0</td><td>100.0%</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
};

const generateEnhancedMaintenanceContent = (reportData: EnhancedReportData): string => {
  return `
    <div class="content-section">
      <div class="section-title">Maintenance Request Analysis</div>
      <div class="section-content">
        <table class="data-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Total Requests</th>
              <th>Completed</th>
              <th>In Progress</th>
              <th>Avg. Resolution Time</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Plumbing</td><td>15</td><td>12</td><td>3</td><td>2.5 days</td></tr>
            <tr><td>Electrical</td><td>8</td><td>7</td><td>1</td><td>1.8 days</td></tr>
            <tr><td>HVAC</td><td>6</td><td>5</td><td>1</td><td>3.2 days</td></tr>
            <tr><td>General</td><td>12</td><td>10</td><td>2</td><td>1.5 days</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
};

const generateEnhancedRentRollContent = (reportData: EnhancedReportData): string => {
  return `
    <div class="content-section">
      <div class="section-title">Rent Collection Summary</div>
      <div class="section-content">
        <table class="data-table">
          <thead>
            <tr>
              <th>Unit</th>
              <th>Tenant</th>
              <th>Monthly Rent</th>
              <th>Amount Paid</th>
              <th>Outstanding</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>A101</td><td>John Doe</td><td>25,000</td><td>25,000</td><td>0</td><td>Paid</td></tr>
            <tr><td>A102</td><td>Jane Smith</td><td>25,000</td><td>20,000</td><td>5,000</td><td>Partial</td></tr>
            <tr><td>A103</td><td>Bob Johnson</td><td>35,000</td><td>0</td><td>35,000</td><td>Overdue</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
};

const generateEnhancedGenericContent = (reportData: EnhancedReportData): string => {
  if (!reportData.data || reportData.data.length === 0) {
    return `
      <div class="content-section">
        <div class="section-title">Report Data</div>
        <div class="section-content">
          <p>No data available for this report period.</p>
        </div>
      </div>
    `;
  }

  const headers = Object.keys(reportData.data[0]);
  const headerRow = headers.map(header => `<th>${header}</th>`).join('');
  const dataRows = reportData.data.map(row => 
    `<tr>${headers.map(header => `<td>${row[header] || '-'}</td>`).join('')}</tr>`
  ).join('');

  return `
    <div class="content-section">
      <div class="section-title">Report Data</div>
      <div class="section-content">
        <table class="data-table">
          <thead>
            <tr>${headerRow}</tr>
          </thead>
          <tbody>
            ${dataRows}
          </tbody>
        </table>
      </div>
    </div>
  `;
};

const generateEnhancedFooter = (branding?: BrandingData, currentDate?: string): string => {
  return `
    <div class="enhanced-footer">
      <div class="footer-branding">${branding?.companyName || 'Property Management System'}</div>
      <div>Generated on ${currentDate} • ${branding?.websiteUrl || ''}</div>
      <div>${branding?.footerText || 'Professional Property Management Solutions'}</div>
    </div>
  `;
};