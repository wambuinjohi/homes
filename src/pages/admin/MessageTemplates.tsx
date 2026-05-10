import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, MessageSquare, Phone, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface MessageTemplate {
  id: string;
  name: string;
  type: string;
  category: string;
  subject?: string;
  content: string;
  variables: string[];
  enabled: boolean;
  created_at: string;
}

const MessageTemplates = () => {
  const { toast } = useToast();
  
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    type: 'sms' as 'sms' | 'whatsapp',
    category: '',
    content: '',
    enabled: true,
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates((data || []) as MessageTemplate[]);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: "Error",
        description: "Failed to load message templates.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const categories = ['payment', 'maintenance', 'account', 'announcement', 'lease', 'general', 'emergency'];

  const extractVariables = (content: string): string[] => {
    const regex = /\{\{([^}]+)\}\}/g;
    const variables: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    return variables;
  };

  const saveTemplate = async () => {
    if (!newTemplate.name || !newTemplate.content) {
      toast({
        title: "Validation Error",
        description: "Please provide template name and content.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('message_templates')
        .insert([{
          name: newTemplate.name,
          type: newTemplate.type,
          category: newTemplate.category || 'general',
          content: newTemplate.content,
          variables: extractVariables(newTemplate.content),
          enabled: newTemplate.enabled,
        }]);

      if (error) throw error;

      setNewTemplate({ name: '', type: 'sms', category: '', content: '', enabled: true });
      fetchTemplates(); // Refresh the list
      
      toast({
        title: "Template Created",
        description: "Message template has been created successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create template.",
        variant: "destructive",
      });
    }
  };

  const updateTemplate = async () => {
    if (!editingTemplate) return;

    try {
      const { error } = await supabase
        .from('message_templates')
        .update({
          name: editingTemplate.name,
          content: editingTemplate.content,
          category: editingTemplate.category,
          variables: extractVariables(editingTemplate.content),
          enabled: editingTemplate.enabled,
        })
        .eq('id', editingTemplate.id);

      if (error) throw error;

      setEditingTemplate(null);
      fetchTemplates(); // Refresh the list
      
      toast({
        title: "Template Updated",
        description: "Message template has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update template.",
        variant: "destructive",
      });
    }
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      fetchTemplates(); // Refresh the list
      toast({
        title: "Template Deleted",
        description: "Message template has been deleted.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete template.",
        variant: "destructive",
      });
    }
  };

  const duplicateTemplate = async (template: MessageTemplate) => {
    try {
      const { error } = await supabase
        .from('message_templates')
        .insert([{
          name: `${template.name} (Copy)`,
          type: template.type,
          category: template.category,
          content: template.content,
          variables: template.variables,
          enabled: template.enabled,
        }]);

      if (error) throw error;

      fetchTemplates(); // Refresh the list
      toast({
        title: "Template Duplicated",
        description: "Message template has been duplicated.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to duplicate template.",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="bg-tint-gray p-3 sm:p-4 lg:p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-primary">Message Templates</h1>
            <p className="text-muted-foreground">
              Create and manage SMS and WhatsApp message templates
            </p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Message Template</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="template-name">Template Name</Label>
                    <Input
                      id="template-name"
                      placeholder="e.g., Rent Reminder"
                      value={newTemplate.name}
                      onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template-type">Type</Label>
                    <Select value={newTemplate.type} onValueChange={(value: 'sms' | 'whatsapp') => setNewTemplate({ ...newTemplate, type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="template-category">Category</Label>
                  <Select value={newTemplate.category} onValueChange={(value) => setNewTemplate({ ...newTemplate, category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="template-content">Message Content</Label>
                  <Textarea
                    id="template-content"
                    placeholder="Use {{variable_name}} for dynamic content"
                    rows={4}
                    value={newTemplate.content}
                    onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                  />
                  <div className="text-xs text-muted-foreground">
                    <p><strong>User/Tenant:</strong> {`{{first_name}}, {{last_name}}, {{tenant_name}}, {{user_role}}, {{email}}`}</p>
                    <p><strong>Property:</strong> {`{{property_name}}, {{unit_number}}`}</p>
                    <p><strong>Payment:</strong> {`{{amount}}, {{due_date}}, {{transaction_id}}, {{days_overdue}}`}</p>
                    <p><strong>Maintenance:</strong> {`{{request_title}}, {{new_status}}, {{service_provider_name}}, {{message}}`}</p>
                    <p><strong>Account:</strong> {`{{temporary_password}}, {{login_url}}`}</p>
                    <p><strong>Announcements:</strong> {`{{announcement_title}}, {{announcement_message}}, {{is_urgent}}`}</p>
                    <p><strong>Found:</strong> {extractVariables(newTemplate.content).join(', ') || 'None'}</p>
                  </div>
                </div>

                {/* Preview */}
                {newTemplate.content && (
                  <div className="space-y-2">
                    <Label>Preview</Label>
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm">
                        {newTemplate.content
                          .replace(/\{\{first_name\}\}/g, 'John')
                          .replace(/\{\{last_name\}\}/g, 'Doe')
                          .replace(/\{\{tenant_name\}\}/g, 'John Doe')
                          .replace(/\{\{user_role\}\}/g, 'Tenant')
                          .replace(/\{\{email\}\}/g, 'john.doe@example.com')
                          .replace(/\{\{property_name\}\}/g, 'Sunset Apartments')
                          .replace(/\{\{unit_number\}\}/g, 'A-101')
                          .replace(/\{\{amount\}\}/g, '15,000')
                          .replace(/\{\{due_date\}\}/g, 'January 31, 2025')
                          .replace(/\{\{transaction_id\}\}/g, 'TXN123456')
                          .replace(/\{\{days_overdue\}\}/g, '5')
                          .replace(/\{\{temporary_password\}\}/g, 'TempPass123!')
                          .replace(/\{\{login_url\}\}/g, 'https://portal.ziraproperty.com')
                          .replace(/\{\{request_title\}\}/g, 'Kitchen Faucet Repair')
                          .replace(/\{\{new_status\}\}/g, 'In Progress')
                          .replace(/\{\{service_provider_name\}\}/g, 'ABC Plumbing')
                          .replace(/\{\{message\}\}/g, 'Work scheduled for tomorrow')
                          .replace(/\{\{announcement_title\}\}/g, 'Pool Maintenance Notice')
                          .replace(/\{\{announcement_message\}\}/g, 'Pool will be closed for maintenance')
                          .replace(/\{\{is_urgent\}\}/g, 'true')
                        }
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setNewTemplate({ name: '', type: 'sms', category: '', content: '', enabled: true })}>
                    Cancel
                  </Button>
                  <Button onClick={saveTemplate}>Create Template</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Templates Grid */}
        <div className="grid gap-6">
          {loading ? (
            <div className="text-center py-8">Loading templates...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No message templates found.</div>
          ) : (
            templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        {template.type === 'sms' ? (
                          <MessageSquare className="h-5 w-5 text-primary" />
                        ) : (
                          <Phone className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary">{template.type.toUpperCase()}</Badge>
                          <Badge variant="outline">{template.category}</Badge>
                          <Badge variant={template.enabled ? "default" : "secondary"}>
                            {template.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => duplicateTemplate(template)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingTemplate(template)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Edit Template</DialogTitle>
                          </DialogHeader>
                          {editingTemplate && (
                            <div className="space-y-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                  <Label>Template Name</Label>
                                  <Input
                                    value={editingTemplate.name}
                                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Category</Label>
                                  <Select value={editingTemplate.category} onValueChange={(value) => setEditingTemplate({ ...editingTemplate, category: value })}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {categories.map(category => (
                                        <SelectItem key={category} value={category}>
                                          {category.charAt(0).toUpperCase() + category.slice(1)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <Label>Message Content</Label>
                                <Textarea
                                  rows={4}
                                  value={editingTemplate.content}
                                  onChange={(e) => setEditingTemplate({ ...editingTemplate, content: e.target.value })}
                                />
                              </div>

                              <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setEditingTemplate(null)}>
                                  Cancel
                                </Button>
                                <Button onClick={updateTemplate}>Update Template</Button>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteTemplate(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium">Content:</p>
                      <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg mt-1">
                        {template.content}
                      </p>
                    </div>
                    {template.variables.length > 0 && (
                      <div>
                        <p className="text-sm font-medium">Variables:</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {template.variables.map((variable) => (
                            <Badge key={variable} variant="outline" className="text-xs">
                              {`{{${variable}}}`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MessageTemplates;