import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Save, Eye, X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { createSafeHtml } from "@/utils/xssProtection";

interface EmailTemplate {
  id: string;
  template_name: string;
  days_before_expiry: number;
  subject: string;
  email_content: string;
  html_content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const EmailTemplateEditor = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalTemplate, setOriginalTemplate] = useState<EmailTemplate | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Keyboard shortcut for saving
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (editingTemplate && hasUnsavedChanges) {
          saveTemplate();
        }
      }
    };

    if (editingTemplate) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [editingTemplate, hasUnsavedChanges]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('trial_notification_templates')
        .select('*')
        .order('days_before_expiry', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: "Error",
        description: "Failed to load email templates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveTemplate = async () => {
    if (!editingTemplate) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('trial_notification_templates')
        .update({
          template_name: editingTemplate.template_name,
          subject: editingTemplate.subject,
          email_content: editingTemplate.email_content,
          html_content: editingTemplate.html_content,
          is_active: editingTemplate.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingTemplate.id);

      if (error) throw error;

      setTemplates(prev => prev.map(t => 
        t.id === editingTemplate.id ? editingTemplate : t
      ));
      setEditingTemplate(null);
      setHasUnsavedChanges(false);
      setOriginalTemplate(null);

      toast({
        title: "Template Saved",
        description: "Email template has been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: "Failed to save email template",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTemplateChange = (updates: Partial<EmailTemplate>) => {
    setEditingTemplate(prev => prev ? { ...prev, ...updates } : null);
    setHasUnsavedChanges(true);
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        setEditingTemplate(null);
        setHasUnsavedChanges(false);
        setOriginalTemplate(null);
      }
    } else {
      setEditingTemplate(null);
    }
  };

  const getStatusBadge = (template: EmailTemplate) => {
    if (!template.is_active) {
      return <Badge variant="outline">Inactive</Badge>;
    }
    
    if (template.days_before_expiry === 0) {
      return <Badge variant="destructive">Expired/Suspended</Badge>;
    } else if (template.days_before_expiry === 1) {
      return <Badge variant="destructive">Critical</Badge>;
    } else if (template.days_before_expiry === 3) {
      return <Badge variant="destructive">Urgent</Badge>;
    } else {
      return <Badge variant="secondary">Active</Badge>;
    }
  };

  const getTemplateDescription = (template: EmailTemplate) => {
    if (template.days_before_expiry === 0) {
      return "Sent when trial expires (grace period starts)";
    }
    return `Sent ${template.days_before_expiry} days before trial expiry`;
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading templates...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        {templates.map((template) => (
          <Card key={template.id} className="relative">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <CardTitle className="text-lg">{template.template_name}</CardTitle>
                    {getStatusBadge(template)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {getTemplateDescription(template)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPreviewTemplate(template)}
                    className="flex items-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      setEditingTemplate({ ...template });
                      setOriginalTemplate({ ...template });
                      setHasUnsavedChanges(false);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Subject:</p>
                  <p className="text-sm font-medium">{template.subject}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Preview:</p>
                  <div className="bg-muted/50 p-3 rounded text-sm">
                    {template.email_content.slice(0, 200)}...
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-6xl max-h-[90vh] flex flex-col">
            <CardHeader className="flex-shrink-0 sticky top-0 z-20 bg-white/95 backdrop-blur border-b">
              <div className="flex items-center justify-between">
                <CardTitle>Edit Email Template</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={saveTemplate}
                    disabled={saving || !hasUnsavedChanges}
                    title={!hasUnsavedChanges ? "No changes to save" : ""}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {saving ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleClose}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 flex flex-col space-y-6 overflow-y-auto">
              <div className="grid gap-4 md:grid-cols-2 flex-shrink-0">
                <div className="space-y-2">
                  <Label htmlFor="template-name">Template Name</Label>
                  <Input
                    id="template-name"
                    value={editingTemplate.template_name}
                    onChange={(e) => handleTemplateChange({ template_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-subject">Email Subject</Label>
                  <Input
                    id="template-subject"
                    value={editingTemplate.subject}
                    onChange={(e) => handleTemplateChange({ subject: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-shrink-0">
                <Switch
                  checked={editingTemplate.is_active}
                  onCheckedChange={(checked) => handleTemplateChange({ is_active: checked })}
                />
                <Label>Template is active</Label>
              </div>

              <Tabs defaultValue="text" className="w-full">
                <TabsList className="flex-shrink-0">
                  <TabsTrigger value="text">Plain Text</TabsTrigger>
                  <TabsTrigger value="html">HTML</TabsTrigger>
                </TabsList>
                <TabsContent value="text" className="space-y-2">
                  <Label htmlFor="email-content">Email Content (Plain Text)</Label>
                  <Textarea
                    id="email-content"
                    value={editingTemplate.email_content}
                    onChange={(e) => handleTemplateChange({ email_content: e.target.value })}
                    className="min-h-[300px] max-h-[400px] resize-none"
                    placeholder="Enter email content in plain text..."
                  />
                  <p className="text-sm text-muted-foreground">
                    Available variables: {"{{first_name}}"}, {"{{trial_end_date}}"}, {"{{days_remaining}}"}, {"{{upgrade_url}}"}
                  </p>
                </TabsContent>
                <TabsContent value="html" className="space-y-2">
                  <Label htmlFor="html-content">Email Content (HTML)</Label>
                  <Textarea
                    id="html-content"
                    value={editingTemplate.html_content}
                    onChange={(e) => handleTemplateChange({ html_content: e.target.value })}
                    className="min-h-[300px] max-h-[400px] resize-none"
                    placeholder="Enter email content in HTML..."
                  />
                  <p className="text-sm text-muted-foreground">
                    Available variables: {"{{first_name}}"}, {"{{trial_end_date}}"}, {"{{days_remaining}}"}, {"{{upgrade_url}}"}
                  </p>
                </TabsContent>
              </Tabs>

              <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t shadow-sm pt-4 mt-4 flex justify-end space-x-2 z-10">
                <Button
                  variant="outline"
                  onClick={handleClose}
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveTemplate}
                  disabled={saving || !hasUnsavedChanges}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : hasUnsavedChanges ? "Save Template" : "Saved"}
                </Button>
                {hasUnsavedChanges && !saving && (
                  <p className="text-xs text-muted-foreground self-center mr-2">
                    Press Ctrl+S to save
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Preview Dialog */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl h-[95vh] flex flex-col">
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle>Email Preview</CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPreviewTemplate(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col space-y-4 overflow-y-auto">
              <div className="border-b pb-4 flex-shrink-0">
                <h3 className="font-semibold">{previewTemplate.template_name}</h3>
                <p className="text-sm text-muted-foreground">
                  {getTemplateDescription(previewTemplate)}
                </p>
              </div>
              
              <div className="flex-shrink-0">
                <h4 className="font-medium mb-2">Subject:</h4>
                <p className="text-sm bg-muted p-2 rounded">{previewTemplate.subject}</p>
              </div>

              <div className="flex-1 flex flex-col">
                <h4 className="font-medium mb-2">Email Content:</h4>
                <div className="bg-muted p-4 rounded text-sm whitespace-pre-wrap flex-1 overflow-y-auto">
                  {previewTemplate.email_content}
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-0">
                <h4 className="font-medium mb-2">HTML Preview:</h4>
                <div 
                  className="border p-4 rounded bg-white text-sm flex-1 overflow-y-auto min-h-[200px]"
                  dangerouslySetInnerHTML={createSafeHtml(previewTemplate.html_content)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default EmailTemplateEditor;