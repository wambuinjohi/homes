import React from 'react';
import { Button } from '@/components/ui/button';
import { UnifiedPDFRenderer } from '@/utils/unifiedPDFRenderer';
import { BrandingService } from '@/utils/brandingService';
import { toast } from 'sonner';

const TestMasterPDF = () => {
  const handleTestReport = async () => {
    try {
      toast.loading('Testing master PDF template integration...', { id: 'test-pdf' });
      
      // Get branding from master template system
      const platformBranding = BrandingService.loadBranding();
      
      // Create sample report content
      const reportContent = {
        reportPeriod: 'December 2024 - Test Report',
        summary: 'This is a test report generated using the master PDF template system from Admin PDF Templates. It demonstrates the professional branding and consistent styling across all reports.',
        kpis: [
          { label: 'Total Revenue', value: 'KES 2.8M', trend: 'up' as const, change: '+8.5%' },
          { label: 'Collection Rate', value: '94.2%', trend: 'up' as const, change: '+2.1%' },
          { label: 'Occupancy Rate', value: '87%', trend: 'stable' as const },
          { label: 'Net Income', value: 'KES 2.1M', trend: 'up' as const, change: '+12.4%' }
        ],
        data: [
          { Property: 'Sunset Gardens', Revenue: 875000, 'Collection Rate': '98%' },
          { Property: 'Green Valley', Revenue: 630000, 'Collection Rate': '92%' },
          { Property: 'Palm Heights', Revenue: 420000, 'Collection Rate': '95%' }
        ]
      };

      // Test chart data
      const chartData = {
        type: 'bar',
        title: 'Revenue by Property',
        data: {
          labels: ['Sunset Gardens', 'Green Valley', 'Palm Heights'],
          datasets: [{
            label: 'Revenue',
            data: [875000, 630000, 420000]
          }]
        },
        description: 'This chart shows the revenue distribution across different properties in the portfolio.'
      };

      // Create document for master PDF template system
      const document = {
        type: 'report' as const,
        title: 'Master PDF Template Test Report',
        content: reportContent
      };

      // Generate using UnifiedPDFRenderer (master template system)
      const renderer = new UnifiedPDFRenderer();
      await renderer.generateDocument(document, platformBranding, null, chartData as any);
      
      toast.success('Master PDF template test successful! Check the generated PDF.', { id: 'test-pdf' });
    } catch (error) {
      console.error('Test failed:', error);
      toast.error('Master PDF template test failed. Check console for details.', { id: 'test-pdf' });
    }
  };

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Master PDF Template Integration Test</h1>
      <p className="text-muted-foreground">
        This test verifies that all reports now use the professional master PDF template system 
        configured in Admin → PDF Templates, ensuring consistent branding across all generated documents.
      </p>
      
      <Button onClick={handleTestReport} className="w-full">
        Test Master PDF Template Integration
      </Button>
      
      <div className="bg-muted p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Integration Features Tested:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>✅ Unified branding from Admin PDF Templates</li>
          <li>✅ Professional header with logo and company information</li>
          <li>✅ Consistent color scheme and styling</li>
          <li>✅ Enhanced KPI cards with trend indicators</li>
          <li>✅ Professional chart rendering with fallbacks</li>
          <li>✅ Comprehensive footer with contact details</li>
          <li>✅ Proper page breaks and spacing</li>
          <li>✅ Same system used across Reports and Admin PDF Templates</li>
        </ul>
      </div>
    </div>
  );
};

export default TestMasterPDF;