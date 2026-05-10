import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  Save, 
  Download,
  Eye,
  Palette,
  Building,
  Phone,
  Mail,
  MapPin
} from "lucide-react";
import { toast } from "sonner";

interface TemplateData {
  id: string;
  name: string;
  type: string;
  branding?: any;
}

interface FormBasedTemplateEditorProps {
  template: {
    id: string;
    name: string;
    type: 'financial' | 'report' | 'legal' | 'communication';
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
  };
  onSave: (templateData: TemplateData) => void;
  onClose: () => void;
}

export const FormBasedTemplateEditor: React.FC<FormBasedTemplateEditorProps> = ({
  template,
  onSave,
  onClose
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    companyName: template.branding?.companyName || "Your Company Name",
    companyTagline: template.branding?.companyTagline || "Professional Property Management",
    companyAddress: template.branding?.companyAddress || "123 Business Street, City, Country",
    companyPhone: template.branding?.companyPhone || "+1 (555) 123-4567",
    companyEmail: template.branding?.companyEmail || "info@yourcompany.com",
    logoUrl: template.branding?.logoUrl || "",
    primaryColor: template.branding?.primaryColor || "#2563eb",
    secondaryColor: template.branding?.secondaryColor || "#64748b",
    footerText: template.branding?.footerText || "Thank you for choosing our services. We appreciate your business!"
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLogoUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const logoUrl = e.target?.result as string;
      handleInputChange('logoUrl', logoUrl);
      toast("Logo uploaded successfully!");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const updatedTemplate = {
      ...template,
      branding: formData
    };
    onSave(updatedTemplate);
    toast("Template saved successfully!");
  };

  const handleDownload = () => {
    // Generate and download PDF
    toast("PDF download would be implemented here");
  };

  const renderPreview = () => {
    if (template.type === 'financial') {
      return renderInvoicePreview();
    } else if (template.type === 'report') {
      return renderReportPreview();
    } else {
      return renderGenericPreview();
    }
  };

  const renderInvoicePreview = () => (
    <div className="bg-white text-black p-8 space-y-6 min-h-[800px] border rounded-lg shadow-sm">
      {/* Header */}
      <div 
        className="text-white p-6 rounded-t-lg"
        style={{ backgroundColor: formData.primaryColor }}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            {formData.logoUrl && (
              <img 
                src={formData.logoUrl} 
                alt="Company Logo" 
                className="h-16 w-auto object-contain bg-white/10 p-2 rounded"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold">{formData.companyName}</h1>
              <p className="opacity-90">{formData.companyTagline}</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold">INVOICE</h2>
            <p className="opacity-90">INV-2024-00123</p>
          </div>
        </div>
      </div>

      {/* Company Info */}
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-bold mb-3 flex items-center gap-2">
            <Building className="h-4 w-4" />
            Company Information
          </h3>
          <div className="space-y-1 text-sm">
            <p className="flex items-center gap-2">
              <MapPin className="h-3 w-3" />
              {formData.companyAddress}
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-3 w-3" />
              {formData.companyPhone}
            </p>
            <p className="flex items-center gap-2">
              <Mail className="h-3 w-3" />
              {formData.companyEmail}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="bg-gray-50 p-4 rounded">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="font-medium">Invoice Date:</span>
              <span>{new Date().toLocaleDateString()}</span>
              <span className="font-medium">Due Date:</span>
              <span>{new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
              <span className="font-medium">Period:</span>
              <span>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sample Items Table */}
      <div>
        <h3 className="font-bold mb-4" style={{ color: formData.primaryColor }}>
          SERVICE CHARGES BREAKDOWN
        </h3>
        <table className="w-full border-collapse border border-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 p-3 text-left">Description</th>
              <th className="border border-gray-200 p-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-200 p-3">Property Management Service</td>
              <td className="border border-gray-200 p-3 text-right">$1,500.00</td>
            </tr>
            <tr className="bg-gray-25">
              <td className="border border-gray-200 p-3">Communication Services</td>
              <td className="border border-gray-200 p-3 text-right">$150.00</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: formData.primaryColor, color: 'white' }}>
              <td className="border border-gray-200 p-3 font-bold">TOTAL AMOUNT DUE</td>
              <td className="border border-gray-200 p-3 text-right font-bold">$1,650.00</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer */}
      <div 
        className="text-white p-6 rounded-b-lg text-center"
        style={{ backgroundColor: formData.primaryColor }}
      >
        <p className="mb-2">{formData.footerText}</p>
        <p className="text-sm opacity-90">
          {formData.companyEmail} | {formData.companyPhone}
        </p>
      </div>
    </div>
  );

  const renderReportPreview = () => (
    <div className="bg-white text-black p-8 space-y-6 min-h-[800px] border rounded-lg shadow-sm">
      {/* Header */}
      <div className="pb-4" style={{ borderBottom: `2px solid ${formData.primaryColor}` }}>
        <div className="flex items-center gap-4 mb-2">
          {formData.logoUrl && (
            <img 
              src={formData.logoUrl} 
              alt="Company Logo" 
              className="h-12 w-auto object-contain"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold" style={{ color: formData.primaryColor }}>
              Monthly Report
            </h1>
            <p className="text-gray-600">{formData.companyName}</p>
          </div>
        </div>
      </div>

      {/* Sample Data Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded border-l-4" style={{ borderLeftColor: formData.primaryColor }}>
          <h3 className="font-medium" style={{ color: formData.primaryColor }}>Total Revenue</h3>
          <p className="text-2xl font-bold">$45,200</p>
        </div>
        <div className="bg-green-50 p-4 rounded border-l-4 border-green-600">
          <h3 className="font-medium text-green-600">Properties Managed</h3>
          <p className="text-2xl font-bold">28</p>
        </div>
        <div className="bg-orange-50 p-4 rounded border-l-4 border-orange-600">
          <h3 className="font-medium text-orange-600">Collection Rate</h3>
          <p className="text-2xl font-bold">94.5%</p>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 border-t pt-4 mt-8">
        <p>{formData.footerText}</p>
        <p>Generated by {formData.companyName} • {new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );

  const renderGlobalTemplate = () => (
    <div className="bg-white text-black min-h-[900px] border rounded-lg shadow-sm">
      {/* Header Section */}
      <div className="flex items-center justify-between p-8 pb-4">
        {/* Logo */}
        <div className="flex-shrink-0">
          {formData.logoUrl ? (
            <img 
              src={formData.logoUrl} 
              alt="Company Logo" 
              className="h-20 w-auto object-contain border-2 border-gray-300 p-2"
            />
          ) : (
            <div className="h-20 w-24 border-2 border-gray-300 flex items-center justify-center bg-gray-100">
              <span className="text-gray-500 text-sm font-medium">LOGO</span>
            </div>
          )}
        </div>
        
        {/* Header Title */}
        <div className="text-right">
          <h1 className="text-4xl font-bold text-gray-700">HEADER</h1>
          <p className="text-lg text-gray-500 mt-1">{formData.companyTagline}</p>
        </div>
      </div>

      {/* Header Separator */}
      <div className="mx-8">
        <hr className="border-t-2 border-gray-800" />
      </div>

      {/* Main Content Area */}
      <div className="p-8 py-16">
        <div className="text-center space-y-8">
          <h2 className="text-5xl font-bold text-gray-700">MAIN CONTENT AREA</h2>
          
          {/* Content placeholder */}
          <div className="max-w-2xl mx-auto space-y-6 text-gray-600">
            <p className="text-lg">
              This is your global template that can be customized for any document type.
              The layout follows a professional structure with clear sections.
            </p>
            
            <div className="grid md:grid-cols-2 gap-6 mt-12">
              <div className="bg-gray-50 p-6 rounded border-l-4" style={{ borderLeftColor: formData.primaryColor }}>
                <h3 className="font-bold mb-2" style={{ color: formData.primaryColor }}>Section A</h3>
                <p className="text-sm">Content can be customized based on document type</p>
              </div>
              <div className="bg-gray-50 p-6 rounded border-l-4" style={{ borderLeftColor: formData.secondaryColor }}>
                <h3 className="font-bold mb-2" style={{ color: formData.secondaryColor }}>Section B</h3>
                <p className="text-sm">Flexible layout accommodates various content</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Separator */}
      <div className="mx-8">
        <hr className="border-t-2 border-gray-800" />
      </div>

      {/* Footer Section */}
      <div className="p-8 pt-6 space-y-2">
        <div className="text-left space-y-1">
          <p className="font-bold text-lg">{formData.companyName}</p>
          <p className="text-gray-600">{formData.companyAddress}</p>
          <p className="text-gray-600">{formData.companyPhone} | {formData.companyEmail}</p>
          <p className="text-sm text-gray-500 mt-4">{formData.footerText}</p>
        </div>
      </div>
    </div>
  );

  const renderGenericPreview = () => renderGlobalTemplate();

  return (
    <div className="flex h-full gap-6">
      {/* Left Panel - Form */}
      <Card className="w-80 flex-shrink-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Customize Template
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {template.type.charAt(0).toUpperCase() + template.type.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Company Information */}
          <div>
            <Label className="text-sm font-medium mb-3 flex items-center gap-2">
              <Building className="h-4 w-4" />
              Company Information
            </Label>
            <div className="space-y-3">
              <div>
                <Label htmlFor="companyName" className="text-xs">Company Name</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => handleInputChange('companyName', e.target.value)}
                  placeholder="Your Company Name"
                />
              </div>
              <div>
                <Label htmlFor="companyTagline" className="text-xs">Tagline</Label>
                <Input
                  id="companyTagline"
                  value={formData.companyTagline}
                  onChange={(e) => handleInputChange('companyTagline', e.target.value)}
                  placeholder="Your tagline"
                />
              </div>
              <div>
                <Label htmlFor="companyAddress" className="text-xs">Address</Label>
                <Textarea
                  id="companyAddress"
                  value={formData.companyAddress}
                  onChange={(e) => handleInputChange('companyAddress', e.target.value)}
                  placeholder="Company address"
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="companyPhone" className="text-xs">Phone</Label>
                <Input
                  id="companyPhone"
                  value={formData.companyPhone}
                  onChange={(e) => handleInputChange('companyPhone', e.target.value)}
                  placeholder="Phone number"
                />
              </div>
              <div>
                <Label htmlFor="companyEmail" className="text-xs">Email</Label>
                <Input
                  id="companyEmail"
                  type="email"
                  value={formData.companyEmail}
                  onChange={(e) => handleInputChange('companyEmail', e.target.value)}
                  placeholder="Email address"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Logo Upload */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Company Logo</Label>
            <div className="space-y-3">
              {formData.logoUrl && (
                <div className="border rounded p-2">
                  <img 
                    src={formData.logoUrl} 
                    alt="Logo Preview" 
                    className="h-12 w-auto object-contain mx-auto"
                  />
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleLogoUpload}
              >
                <Upload className="h-4 w-4 mr-2" />
                {formData.logoUrl ? 'Change Logo' : 'Upload Logo'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>

          <Separator />

          {/* Colors */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Brand Colors</Label>
            <div className="space-y-3">
              <div>
                <Label htmlFor="primaryColor" className="text-xs">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={formData.primaryColor}
                    onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                    className="w-16 h-10 cursor-pointer"
                  />
                  <Input
                    value={formData.primaryColor}
                    onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                    placeholder="#2563eb"
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="secondaryColor" className="text-xs">Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondaryColor"
                    type="color"
                    value={formData.secondaryColor}
                    onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                    className="w-16 h-10 cursor-pointer"
                  />
                  <Input
                    value={formData.secondaryColor}
                    onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                    placeholder="#64748b"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Footer Text */}
          <div>
            <Label htmlFor="footerText" className="text-sm font-medium mb-3 block">Footer Message</Label>
            <Textarea
              id="footerText"
              value={formData.footerText}
              onChange={(e) => handleInputChange('footerText', e.target.value)}
              placeholder="Thank you message or additional information"
              rows={3}
            />
          </div>

          <Separator />

          {/* Actions */}
          <div className="space-y-2">
            <Button 
              className="w-full"
              onClick={handleSave}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Template
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Right Panel - Preview */}
      <div className="flex-1">
        <Card className="h-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Live Preview - {template.name}
              </CardTitle>
              <Button variant="outline" onClick={onClose}>
                Close Editor
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-full overflow-auto bg-gray-50 p-4 rounded-lg">
              {renderPreview()}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};