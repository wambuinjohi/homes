import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ProfessionalPDFRenderer, PDFReportData } from './professionalPDFRenderer';
import { getGlobalCurrencySync } from './currency';

interface LegacyPDFReportData {
  reportTitle: string;
  reportType: string;
  landlordName?: string;
  dateGenerated: string;
  content: any;
  summary?: string;
}

export class BrandedPDFGenerator {
  private static addHeader(pdf: jsPDF, data: LegacyPDFReportData) {
    // Header background with navy blue
    pdf.setFillColor(22, 37, 77); // Navy #16254D
    pdf.rect(0, 0, 210, 35, 'F');
    
    // Add logo if available
    try {
      // Logo on top-left
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text('ZIRA HOMES', 20, 22);
    } catch (error) {
      console.warn('Could not load logo, using text fallback');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text('ZIRA HOMES', 20, 22);
    }
    
    // Date generated on top-right
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Generated: ${data.dateGenerated}`, 145, 18);
    
    // Report title - bold and well spaced
    pdf.setTextColor(33, 37, 41);
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text(data.reportTitle, 20, 50);
    
    // Subtitle - Prepared for [Landlord/Company Name]
    if (data.landlordName) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(108, 117, 125);
      pdf.text(`Prepared for: ${data.landlordName}`, 20, 60);
      return 75; // Return Y position for content start
    }
    
    return 65; // Return Y position for content start if no landlord name
  }
  
  private static addFooter(pdf: jsPDF, pageNumber: number, totalPages: number) {
    const pageHeight = pdf.internal.pageSize.height;
    
    // Footer line
    pdf.setDrawColor(233, 236, 239);
    pdf.line(15, pageHeight - 20, 195, pageHeight - 20);
    
    // Footer text
    pdf.setTextColor(108, 117, 125);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Zira Homes © 2025 – www.zira-tech.com', 15, pageHeight - 15);
    pdf.text(`Page ${pageNumber} of ${totalPages}`, 170, pageHeight - 12);
    pdf.text('Phone: +254-757-878-023', 15, pageHeight - 11);
    pdf.text('Email: info@ziratech.com', 15, pageHeight - 7);
    pdf.text('Website: zira-tech.com', 15, pageHeight - 3);
  }
  
  private static addWatermark(pdf: jsPDF) {
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;
    
    pdf.saveGraphicsState();
    pdf.setTextColor(22, 37, 77); // Navy color
    pdf.setFontSize(60);
    pdf.setFont('helvetica', 'bold');
    
    // Rotate and center the watermark
    pdf.text('ZIRA HOMES', pageWidth / 2, pageHeight / 2, {
      angle: 45,
      align: 'center'
    });
    
    pdf.restoreGraphicsState();
  }
  
  public static async generateReportPDF(data: LegacyPDFReportData): Promise<void> {
    const pdf = new jsPDF('portrait', 'mm', 'a4');
    
    // Add watermark
    this.addWatermark(pdf);
    
    // Add header
    const contentStartY = this.addHeader(pdf, data);
    
    // Add summary if provided
    let currentY = contentStartY + 10;
    if (data.summary) {
      pdf.setTextColor(33, 37, 41);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Executive Summary', 15, currentY);
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const summaryLines = pdf.splitTextToSize(data.summary, 180);
      pdf.text(summaryLines, 15, currentY + 8);
      currentY += summaryLines.length * 4 + 15;
    }
    
    // Capture the report content with improved settings for full visibility
    const element = document.getElementById('enhanced-report-content');
    if (element) {
      // Ensure element is fully visible and scrolled to top
      element.scrollTop = 0;
      element.scrollLeft = 0;
      
      // Wait for any dynamic content to load
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const canvas = await html2canvas(element, { 
        scale: 3, // Higher scale for better quality
        useCORS: true,
        backgroundColor: '#ffffff',
        height: element.scrollHeight,
        width: element.scrollWidth,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        allowTaint: true,
        foreignObjectRendering: true,
        removeContainer: false,
        logging: false,
        imageTimeout: 5000,
        onclone: (clonedDoc) => {
          // Ensure all styles are applied in the cloned document
          const clonedElement = clonedDoc.getElementById('enhanced-report-content');
          if (clonedElement) {
            clonedElement.style.transform = 'none';
            clonedElement.style.width = '100%';
            clonedElement.style.height = 'auto';
            clonedElement.style.overflow = 'visible';
          }
        }
      });
      const imgData = canvas.toDataURL('image/png');
      
      const imgWidth = 180;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.height;
      const availableHeight = pageHeight - currentY - 30; // Account for footer
      
      if (imgHeight <= availableHeight) {
        // Fits on current page
        pdf.addImage(imgData, 'PNG', 15, currentY, imgWidth, imgHeight);
      } else {
        // Split across pages
        const ratio = imgWidth / canvas.width;
        const pageCanvasHeight = availableHeight / ratio;
        
        let sourceY = 0;
        let pageNum = 1;
        
        while (sourceY < canvas.height) {
          if (pageNum > 1) {
            pdf.addPage();
            this.addWatermark(pdf);
            this.addHeader(pdf, data);
            currentY = contentStartY + 10;
          }
          
          const remainingHeight = canvas.height - sourceY;
          const currentPageHeight = Math.min(pageCanvasHeight, remainingHeight);
          
          // Create a new canvas for this page section
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = currentPageHeight;
          const pageCtx = pageCanvas.getContext('2d');
          
          if (pageCtx) {
            pageCtx.drawImage(canvas, 0, sourceY, canvas.width, currentPageHeight, 0, 0, canvas.width, currentPageHeight);
            const pageImgData = pageCanvas.toDataURL('image/png');
            const pageImgHeight = currentPageHeight * ratio;
            pdf.addImage(pageImgData, 'PNG', 15, currentY, imgWidth, pageImgHeight);
          }
          
          sourceY += currentPageHeight;
          pageNum++;
        }
      }
    }
    
    // Add footer to all pages
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      this.addFooter(pdf, i, totalPages);
    }
    
    // Save the PDF
    const fileName = `${data.reportTitle.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
  }
  
  public static generateSummaryReport(reportType: string, data?: any): string {
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long' 
    });
    const c = getGlobalCurrencySync();
    
    const summaries = {
      'rent-collection': `Rent Collection Report for ${currentDate}: Current month collections total ${c} 850,000 achieving a 92% collection rate across 25 properties. Outstanding payments amount to ${c} 125,000 affecting 8 properties with key concerns at Kileleshwa Heights (78% collection rate). Top performing property is Westlands Garden with ${c} 245,000 collected (100% rate). Immediate action required for 12 tenants with payments over 30 days overdue. Collection efficiency has improved 5% from previous month.`,
      
      'outstanding-balances': `Outstanding Balances Report for ${currentDate}: Total outstanding balances stand at ${c} 187,500 across 12 tenants representing 3.2% of monthly revenue. Critical cases include Martha Kamau (${c} 45,000 - 3 months overdue) requiring immediate legal action and John Mwangi (${c} 32,000 - 2 months overdue) with payment plan in progress. Recent collection efforts have recovered 15% of aged debt. Average debt aging is 45 days with 60% of outstanding amounts under 60 days old.`,
      
      'property-performance': `Property Performance Report for ${currentDate}: Portfolio maintains strong 94% occupancy rate across 25 properties generating total monthly revenue of ${c} 2.1M. Star performer Westlands Garden maintains 100% occupancy with ${c} 12,500 average rent. Kileleshwa Heights requires attention at 85% occupancy with 3 vacant units. Total portfolio value estimated at ${c} 45M yielding 8.2% annually. Market rent analysis shows potential for 6% increase across premium units.`,
      
      'expense-summary': `Expense Summary Report for ${currentDate}: Total operational expenses of ${c} 156,800 representing 18.5% of gross revenue. Major expense categories include Maintenance (${c} 67,200 - 43%), Utilities (${c} 45,600 - 29%), and Administrative costs (${c} 44,000 - 28%). Notable 8% decrease in maintenance costs due to preventive maintenance program. Highest expense property is Westlands Garden (${c} 34,000) due to elevator maintenance. Cost per unit averaged ${c} 1,890.`,
      
      'profit-loss': `Profit & Loss Statement for ${currentDate}: Net profit of ${c} 523,200 achieving 65% profit margin on gross revenue of ${c} 850,000. Total operating expenses maintained at ${c} 326,800 showing excellent cost control. Year-over-year growth of 12% in net profit driven by improved collection rates (92% vs 87% last year) and strategic cost optimization. EBITDA margin stands at 68% indicating strong operational efficiency and cash flow generation.`,
      
      'lease-expiry': `Lease Expiry Report for ${currentDate}: 8 leases representing ${c} 145,000 monthly revenue (16.8% of portfolio) expire within 60 days. Immediate priorities include John Mwangi (expires in 15 days - ${c} 25,000/month) and Sarah Chen (expires in 28 days - ${c} 18,000/month). 3 renewal applications submitted with average proposed rent increase of 6%. Historical renewal rate of 85% with 15% tenant turnover. Early engagement initiated for all expiring leases.`,
      
      'occupancy': `Unit Occupancy Report for ${currentDate}: Portfolio maintains strong 94% occupancy rate across 85 units generating ${c} 2.1M monthly revenue. Current vacancy includes 5 units at Kileleshwa Heights requiring immediate marketing attention. Average vacancy duration stands at 25 days showing efficient turnover management. Premium units show 98% occupancy while standard units maintain 91% rate. Market demand remains strong with 12 qualified prospects in pipeline.`,
      
      'revenue-vs-expenses': `Revenue vs Expenses Report for ${currentDate}: Strong financial performance with total revenue of ${c} 2.1M against operational expenses of ${c} 425K achieving 80% profit margin. Revenue streams include rent collections (85%), parking fees (8%), and service charges (7%). Major expense categories are maintenance (35%), utilities (25%), management fees (20%), and insurance (10%). Year-over-year revenue growth of 12% with controlled expense increases of only 3%.`,
      
      'tenant-turnover': `Tenant Turnover Report for ${currentDate}: Annual turnover rate of 12.5% remains below market average of 18% indicating strong tenant satisfaction. Average vacancy duration of 21 days demonstrates efficient property marketing. Turnover costs average ${c} 45,000 per unit including cleaning, repairs, and lost rent. Primary reasons for departure: job relocation (45%), rent increases (25%), property size changes (20%), and other factors (10%). Retention initiatives have improved satisfaction scores by 15%.`,
      
      'market-rent': `Market Rent Analysis for ${currentDate}: Current average market rent stands at ${c} 85,000 compared to our portfolio average of ${c} 78,500 indicating 7.6% discount to market. Premium locations show potential for 6-8% increases while maintaining occupancy. Comparative analysis shows our rents are competitive for amenity packages offered. Market trends suggest 4% annual growth potential. Strategic rent positioning recommendations could increase portfolio value by ${c} 650,000 annually.`,
      
      'cash-flow': `Cash Flow Report for ${currentDate}: Strong operating cash flow of ${c} 2.1M with free cash flow of ${c} 1.8M representing 28.5% margin. Monthly cash generation averaging ${c} 180K provides excellent liquidity position. Seasonal variations show peak collections in January-March (95% collection rate) and lowest in November-December (87% rate). Cash flow projections remain positive with 15% growth expected over next 12 months through occupancy improvements and strategic rent adjustments.`,
      
      'maintenance': `Maintenance Report for ${currentDate}: Processed 156 maintenance requests with 91% completion rate demonstrating responsive property management. Average response time of 2.3 days exceeds industry standards. Total maintenance costs of ${c} 425,000 represent 6.8% of rental income showing efficient cost control. Emergency repairs decreased 35% due to preventive maintenance program. Tenant satisfaction with maintenance services increased to 4.2/5.0 rating. Cost per unit averaging ${c} 5,100 annually remains competitive.`
    };
    
    return summaries[reportType as keyof typeof summaries] || `This comprehensive ${reportType} report for ${currentDate} provides detailed insights into property management metrics and serves as a key indicator of operational efficiency and portfolio health.`;
  }
}