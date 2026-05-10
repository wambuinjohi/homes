import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Upload, Palette, Building, FileText, Eye, BarChart3 } from "lucide-react";
import { UnifiedPDFRenderer } from "@/utils/unifiedPDFRenderer";
import { BrandingService, BrandingData } from "@/utils/brandingService";

interface SimplifiedTemplateCustomizerProps {
  onSave?: (brandingData: BrandingData) => void;
  onClose?: () => void;
  initialData?: Partial<BrandingData>;
}

export const SimplifiedTemplateCustomizer: React.FC<SimplifiedTemplateCustomizerProps> = ({
  onSave,
  onClose,
  initialData
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [brandingData, setBrandingData] = useState<BrandingData>(() => {
    // Load from localStorage or use initialData, with fallback to defaults
    if (initialData) {
      return {
        ...BrandingService.getDefaultBranding(),
        ...initialData
      };
    }
    return BrandingService.loadBranding();
  });

  const handleInputChange = (field: keyof BrandingData, value: any) => {
    console.log(`Updating ${field}:`, value);
    setBrandingData(prev => ({
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

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select a valid image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const logoUrl = e.target?.result as string;
      console.log("Logo uploaded:", logoUrl.substring(0, 50) + "...");
      handleInputChange('logoUrl', logoUrl);
      toast.success("Logo uploaded successfully!");
    };
    reader.onerror = () => {
      toast.error("Failed to read the image file");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    try {
      // Save using the unified branding service
      BrandingService.saveBranding(brandingData);
      onSave?.(brandingData);
      toast.success("Template customization saved and applied to all PDF generation systems!");
    } catch (error) {
      console.error('Failed to save branding:', error);
      toast.error("Failed to save template customization. Please try again.");
    }
  };

  const handlePreviewPDF = async () => {
    const pdfRenderer = new UnifiedPDFRenderer();
    
    // Sample document data for preview with landlord info
    const sampleDocument = {
      type: 'invoice' as const,
      title: 'Sample Invoice',
      content: {
        invoiceNumber: 'INV-2024-00123',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        items: [
          { description: 'Property Management Service', amount: 1500.00 },
          { description: 'Communication Services', amount: 150.00 }
        ],
        total: 1650.00,
        recipient: {
          name: 'John Doe',
          address: '456 Property Lane\nCity, State 12345'
        }
      }
    };

    // Sample landlord data for preview
    const sampleLandlordData = {
      name: 'Sample Property Manager',
      email: 'manager@sample.com',
      phone: '+254 700 000 000',
      address: 'Sample Property Office, Nairobi'
    };

    await pdfRenderer.generateDocument(sampleDocument, brandingData, sampleLandlordData);
    toast.success("Preview PDF generated!");
  };

  const colorPresets = [
    { name: 'Professional Blue', primary: '#2563eb', secondary: '#64748b' },
    { name: 'Corporate Navy', primary: '#1e40af', secondary: '#6b7280' },
    { name: 'Modern Green', primary: '#059669', secondary: '#6b7280' },
    { name: 'Executive Purple', primary: '#7c3aed', secondary: '#6b7280' },
    { name: 'Classic Black', primary: '#1f2937', secondary: '#6b7280' },
  ];

  return (
    <div className="flex h-full gap-6">
      {/* Left Panel - Customization Form */}
      <Card className="w-96 flex-shrink-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Brand Customization
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Customize your global template branding
          </p>
        </CardHeader>
        <CardContent className="space-y-6 max-h-[600px] overflow-y-auto">
          {/* Platform Header Branding */}
          <div>
            <Label className="text-sm font-medium mb-3 flex items-center gap-2">
              <Building className="h-4 w-4" />
              Platform Header Branding
            </Label>
            <div className="space-y-3">
              <div>
                <Label htmlFor="companyName" className="text-xs">Platform Name</Label>
                <Input
                  id="companyName"
                  value={brandingData.companyName}
                  onChange={(e) => handleInputChange('companyName', e.target.value)}
                  placeholder="Zira Homes"
                />
              </div>
              <div>
                <Label htmlFor="companyTagline" className="text-xs">Tagline (Header)</Label>
                <Input
                  id="companyTagline"
                  value={brandingData.companyTagline}
                  onChange={(e) => handleInputChange('companyTagline', e.target.value)}
                  placeholder="Property Management Services"
                />
              </div>
              <div>
                <Label htmlFor="companyAddress" className="text-xs">Address</Label>
                <Textarea
                  id="companyAddress"
                  value={brandingData.companyAddress}
                  onChange={(e) => handleInputChange('companyAddress', e.target.value)}
                  placeholder="Company address"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="companyPhone" className="text-xs">Phone</Label>
                  <Input
                    id="companyPhone"
                    value={brandingData.companyPhone}
                    onChange={(e) => handleInputChange('companyPhone', e.target.value)}
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <Label htmlFor="websiteUrl" className="text-xs">Website</Label>
                  <Input
                    id="websiteUrl"
                    value={brandingData.websiteUrl || ''}
                    onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
                    placeholder="www.company.com"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="companyEmail" className="text-xs">Email</Label>
                <Input
                  id="companyEmail"
                  type="email"
                  value={brandingData.companyEmail}
                  onChange={(e) => handleInputChange('companyEmail', e.target.value)}
                  placeholder="Email address"
                />
              </div>
            </div>
          </div>

          {/* Report Layout Preferences */}
          <div>
            <Label className="text-sm font-medium mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Report Layout Preferences
            </Label>
            <div className="space-y-3">
              <div>
                <Label htmlFor="chartDimensions" className="text-xs">Chart Size</Label>
                <Select
                  value={brandingData.reportLayout?.chartDimensions || 'standard'}
                  onValueChange={(value) => handleInputChange('reportLayout', {
                    ...brandingData.reportLayout,
                    chartDimensions: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ultra-compact">Ultra Compact (340×140px)</SelectItem>
                    <SelectItem value="compact">Compact (380×160px)</SelectItem>
                    <SelectItem value="standard">Standard (600×240px)</SelectItem>
                    <SelectItem value="large">Large (800×300px)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="kpiStyle" className="text-xs">KPI Card Style</Label>
                <Select
                  value={brandingData.reportLayout?.kpiStyle || 'cards'}
                  onValueChange={(value) => handleInputChange('reportLayout', {
                    ...brandingData.reportLayout,
                    kpiStyle: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cards">Professional Cards</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="sectionSpacing" className="text-xs">Section Spacing</Label>
                <Select
                  value={brandingData.reportLayout?.sectionSpacing || 'normal'}
                  onValueChange={(value) => handleInputChange('reportLayout', {
                    ...brandingData.reportLayout,
                    sectionSpacing: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tight">Tight</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="spacious">Spacious</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="layoutDensity" className="text-xs">Layout Density</Label>
                <Select
                  value={brandingData.reportLayout?.layoutDensity || 'standard'}
                  onValueChange={(value) => handleInputChange('reportLayout', {
                    ...brandingData.reportLayout,
                    layoutDensity: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compact (Space-efficient)</SelectItem>
                    <SelectItem value="standard">Standard (Balanced)</SelectItem>
                    <SelectItem value="spacious">Spacious (Generous spacing)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="contentFlow" className="text-xs">Content Flow</Label>
                <Select
                  value={brandingData.reportLayout?.contentFlow || 'traditional'}
                  onValueChange={(value) => handleInputChange('reportLayout', {
                    ...brandingData.reportLayout,
                    contentFlow: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="traditional">Traditional</SelectItem>
                    <SelectItem value="optimized">Optimized (Smart spacing)</SelectItem>
                    <SelectItem value="dense">Dense (Maximum content)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="maxKpisPerRow" className="text-xs">KPIs Per Row</Label>
                <Select
                  value={brandingData.reportLayout?.maxKpisPerRow?.toString() || '4'}
                  onValueChange={(value) => handleInputChange('reportLayout', {
                    ...brandingData.reportLayout,
                    maxKpisPerRow: parseInt(value)
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 KPIs</SelectItem>
                    <SelectItem value="4">4 KPIs</SelectItem>
                    <SelectItem value="5">5 KPIs</SelectItem>
                    <SelectItem value="6">6 KPIs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="chartSpacing" className="text-xs">Chart Spacing</Label>
                <Select
                  value={brandingData.reportLayout?.chartSpacing || 'normal'}
                  onValueChange={(value) => handleInputChange('reportLayout', {
                    ...brandingData.reportLayout,
                    chartSpacing: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minimal">Minimal</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="generous">Generous</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showGridlines"
                  checked={brandingData.reportLayout?.showGridlines ?? true}
                  onCheckedChange={(checked) => handleInputChange('reportLayout', {
                    ...brandingData.reportLayout,
                    showGridlines: checked
                  })}
                />
                <Label htmlFor="showGridlines" className="text-xs">Show table gridlines</Label>
              </div>
            </div>
          </div>

          {/* Logo Upload */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Company Logo</Label>
            <div className="space-y-3">
              {brandingData.logoUrl && (
                <div className="border rounded p-2 bg-muted">
                  <img 
                    src={brandingData.logoUrl} 
                    alt="Logo Preview" 
                    className="h-12 w-auto object-contain mx-auto"
                    onError={(e) => {
                      console.error("Logo failed to load:", brandingData.logoUrl);
                      e.currentTarget.style.display = 'none';
                    }}
                    onLoad={() => {
                      console.log("Logo loaded successfully in upload preview");
                    }}
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
                {brandingData.logoUrl ? 'Change Logo' : 'Upload Logo'}
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

          {/* Color Presets */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Color Presets</Label>
            <div className="grid grid-cols-1 gap-2">
              {colorPresets.map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    handleInputChange('primaryColor', preset.primary);
                    handleInputChange('secondaryColor', preset.secondary);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded border"
                      style={{ backgroundColor: preset.primary }}
                    />
                    <div 
                      className="w-4 h-4 rounded border"
                      style={{ backgroundColor: preset.secondary }}
                    />
                    <span className="text-xs">{preset.name}</span>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Colors */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Custom Colors</Label>
            <div className="space-y-3">
              <div>
                <Label htmlFor="primaryColor" className="text-xs">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={brandingData.primaryColor}
                    onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                    className="w-16 h-10 cursor-pointer"
                  />
                  <Input
                    value={brandingData.primaryColor}
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
                    value={brandingData.secondaryColor}
                    onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                    className="w-16 h-10 cursor-pointer"
                  />
                  <Input
                    value={brandingData.secondaryColor}
                    onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                    placeholder="#64748b"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Platform Footer */}
          <div>
            <Label htmlFor="footerText" className="text-sm font-medium mb-3 block">Platform Footer Design</Label>
            <Textarea
              id="footerText"
              value={brandingData.footerText}
              onChange={(e) => handleInputChange('footerText', e.target.value)}
              placeholder="Zira Technologies footer message"
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">
              This footer will appear on all PDF documents in a professional multi-line layout with complete contact information.
            </p>
            <div className="mt-3 p-3 border rounded-lg bg-muted/50">
              <p className="text-xs font-medium mb-2">Footer Preview Format:</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div>Line 1: {brandingData.companyName} | {brandingData.companyPhone} | {brandingData.companyEmail}</div>
                <div>Line 2: {brandingData.companyAddress} | {brandingData.websiteUrl || ''}</div>
                <div>Line 3: {brandingData.footerText}</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-4">
            <Button 
              onClick={handlePreviewPDF} 
              className="w-full"
              variant="outline"
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview Sample PDF
            </Button>
            <Button 
              onClick={handleSave} 
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              Save Customization
            </Button>
            {onClose && (
              <Button 
                onClick={onClose} 
                variant="outline" 
                className="w-full"
              >
                Close
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Right Panel - Live Preview */}
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Live Preview
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            See how your documents will look with your branding
          </p>
        </CardHeader>
        <CardContent>
          <div className="bg-white text-black border rounded-lg shadow-sm overflow-hidden">
            {/* Preview Header */}
            <div 
              className="text-white p-6"
              style={{ backgroundColor: brandingData.primaryColor }}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  {brandingData.logoUrl && (
                    <img 
                      src={brandingData.logoUrl} 
                      alt="Company Logo" 
                      className="h-16 w-auto object-contain bg-white/10 p-2 rounded"
                      onError={(e) => {
                        console.error("Logo failed to load in preview:", brandingData.logoUrl);
                        e.currentTarget.style.display = 'none';
                      }}
                      onLoad={() => {
                        console.log("Logo loaded successfully in preview");
                      }}
                    />
                  )}
                  <div>
                    <h1 className="text-2xl font-bold">{brandingData.companyName}</h1>
                    <p className="opacity-90">{brandingData.companyTagline}</p>
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-bold">DOCUMENT</h2>
                  <p className="opacity-90">DOC-2024-00123</p>
                </div>
              </div>
            </div>

            {/* Preview Content */}
            <div className="p-6 space-y-6">
              {/* Company Info Section */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-bold mb-3 flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Company Information
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p>{brandingData.companyAddress}</p>
                    <p>{brandingData.companyPhone}</p>
                    <p>{brandingData.companyEmail}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="bg-muted p-4 rounded">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="font-medium">Document Date:</span>
                      <span>{new Date().toLocaleDateString()}</span>
                      <span className="font-medium">Website:</span>
                      <span>{brandingData.websiteUrl}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sample Content */}
              <div>
                <h3 className="font-bold mb-4" style={{ color: brandingData.primaryColor }}>
                  DOCUMENT CONTENT
                </h3>
                <div className="bg-muted p-4 rounded">
                  <p className="text-sm text-muted-foreground">
                    This is where your document content will appear. The layout will automatically 
                    adapt to different document types including invoices, reports, letters, and more.
                  </p>
                </div>
              </div>

              {/* Sample Data Section */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-muted/50 p-4 rounded border-l-4" style={{ borderLeftColor: brandingData.primaryColor }}>
                  <h4 className="font-medium" style={{ color: brandingData.primaryColor }}>Section A</h4>
                  <p className="text-sm text-muted-foreground">Dynamic content area</p>
                </div>
                <div className="bg-muted/50 p-4 rounded border-l-4" style={{ borderLeftColor: brandingData.secondaryColor }}>
                  <h4 className="font-medium" style={{ color: brandingData.secondaryColor }}>Section B</h4>
                  <p className="text-sm text-muted-foreground">Flexible layout</p>
                </div>
              </div>
            </div>

            {/* Enhanced Preview Footer - exactly as it appears in PDF */}
            <div className="bg-gray-100 p-4 text-xs border-t">
              <div className="space-y-1 text-gray-600">
                <p>{brandingData.companyName} | {brandingData.companyPhone} | {brandingData.companyEmail}</p>
                <p>{brandingData.companyAddress} | {brandingData.websiteUrl || ''}</p>
                <p className="font-medium">{brandingData.footerText}</p>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
                <span className="text-gray-500">Footer appears on all pages</span>
                <span className="text-gray-500">Page 1</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};