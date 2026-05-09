import React, { useState } from "react";
import { formatAmount } from "@/utils/currency";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, Plus, Send, MessageSquare } from "lucide-react";

interface SmsTemplate {
  id: string;
  name: string;
  template: string;
  timing: string;
  audienceType: string;
  enabled: boolean;
}

interface SmsTemplateEditorProps {
  template?: SmsTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (template: Partial<SmsTemplate>) => void;
}

const VARIABLES = [
  { key: "{{tenant_name}}", description: "Tenant's full name" },
  { key: "{{first_name}}", description: "Tenant's first name" },
  { key: "{{last_name}}", description: "Tenant's last name" },
  { key: "{{property_name}}", description: "Property name" },
  { key: "{{unit_number}}", description: "Unit number" },
  { key: "{{rent_amount}}", description: "Monthly rent amount" },
  { key: "{{due_date}}", description: "Payment due date" },
  { key: "{{balance}}", description: "Outstanding balance" },
  { key: "{{landlord_name}}", description: "Landlord's name" },
  { key: "{{company_name}}", description: "Property management company" },
  { key: "{{phone_number}}", description: "Contact phone number" },
  { key: "{{lease_end_date}}", description: "Lease expiration date" },
  { key: "{{maintenance_request_id}}", description: "Request ID number" },
  { key: "{{technician_name}}", description: "Assigned technician" },
  { key: "{{scheduled_date}}", description: "Scheduled service date" }
];

const TIMING_OPTIONS = [
  { value: "immediate", label: "Immediate" },
  { value: "1-hour", label: "1 Hour Before" },
  { value: "24-hours", label: "24 Hours Before" },
  { value: "3-days", label: "3 Days Before" },
  { value: "7-days", label: "7 Days Before" },
  { value: "on-due-date", label: "On Due Date" },
  { value: "manual", label: "Manual Send" }
];

const AUDIENCE_OPTIONS = [
  { value: "tenants", label: "Tenants" },
  { value: "landlords", label: "Landlords" },
  { value: "admins", label: "Admins" },
  { value: "all", label: "All Users" }
];

export function SmsTemplateEditor({ template, open, onOpenChange, onSave }: SmsTemplateEditorProps) {
  const [formData, setFormData] = useState({
    name: template?.name || "",
    template: template?.template || "",
    timing: template?.timing || "immediate",
    audienceType: template?.audienceType || "tenants",
    enabled: template?.enabled ?? true
  });
  const [previewText, setPreviewText] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('template-textarea') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData.template;
      const newText = text.substring(0, start) + variable + text.substring(end);
      setFormData({ ...formData, template: newText });
    }
  };

  const generatePreview = () => {
    let preview = formData.template;
    
    // Replace variables with sample data
    const sampleData = {
      "{{tenant_name}}": "John Doe",
      "{{first_name}}": "John",
      "{{last_name}}": "Doe",
      "{{property_name}}": "Sunset Apartments",
      "{{unit_number}}": "A-101",
      "{{rent_amount}}": formatAmount(50000),
      "{{due_date}}": "5th January 2024",
      "{{balance}}": formatAmount(25000),
      "{{landlord_name}}": "Jane Smith",
      "{{company_name}}": "Zira Property Management",
      "{{phone_number}}": "+254 700 000 000",
      "{{lease_end_date}}": "31st December 2024",
      "{{maintenance_request_id}}": "MR-2024-001",
      "{{technician_name}}": "Mike Johnson",
      "{{scheduled_date}}": "Tomorrow at 10:00 AM"
    };

    Object.entries(sampleData).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    });

    setPreviewText(preview);
    setShowPreview(true);
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.template.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    onSave(formData);
    onOpenChange(false);
    toast({
      title: "Success",
      description: `Template ${template ? 'updated' : 'created'} successfully`
    });
  };

  const sendTestSms = () => {
    generatePreview();
    toast({
      title: "Test SMS",
      description: "Test SMS would be sent to your phone number",
      variant: "default"
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-y-auto bg-tint-gray">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-primary">
            {template ? 'Edit SMS Template' : 'Create SMS Template'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-primary">
                Template Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Rent Due Reminder"
                className="bg-card border-border focus:border-accent focus:ring-accent"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timing" className="text-sm font-medium text-primary">
                Send Timing
              </Label>
              <Select value={formData.timing} onValueChange={(value) => setFormData({ ...formData, timing: value })}>
                <SelectTrigger className="bg-card border-border focus:border-accent focus:ring-accent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMING_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audience" className="text-sm font-medium text-primary">
                Target Audience
              </Label>
              <Select value={formData.audienceType} onValueChange={(value) => setFormData({ ...formData, audienceType: value })}>
                <SelectTrigger className="bg-card border-border focus:border-accent focus:ring-accent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUDIENCE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-textarea" className="text-sm font-medium text-primary">
                Message Template <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="template-textarea"
                value={formData.template}
                onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                placeholder="Enter your SMS message here. Use variables like {{tenant_name}} for personalization."
                rows={6}
                className="bg-card border-border focus:border-accent focus:ring-accent"
              />
              <div className="text-xs text-muted-foreground">
                Character count: {formData.template.length}/160 (SMS limit)
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={generatePreview} variant="outline" className="flex-1">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button onClick={sendTestSms} variant="outline" className="flex-1">
                <Send className="h-4 w-4 mr-2" />
                Test SMS
              </Button>
            </div>
          </div>

          {/* Right Column - Variables & Preview */}
          <div className="space-y-4">
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-primary">Available Variables</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-60 overflow-y-auto">
                {VARIABLES.map((variable) => (
                  <div key={variable.key} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                    <div>
                      <Badge variant="outline" className="text-xs font-mono">
                        {variable.key}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">{variable.description}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => insertVariable(variable.key)}
                      className="h-6 w-6 p-0"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {showPreview && (
              <Card className="bg-card">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-primary flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted p-3 rounded border-l-4 border-primary">
                    <p className="text-sm">{previewText}</p>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Preview length: {previewText.length} characters
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-accent hover:bg-accent/90">
            {template ? 'Update Template' : 'Create Template'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}