import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface ReportData {
  title: string;
  period: string;
  property: string;
  data: any[];
  type: 'financial' | 'occupancy' | 'maintenance' | 'rent-roll';
}

export const generateReportPreview = async (reportData: ReportData): Promise<string> => {
  const previewHtml = createReportHTML(reportData);
  
  // Create a new window for preview
  const previewWindow = window.open('', '_blank', 'width=800,height=600');
  if (previewWindow) {
    previewWindow.document.write(previewHtml);
    previewWindow.document.close();
    return 'Preview opened in new tab';
  }
  throw new Error('Failed to open preview window');
};

export const generateReportPDF = async (reportData: ReportData): Promise<void> => {
  // Create a temporary div to hold the report content
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = createReportHTML(reportData);
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.width = '800px';
  document.body.appendChild(tempDiv);

  try {
    // Convert HTML to canvas
    const canvas = await html2canvas(tempDiv.querySelector('.report-content') as HTMLElement, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
    });

    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');
    
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 295; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    
    let position = 0;
    
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    // Download the PDF
    pdf.save(`${reportData.title.toLowerCase().replace(/\s+/g, '-')}-${reportData.period}.pdf`);
  } finally {
    // Clean up
    document.body.removeChild(tempDiv);
  }
};

const createReportHTML = (reportData: ReportData): string => {
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
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background: white;
          color: #333;
        }
        .report-content {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 40px;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          color: #1f2937;
          margin: 0 0 10px 0;
          font-size: 28px;
        }
        .header .subtitle {
          color: #6b7280;
          font-size: 16px;
        }
        .meta-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
          padding: 15px;
          background: #f9fafb;
          border-radius: 8px;
        }
        .meta-info div {
          text-align: center;
        }
        .meta-info label {
          font-weight: bold;
          color: #374151;
          display: block;
          margin-bottom: 5px;
        }
        .meta-info value {
          color: #6b7280;
        }
        .content-section {
          margin-bottom: 30px;
        }
        .section-title {
          font-size: 20px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 15px;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 5px;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        .data-table th,
        .data-table td {
          border: 1px solid #e5e7eb;
          padding: 12px;
          text-align: left;
        }
        .data-table th {
          background: #f9fafb;
          font-weight: bold;
          color: #374151;
        }
        .data-table tr:nth-child(even) {
          background: #f9fafb;
        }
        .summary-card {
          background: #f0f9ff;
          border: 1px solid #0ea5e9;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }
        .summary-title {
          font-weight: bold;
          color: #0369a1;
          margin-bottom: 10px;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        .kpi-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
        }
        .kpi-value {
          font-size: 24px;
          font-weight: bold;
          color: #1e40af;
          margin-bottom: 5px;
        }
        .kpi-label {
          color: #64748b;
          font-size: 14px;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          color: #6b7280;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="report-content">
        <div class="header">
          <h1>${reportData.title}</h1>
          <div class="subtitle">Property Management Report</div>
        </div>
        
        <div class="meta-info">
          <div>
            <label>Property:</label>
            <div class="value">${reportData.property}</div>
          </div>
          <div>
            <label>Period:</label>
            <div class="value">${reportData.period}</div>
          </div>
          <div>
            <label>Generated:</label>
            <div class="value">${currentDate}</div>
          </div>
        </div>

        ${generateReportContent(reportData)}

        <div class="footer">
          Generated by Property Management System on ${currentDate}
        </div>
      </div>
    </body>
    </html>
  `;
};

const generateReportContent = (reportData: ReportData): string => {
  switch (reportData.type) {
    case 'financial':
      return generateFinancialReport(reportData);
    case 'occupancy':
      return generateOccupancyReport(reportData);
    case 'maintenance':
      return generateMaintenanceReport(reportData);
    case 'rent-roll':
      return generateRentRollReport(reportData);
    default:
      return generateGenericReport(reportData);
  }
};

const generateFinancialReport = (reportData: ReportData): string => {
  const totalRevenue = 45000;
  const totalExpenses = 12000;
  const netIncome = totalRevenue - totalExpenses;
  
  return `
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-value">KES ${totalRevenue.toLocaleString()}</div>
        <div class="kpi-label">Total Revenue</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">KES ${totalExpenses.toLocaleString()}</div>
        <div class="kpi-label">Total Expenses</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">KES ${netIncome.toLocaleString()}</div>
        <div class="kpi-label">Net Income</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${((netIncome / totalRevenue) * 100).toFixed(1)}%</div>
        <div class="kpi-label">Profit Margin</div>
      </div>
    </div>

    <div class="content-section">
      <div class="section-title">Revenue Breakdown</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Source</th>
            <th>Amount (KES)</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Rental Income</td>
            <td>42,000</td>
            <td>93.3%</td>
          </tr>
          <tr>
            <td>Late Fees</td>
            <td>2,000</td>
            <td>4.4%</td>
          </tr>
          <tr>
            <td>Other Income</td>
            <td>1,000</td>
            <td>2.2%</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="content-section">
      <div class="section-title">Expense Breakdown</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Amount (KES)</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Maintenance</td>
            <td>6,000</td>
            <td>50.0%</td>
          </tr>
          <tr>
            <td>Utilities</td>
            <td>3,000</td>
            <td>25.0%</td>
          </tr>
          <tr>
            <td>Administrative</td>
            <td>2,000</td>
            <td>16.7%</td>
          </tr>
          <tr>
            <td>Other</td>
            <td>1,000</td>
            <td>8.3%</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
};

const generateOccupancyReport = (reportData: ReportData): string => {
  return `
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-value">85%</div>
        <div class="kpi-label">Occupancy Rate</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">17</div>
        <div class="kpi-label">Occupied Units</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">3</div>
        <div class="kpi-label">Vacant Units</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">12 days</div>
        <div class="kpi-label">Avg. Vacancy Period</div>
      </div>
    </div>

    <div class="content-section">
      <div class="section-title">Unit Status Overview</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Unit Number</th>
            <th>Type</th>
            <th>Status</th>
            <th>Tenant</th>
            <th>Rent (KES)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>A101</td>
            <td>1 Bedroom</td>
            <td>Occupied</td>
            <td>John Doe</td>
            <td>25,000</td>
          </tr>
          <tr>
            <td>A102</td>
            <td>1 Bedroom</td>
            <td>Vacant</td>
            <td>-</td>
            <td>25,000</td>
          </tr>
          <tr>
            <td>A103</td>
            <td>2 Bedroom</td>
            <td>Occupied</td>
            <td>Jane Smith</td>
            <td>35,000</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
};

const generateMaintenanceReport = (reportData: ReportData): string => {
  return `
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-value">24</div>
        <div class="kpi-label">Total Requests</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">18</div>
        <div class="kpi-label">Completed</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">6</div>
        <div class="kpi-label">Pending</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">2.3 days</div>
        <div class="kpi-label">Avg. Resolution Time</div>
      </div>
    </div>

    <div class="content-section">
      <div class="section-title">Maintenance by Category</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Total Requests</th>
            <th>Completed</th>
            <th>Pending</th>
            <th>Total Cost (KES)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Plumbing</td>
            <td>8</td>
            <td>6</td>
            <td>2</td>
            <td>12,000</td>
          </tr>
          <tr>
            <td>Electrical</td>
            <td>5</td>
            <td>4</td>
            <td>1</td>
            <td>8,500</td>
          </tr>
          <tr>
            <td>HVAC</td>
            <td>4</td>
            <td>3</td>
            <td>1</td>
            <td>15,000</td>
          </tr>
          <tr>
            <td>General</td>
            <td>7</td>
            <td>5</td>
            <td>2</td>
            <td>6,200</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
};

const generateRentRollReport = (reportData: ReportData): string => {
  return `
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-value">KES 420,000</div>
        <div class="kpi-label">Total Rent Roll</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">KES 357,000</div>
        <div class="kpi-label">Collected</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">KES 63,000</div>
        <div class="kpi-label">Outstanding</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">85%</div>
        <div class="kpi-label">Collection Rate</div>
      </div>
    </div>

    <div class="content-section">
      <div class="section-title">Detailed Rent Roll</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Unit</th>
            <th>Tenant</th>
            <th>Rent (KES)</th>
            <th>Paid (KES)</th>
            <th>Outstanding (KES)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>A101</td>
            <td>John Doe</td>
            <td>25,000</td>
            <td>25,000</td>
            <td>0</td>
            <td>Paid</td>
          </tr>
          <tr>
            <td>A102</td>
            <td>Jane Smith</td>
            <td>25,000</td>
            <td>0</td>
            <td>25,000</td>
            <td>Overdue</td>
          </tr>
          <tr>
            <td>A103</td>
            <td>Mike Johnson</td>
            <td>35,000</td>
            <td>35,000</td>
            <td>0</td>
            <td>Paid</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
};

const generateGenericReport = (reportData: ReportData): string => {
  return `
    <div class="content-section">
      <div class="section-title">Report Summary</div>
      <div class="summary-card">
        <div class="summary-title">Report Generated Successfully</div>
        <p>This is a sample report generated for demonstration purposes. The actual report would contain real data from your property management system.</p>
      </div>
    </div>
  `;
};