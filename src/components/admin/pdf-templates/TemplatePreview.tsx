import React, { useState } from "react";
import { formatAmount, getGlobalCurrencySync } from "@/utils/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Printer, Share2 } from "lucide-react";

interface PDFTemplate {
  id: string;
  name: string;
  type: 'financial' | 'report' | 'legal' | 'communication';
  status: 'active' | 'draft';
  assignedTo: string[];
  createdDate: string;
  lastModified: string;
  description?: string;
  branding?: {
    companyName: string;
    companyTagline: string;
    companyAddress: string;
    companyPhone: string;
    companyEmail: string;
    logoUrl?: string;
    primaryColor: string;
    secondaryColor: string;
    footerText: string;
  };
}

interface TemplatePreviewProps {
  template: PDFTemplate;
  onClose: () => void;
}

const mockData = {
  invoice: {
    company: {
      name: 'Zira Homes',
      tagline: 'Professional Property Management Services',
      address: 'P.O. Box 12345, Nairobi, Kenya',
      phone: '+254 700 000 000',
      email: 'billing@zirahomes.com',
    },
    landlord: {
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+254 701 234 567',
    },
    tenant: {
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      phone: '+254 702 345 678',
    },
    invoice: {
      number: 'SRV-2024-000123',
      date: '2024-01-15',
      dueDate: '2024-02-15',
      period: 'January 2024',
    },
    items: [
      { description: 'Property Management Service Charge', amount: 15000 },
      { description: 'SMS Communication Charges', amount: 500 },
      { description: 'WhatsApp Business Messaging', amount: 300 },
      { description: 'Payment Processing Fees', amount: 200 },
    ],
    totals: {
      subtotal: 16000,
      total: 16000,
    },
  },
  report: {
    title: 'Monthly Rent Collection Report',
    period: 'January 2024',
    property: 'Sunset Apartments',
    summary: {
      totalUnits: 24,
      occupiedUnits: 22,
      expectedRent: 480000,
      collectedRent: 440000,
      collectionRate: 91.7,
    },
  },
};

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({ 
  template, 
  onClose 
}) => {
  const [dataSource, setDataSource] = useState('sample');
  const [selectedProperty, setSelectedProperty] = useState('');

  // Get branding data from template or use defaults
  const getBrandingData = () => {
    return {
      companyName: template.branding?.companyName || 'Zira Homes',
      companyTagline: template.branding?.companyTagline || 'Professional Property Management Services',
      companyAddress: template.branding?.companyAddress || 'P.O. Box 12345, Nairobi, Kenya',
      companyPhone: template.branding?.companyPhone || '+254 700 000 000',
      companyEmail: template.branding?.companyEmail || 'billing@zirahomes.com',
      logoUrl: template.branding?.logoUrl,
      primaryColor: template.branding?.primaryColor || '#2563eb', // blue-600
      secondaryColor: template.branding?.secondaryColor || '#64748b', // slate-500
      footerText: template.branding?.footerText || 'Thank you for choosing our property management services.',
    };
  };

  const renderInvoicePreview = () => {
    const data = mockData.invoice;
    const branding = getBrandingData();
    
    return (
      <div className="bg-white text-black p-8 space-y-6 min-h-[800px]">
        {/* Header */}
        <div 
          className="text-white p-4 rounded-t-lg"
          style={{ backgroundColor: branding.primaryColor }}
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              {branding.logoUrl && (
                <img 
                  src={branding.logoUrl} 
                  alt="Company Logo" 
                  className="h-12 w-auto object-contain"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold">{branding.companyName}</h1>
                <p className="opacity-90">{branding.companyTagline}</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold">INVOICE</h2>
              <p className="opacity-90">{data.invoice.number}</p>
            </div>
          </div>
        </div>

        {/* Bill To Section */}
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-bold mb-2">Bill To:</h3>
            <p className="font-medium">{data.landlord.name}</p>
            <p className="text-gray-600">{data.landlord.email}</p>
            <p className="text-gray-600">{data.landlord.phone}</p>
          </div>
          <div className="text-right">
            <div className="bg-gray-50 p-4 rounded">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="font-medium">Invoice Date:</span>
                <span>{data.invoice.date}</span>
                <span className="font-medium">Due Date:</span>
                <span>{data.invoice.dueDate}</span>
                <span className="font-medium">Period:</span>
                <span>{data.invoice.period}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Service Charges Table */}
        <div>
          <h3 
            className="font-bold mb-4"
            style={{ color: branding.primaryColor }}
          >
            SERVICE CHARGES BREAKDOWN
          </h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border p-3 text-left">Description</th>
                <th className="border p-3 text-right">Amount ({getGlobalCurrencySync()})</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}>
                  <td className="border p-3">{item.description}</td>
                  <td className="border p-3 text-right">
                    {formatAmount(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr 
                className="text-white"
                style={{ backgroundColor: branding.primaryColor }}
              >
                <td className="border p-3 font-bold">TOTAL AMOUNT DUE</td>
                <td className="border p-3 text-right font-bold">
                  {formatAmount(data.totals.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer */}
        <div 
          className="text-white p-4 rounded-b-lg text-center"
          style={{ backgroundColor: branding.primaryColor }}
        >
          <p className="mb-2">{branding.footerText}</p>
          <p className="text-sm opacity-90">
            {branding.companyEmail} | {branding.companyPhone}
          </p>
        </div>
      </div>
    );
  };

  const renderReportPreview = () => {
    const data = mockData.report;
    const branding = getBrandingData();
    
    return (
      <div className="bg-white text-black p-8 space-y-6 min-h-[800px]">
        {/* Header */}
        <div className="pb-4" style={{ borderBottom: `2px solid ${branding.primaryColor}` }}>
          <div className="flex items-center gap-4 mb-2">
            {branding.logoUrl && (
              <img 
                src={branding.logoUrl} 
                alt="Company Logo" 
                className="h-10 w-auto object-contain"
              />
            )}
            <h1 className="text-2xl font-bold" style={{ color: branding.primaryColor }}>
              {data.title}
            </h1>
          </div>
          <div className="flex justify-between items-center mt-2">
            <p className="text-gray-600">Period: {data.period}</p>
            <p className="text-gray-600">Property: {data.property}</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded border-l-4" style={{ borderLeftColor: branding.primaryColor }}>
            <h3 className="font-medium" style={{ color: branding.primaryColor }}>Total Units</h3>
            <p className="text-2xl font-bold">{data.summary.totalUnits}</p>
          </div>
          <div className="bg-green-50 p-4 rounded border-l-4 border-green-600">
            <h3 className="font-medium text-green-600">Occupied Units</h3>
            <p className="text-2xl font-bold">{data.summary.occupiedUnits}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded border-l-4 border-orange-600">
            <h3 className="font-medium text-orange-600">Expected Rent</h3>
            <p className="text-2xl font-bold">
              {formatAmount(data.summary.expectedRent)}
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded border-l-4 border-purple-600">
            <h3 className="font-medium text-purple-600">Collection Rate</h3>
            <p className="text-2xl font-bold">{data.summary.collectionRate}%</p>
          </div>
        </div>

        {/* Chart Placeholder */}
        <div className="bg-gray-50 p-8 rounded text-center">
          <p className="text-gray-500">Collection Trend Chart</p>
          <div className="h-32 bg-gray-200 rounded mt-4 flex items-center justify-center">
            <span className="text-gray-400">Chart visualization would appear here</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 border-t pt-4">
          <p>Generated by {branding.companyName}</p>
          <p>Report Date: {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    );
  };

  const renderPreview = () => {
    switch (template.type) {
      case 'financial':
        return renderInvoicePreview();
      case 'report':
        return renderReportPreview();
      case 'legal':
        return (
          <div className="bg-white text-black p-8 text-center">
            <div className="border-2 border-dashed border-gray-300 p-12 rounded">
              <FileText className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">Legal Document Template Preview</p>
              <p className="text-sm text-gray-400">Preview for {template.name}</p>
            </div>
          </div>
        );
      case 'communication':
        return (
          <div className="bg-white text-black p-8 text-center">
            <div className="border-2 border-dashed border-gray-300 p-12 rounded">
              <FileText className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">Communication Template Preview</p>
              <p className="text-sm text-gray-400">Preview for {template.name}</p>
            </div>
          </div>
        );
      default:
        return (
          <div className="bg-white text-black p-8 text-center">
            <div className="border-2 border-dashed border-gray-300 p-12 rounded">
              <FileText className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">Template Preview</p>
              <p className="text-sm text-gray-400">Preview for {template.name}</p>
            </div>
          </div>
        );
    }
  };

  const handleDownloadPDF = () => {
    // Implementation would use jsPDF or similar to generate actual PDF
    console.log('Downloading PDF preview for template:', template.name);
  };

  return (
    <div className="space-y-6">
      {/* Preview Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {template.name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="text-xs">
                  {template.type.charAt(0).toUpperCase() + template.type.slice(1)}
                </Badge>
                <Badge variant={template.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                  {template.status.charAt(0).toUpperCase() + template.status.slice(1)}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" size="sm">
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div>
              <label className="text-sm font-medium">Data Source:</label>
              <Select value={dataSource} onValueChange={setDataSource}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sample">Sample Data</SelectItem>
                  <SelectItem value="real">Real Data</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {dataSource === 'real' && (
              <div>
                <label className="text-sm font-medium">Property:</label>
                <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select property..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sunset-apartments">Sunset Apartments</SelectItem>
                    <SelectItem value="ocean-view">Ocean View Complex</SelectItem>
                    <SelectItem value="downtown-towers">Downtown Towers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview Area */}
      <Card>
        <CardContent className="p-0">
          <div className="border rounded-lg overflow-hidden">
            {renderPreview()}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" onClick={onClose}>
          Close Preview
        </Button>
      </div>
    </div>
  );
};