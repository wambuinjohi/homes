import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  DragDropContext, 
  Droppable, 
  Draggable, 
  DropResult 
} from "react-beautiful-dnd";
import { 
  GripVertical, 
  Plus, 
  Trash2, 
  Eye, 
  Save,
  Settings,
  Palette,
  Layout,
  FileText
} from "lucide-react";

interface PDFTemplate {
  id: string;
  name: string;
  type: 'financial' | 'report' | 'legal' | 'communication';
  status: 'active' | 'draft';
  assignedTo: string[];
  createdDate: string;
  lastModified: string;
  description?: string;
  metadata?: {
    layout?: ContentBlock[];
  };
  branding?: {
    primaryColor?: string;
    accentColor?: string;
    fontFamily?: string;
    logoUrl?: string;
    companyName?: string;
    address?: string;
    website?: string;
    footerText?: string;
  };
}

interface ContentBlock {
  id: string;
  type: 'header' | 'company_info' | 'landlord_info' | 'tenant_info' | 'table' | 'summary' | 'notes' | 'footer' | 'payment_instructions';
  title: string;
  content: any;
  enabled: boolean;
}

interface TemplateEditorProps {
  template: PDFTemplate;
  onSave: (template: PDFTemplate) => void;
  onCancel: () => void;
}

const defaultBlocks: ContentBlock[] = [
  {
    id: 'header',
    type: 'header',
    title: 'Header Section',
    content: { 
      showLogo: true, 
      title: 'INVOICE', 
      showDate: true, 
      showNumber: true 
    },
    enabled: true,
  },
  {
    id: 'company_info',
    type: 'company_info',
    title: 'Company Information',
    content: { 
      name: 'Zira Homes',
      tagline: 'Professional Property Management Services',
      autoFill: true 
    },
    enabled: true,
  },
  {
    id: 'landlord_info',
    type: 'landlord_info',
    title: 'Landlord Information',
    content: { showName: true, showEmail: true, showPhone: true },
    enabled: true,
  },
  {
    id: 'tenant_info',
    type: 'tenant_info',
    title: 'Tenant Information',
    content: { showName: true, showEmail: true, showPhone: true },
    enabled: false,
  },
  {
    id: 'table',
    type: 'table',
    title: 'Main Content Table',
    content: { 
      headers: ['Description', 'Amount'],
      alternateRows: true,
      showTotals: true 
    },
    enabled: true,
  },
  {
    id: 'summary',
    type: 'summary',
    title: 'Summary Section',
    content: { 
      showSubtotal: true, 
      showTax: false, 
      showTotal: true 
    },
    enabled: true,
  },
  {
    id: 'notes',
    type: 'notes',
    title: 'Notes Section',
    content: { placeholder: 'Additional notes or terms...' },
    enabled: false,
  },
  {
    id: 'payment_instructions',
    type: 'payment_instructions',
    title: 'Payment Instructions',
    content: { text: 'Payment can be made via M-Pesa or bank transfer.' },
    enabled: false,
  },
  {
    id: 'footer',
    type: 'footer',
    title: 'Footer Section',
    content: { 
      text: 'Thank you for choosing Zira Homes',
      showContact: true 
    },
    enabled: true,
  },
];

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ 
  template, 
  onSave, 
  onCancel 
}) => {
  const [editedTemplate, setEditedTemplate] = useState(template);
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>(defaultBlocks);
  const [brandingSettings, setBrandingSettings] = useState({
    primaryColor: '#1A73E8',
    accentColor: '#FF6B35',
    logoUrl: '',
    fontFamily: 'Inter',
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(contentBlocks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setContentBlocks(items);
  };

  const toggleBlock = (blockId: string) => {
    setContentBlocks(blocks => 
      blocks.map(block => 
        block.id === blockId 
          ? { ...block, enabled: !block.enabled }
          : block
      )
    );
  };

  const updateBlockContent = (blockId: string, content: any) => {
    setContentBlocks(blocks => 
      blocks.map(block => 
        block.id === blockId 
          ? { ...block, content: { ...block.content, ...content } }
          : block
      )
    );
  };

  const renderBlockEditor = (block: ContentBlock) => {
    switch (block.type) {
      case 'header':
        return (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch
                checked={block.content.showLogo}
                onCheckedChange={(checked) => 
                  updateBlockContent(block.id, { showLogo: checked })
                }
              />
              <Label>Show Company Logo</Label>
            </div>
            <div>
              <Label>Document Title</Label>
              <Input
                value={block.content.title}
                onChange={(e) => 
                  updateBlockContent(block.id, { title: e.target.value })
                }
                placeholder="INVOICE"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={block.content.showDate}
                  onCheckedChange={(checked) => 
                    updateBlockContent(block.id, { showDate: checked })
                  }
                />
                <Label>Show Date</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={block.content.showNumber}
                  onCheckedChange={(checked) => 
                    updateBlockContent(block.id, { showNumber: checked })
                  }
                />
                <Label>Show Document Number</Label>
              </div>
            </div>
          </div>
        );

      case 'table':
        return (
          <div className="space-y-3">
            <div>
              <Label>Table Headers (comma-separated)</Label>
              <Input
                value={block.content.headers.join(', ')}
                onChange={(e) => 
                  updateBlockContent(block.id, { 
                    headers: e.target.value.split(',').map(h => h.trim()) 
                  })
                }
                placeholder="Description, Amount"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={block.content.alternateRows}
                  onCheckedChange={(checked) => 
                    updateBlockContent(block.id, { alternateRows: checked })
                  }
                />
                <Label>Alternate Row Colors</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={block.content.showTotals}
                  onCheckedChange={(checked) => 
                    updateBlockContent(block.id, { showTotals: checked })
                  }
                />
                <Label>Show Totals Row</Label>
              </div>
            </div>
          </div>
        );

      case 'notes':
        return (
          <div>
            <Label>Notes Placeholder Text</Label>
            <Textarea
              value={block.content.placeholder}
              onChange={(e) => 
                updateBlockContent(block.id, { placeholder: e.target.value })
              }
              placeholder="Enter placeholder text..."
            />
          </div>
        );

      case 'payment_instructions':
        return (
          <div>
            <Label>Payment Instructions</Label>
            <Textarea
              value={block.content.text}
              onChange={(e) => 
                updateBlockContent(block.id, { text: e.target.value })
              }
              placeholder="Enter payment instructions..."
            />
          </div>
        );

      default:
        return (
          <div className="text-sm text-muted-foreground">
            Configuration options for {block.title}
          </div>
        );
    }
  };

  const handleSave = () => {
    const updatedTemplate = {
      ...editedTemplate,
      lastModified: new Date().toISOString().split('T')[0],
    };
    onSave(updatedTemplate);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="layout" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="layout" className="flex items-center gap-2">
            <Layout className="h-4 w-4" />
            Layout
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="layout" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Content Blocks</CardTitle>
              <p className="text-sm text-muted-foreground">
                Drag and drop to reorder sections. Toggle to enable/disable blocks.
              </p>
            </CardHeader>
            <CardContent>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="content-blocks">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-3"
                    >
                      {contentBlocks.map((block, index) => (
                        <Draggable key={block.id} draggableId={block.id} index={index}>
                          {(provided) => (
                            <Card
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`${block.enabled ? 'border-primary' : 'border-muted'}`}
                            >
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div
                                      {...provided.dragHandleProps}
                                      className="cursor-grab"
                                    >
                                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div>
                                      <h4 className="font-medium">{block.title}</h4>
                                      <Badge 
                                        variant={block.enabled ? "default" : "secondary"}
                                        className="text-xs"
                                      >
                                        {block.enabled ? 'Enabled' : 'Disabled'}
                                      </Badge>
                                    </div>
                                  </div>
                                  <Switch
                                    checked={block.enabled}
                                    onCheckedChange={() => toggleBlock(block.id)}
                                  />
                                </div>
                              </CardHeader>
                              {block.enabled && (
                                <CardContent className="pt-0">
                                  {renderBlockEditor(block)}
                                </CardContent>
                              )}
                            </Card>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Brand Settings</CardTitle>
              <p className="text-sm text-muted-foreground">
                Customize colors, logo, and company information for your templates
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo Upload Section */}
              <div>
                <Label className="text-base font-medium">Company Logo</Label>
                <div className="mt-2 space-y-4">
                  <div className="flex items-center gap-4">
                    {editedTemplate.branding?.logoUrl ? (
                      <div className="relative">
                        <img 
                          src={editedTemplate.branding.logoUrl} 
                          alt="Company Logo" 
                          className="h-16 w-auto max-w-32 border rounded"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                          onClick={() => setEditedTemplate(prev => ({
                            ...prev,
                            branding: { ...prev.branding, logoUrl: '' }
                          }))}
                        >
                          ×
                        </Button>
                      </div>
                    ) : (
                      <div className="h-16 w-32 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-sm text-gray-500">
                        No logo
                      </div>
                    )}
                    <div className="space-y-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                              setEditedTemplate(prev => ({
                                ...prev,
                                branding: { ...prev.branding, logoUrl: e.target?.result as string }
                              }));
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="text-sm"
                      />
                      <p className="text-xs text-gray-500">
                        Upload a PNG, JPG, or SVG file. Recommended size: 200x60px
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Company Information */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Company Information</Label>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Company Name</Label>
                    <Input
                      value={editedTemplate.branding?.companyName || ''}
                      onChange={(e) => setEditedTemplate(prev => ({
                        ...prev,
                        branding: { ...prev.branding, companyName: e.target.value }
                      }))}
                      placeholder="Your Company Name"
                    />
                  </div>
                  <div>
                    <Label>Website</Label>
                    <Input
                      value={editedTemplate.branding?.website || ''}
                      onChange={(e) => setEditedTemplate(prev => ({
                        ...prev,
                        branding: { ...prev.branding, website: e.target.value }
                      }))}
                      placeholder="www.yourcompany.com"
                    />
                  </div>
                </div>
                <div>
                  <Label>Company Address</Label>
                  <Textarea
                    value={editedTemplate.branding?.address || ''}
                    onChange={(e) => setEditedTemplate(prev => ({
                      ...prev,
                      branding: { ...prev.branding, address: e.target.value }
                    }))}
                    placeholder="123 Business Street, City, State 12345"
                    rows={2}
                  />
                </div>
              </div>

              {/* Color Settings */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Color Scheme</Label>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={editedTemplate.branding?.primaryColor || '#1A73E8'}
                        onChange={(e) => setEditedTemplate(prev => ({
                          ...prev,
                          branding: { ...prev.branding, primaryColor: e.target.value }
                        }))}
                        className="w-16 h-10"
                      />
                      <Input
                        value={editedTemplate.branding?.primaryColor || '#1A73E8'}
                        onChange={(e) => setEditedTemplate(prev => ({
                          ...prev,
                          branding: { ...prev.branding, primaryColor: e.target.value }
                        }))}
                        placeholder="#1A73E8"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Accent Color</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={editedTemplate.branding?.accentColor || '#FF6B35'}
                        onChange={(e) => setEditedTemplate(prev => ({
                          ...prev,
                          branding: { ...prev.branding, accentColor: e.target.value }
                        }))}
                        className="w-16 h-10"
                      />
                      <Input
                        value={editedTemplate.branding?.accentColor || '#FF6B35'}
                        onChange={(e) => setEditedTemplate(prev => ({
                          ...prev,
                          branding: { ...prev.branding, accentColor: e.target.value }
                        }))}
                        placeholder="#FF6B35"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Typography */}
              <div>
                <Label className="text-base font-medium">Typography</Label>
                <div className="mt-2">
                  <Label>Font Family</Label>
                  <Select 
                    value={editedTemplate.branding?.fontFamily || 'Inter'}
                    onValueChange={(value) => setEditedTemplate(prev => ({
                      ...prev,
                      branding: { ...prev.branding, fontFamily: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inter">Inter</SelectItem>
                      <SelectItem value="Roboto">Roboto</SelectItem>
                      <SelectItem value="Helvetica">Helvetica</SelectItem>
                      <SelectItem value="Arial">Arial</SelectItem>
                      <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Footer Settings */}
              <div>
                <Label className="text-base font-medium">Footer Settings</Label>
                <div className="mt-2">
                  <Label>Footer Text</Label>
                  <Textarea
                    value={editedTemplate.branding?.footerText || ''}
                    onChange={(e) => setEditedTemplate(prev => ({
                      ...prev,
                      branding: { ...prev.branding, footerText: e.target.value }
                    }))}
                    placeholder="Thank you for your business • Contact us at info@company.com • (555) 123-4567"
                    rows={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This text will appear at the bottom of all documents generated with this template
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Template Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Template Name</Label>
                <Input
                  value={editedTemplate.name}
                  onChange={(e) => setEditedTemplate(prev => ({
                    ...prev,
                    name: e.target.value
                  }))}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={editedTemplate.description || ''}
                  onChange={(e) => setEditedTemplate(prev => ({
                    ...prev,
                    description: e.target.value
                  }))}
                  placeholder="Brief description of this template..."
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select 
                  value={editedTemplate.status}
                  onValueChange={(value) => setEditedTemplate(prev => ({
                    ...prev,
                    status: value as 'active' | 'draft'
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Template Preview</CardTitle>
              <p className="text-sm text-muted-foreground">
                Preview how your template will look with sample data
              </p>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-6 bg-white text-black min-h-[600px]">
                {/* Header Preview */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b">
                  <div className="flex items-center gap-4">
                    {template.branding?.logoUrl && (
                      <img 
                        src={template.branding.logoUrl} 
                        alt="Company Logo" 
                        className="h-12 w-auto"
                      />
                    )}
                    <div>
                      <h2 className="text-xl font-semibold" style={{ color: template.branding?.primaryColor || '#000' }}>
                        {template.branding?.companyName || 'Company Name'}
                      </h2>
                      <p className="text-sm text-gray-600">
                        {template.branding?.address || '123 Business St, City, State 12345'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    <p>Date: {new Date().toLocaleDateString()}</p>
                    <p>Document #: DOC-001</p>
                  </div>
                </div>

                {/* Content Preview */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2" style={{ color: template.branding?.primaryColor || '#000' }}>
                      {template.type === 'financial' ? 'Invoice #INV-001' : 
                       template.type === 'report' ? 'Monthly Report' :
                       template.type === 'legal' ? 'Legal Notice' : 'Communication'}
                    </h3>
                    {template.type === 'financial' && (
                      <div className="bg-gray-50 p-4 rounded">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="font-medium">Bill To:</p>
                            <p>John Doe</p>
                            <p>Apt 101, Building A</p>
                          </div>
                          <div>
                            <p className="font-medium">Amount Due:</p>
                            <p className="text-2xl font-bold">$1,200.00</p>
                            <p>Due Date: {new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <table className="w-full border-collapse border border-gray-300">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="border border-gray-300 p-2 text-left">Description</th>
                              <th className="border border-gray-300 p-2 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="border border-gray-300 p-2">Monthly Rent</td>
                              <td className="border border-gray-300 p-2 text-right">$1,000.00</td>
                            </tr>
                            <tr>
                              <td className="border border-gray-300 p-2">Service Charge</td>
                              <td className="border border-gray-300 p-2 text-right">$200.00</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                    {template.type === 'report' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-gray-50 p-4 rounded text-center">
                            <p className="text-2xl font-bold">156</p>
                            <p className="text-sm text-gray-600">Total Units</p>
                          </div>
                          <div className="bg-gray-50 p-4 rounded text-center">
                            <p className="text-2xl font-bold">92%</p>
                            <p className="text-sm text-gray-600">Occupancy Rate</p>
                          </div>
                          <div className="bg-gray-50 p-4 rounded text-center">
                            <p className="text-2xl font-bold">$245,000</p>
                            <p className="text-sm text-gray-600">Monthly Revenue</p>
                          </div>
                        </div>
                        <div className="bg-gray-100 h-32 rounded flex items-center justify-center">
                          <p className="text-gray-600">Chart Placeholder</p>
                        </div>
                      </div>
                    )}
                    {template.type === 'legal' && (
                      <div className="space-y-4">
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                          <p className="font-medium">IMPORTANT NOTICE</p>
                          <p className="mt-2">This is to inform all tenants about upcoming maintenance work...</p>
                        </div>
                        <p>Dear Tenant,</p>
                        <p>We are writing to inform you of the following...</p>
                      </div>
                    )}
                    {template.type === 'communication' && (
                      <div className="space-y-4">
                        <p>Dear Tenant,</p>
                        <p>We hope this message finds you well. We are writing to update you on...</p>
                        <p>Please feel free to contact us if you have any questions.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Preview */}
                <div className="mt-8 pt-4 border-t text-center text-sm text-gray-600">
                  <p>{template.branding?.footerText || 'Thank you for your business • Contact us at info@company.com • (555) 123-4567'}</p>
                  <p className="mt-1">
                    {template.branding?.website || 'www.company.com'} | 
                    {template.branding?.companyName || 'Company Name'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} className="flex items-center gap-2">
          <Save className="h-4 w-4" />
          Save Template
        </Button>
      </div>
    </div>
  );
};