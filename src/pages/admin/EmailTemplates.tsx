import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import EmailLogsViewer from "@/components/admin/EmailLogsViewer";
import {
  Mail,
  Send,
  Save,
  Eye,
  Copy,
  Settings,
  User,
  Key,
  Bell,
  CreditCard,
  Home,
  CheckCircle,
  FileText,
} from "lucide-react";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  variables: string[];
  enabled: boolean;
  category: string;
}

const EmailTemplates = () => {
  const { toast } = useToast();
  
  // For now using local state until types are regenerated  
  const [templates, setTemplates] = useState<EmailTemplate[]>([
    // User Account Creation Templates
    {
      id: "user_welcome",
      name: "User Welcome Email",
      subject: "Welcome to ZIRA Property Management - Your {{user_role}} account is ready",
      content: "Professional React Email template for user welcome emails with role-specific content, login credentials, and feature highlights. This uses the UserWelcomeEmail React Email component.",
      variables: ["user_name", "user_email", "user_role", "temporary_password", "login_url", "property_name", "unit_number"],
      enabled: true,
      category: "authentication"
    },
    {
      id: "tenant_welcome",
      name: "Tenant Welcome Email",
      subject: "Welcome to Zira Homes - Your Tenant Portal Access",
      content: "Professional React Email template for tenant welcome emails with property details, login credentials, and portal features. This uses the enhanced tenant welcome email template.",
      variables: ["tenant_name", "property_name", "unit_number", "temporary_password", "login_url"],
      enabled: true,
      category: "authentication"
    },
    {
      id: "password_reset",
      name: "Password Reset",
      subject: "Reset your ZIRA Property password",
      content: "Password reset email using Supabase's built-in email template. SMS notification is also sent if enabled in communication preferences.",
      variables: ["user_name", "reset_link"],
      enabled: true,
      category: "authentication"
    },
    {
      id: "payment_reminder",
      name: "Payment Reminder",
      subject: "Rent Payment Due - {{property_name}}",
      content: "Professional React Email template for rent payment reminders with payment details, due dates, and online payment options. Uses PaymentReminderEmail component.",
      variables: ["tenant_name", "property_name", "unit_number", "amount_due", "due_date", "invoice_number", "payment_url"],
      enabled: true,
      category: "payments"
    }
  ]);
  
  const [loading, setLoading] = useState(false);

  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState<Partial<EmailTemplate>>({
    name: '',
    subject: '',
    content: '',
    category: 'authentication',
    variables: [],
    enabled: true
  });

  useEffect(() => {
    if (templates.length > 0 && !selectedTemplate) {
      setSelectedTemplate(templates[0]);
    }
  }, [templates, selectedTemplate]);

  // TODO: Re-enable database integration once types are updated
  // const fetchTemplates = async () => {
  //   try {
  //     const { data, error } = await supabase
  //       .from('email_templates')
  //       .select('*')
  //       .order('created_at', { ascending: false });

  //     if (error) throw error;
  //     setTemplates(data || []);
  //     if (data && data.length > 0) {
  //       setSelectedTemplate(data[0]);
  //     }
  //   } catch (error) {
  //     console.error('Error fetching templates:', error);
  //     toast({
  //       title: "Error",
  //       description: "Failed to load email templates.",
  //       variant: "destructive",
  //     });
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const handleSaveTemplate = () => {
    if (!selectedTemplate) return;

    setTemplates(prev => 
      prev.map(template => 
        template.id === selectedTemplate.id ? selectedTemplate : template
      )
    );
    
    toast({
      title: "Template Saved",
      description: "Email template has been updated successfully.",
    });
  };

  const [testEmailModalOpen, setTestEmailModalOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testingTemplate, setTestingTemplate] = useState<EmailTemplate | null>(null);

  const handleSendTest = () => {
    setTestEmailModalOpen(true);
  };

  const sendTestEmail = async () => {
    if (!testEmail) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    if (!selectedTemplate) {
      toast({
        title: "Error",
        description: "No template selected",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      const requestBody = {
        to: testEmail,
        subject: selectedTemplate.subject,
        content: selectedTemplate.content,
        template_name: selectedTemplate.name
      };

      console.log('Sending test email...', requestBody);

      // Call the email sending edge function
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: requestBody
      });

      console.log('Email send response:', { data, error });

      if (error) {
        console.error('Email send error:', error);
        const errAny: any = error as any;
        const ctxBody = errAny?.context?.body || {};
        const serverMsg = ctxBody?.error || ctxBody?.message || ctxBody?.details?.message;
        const msg = (serverMsg || errAny?.message || '').toString();

        let friendly = msg;
        if (/Invalid `from` field/i.test(msg) || /Invalid from address/i.test(msg)) {
          friendly = "Invalid From header. Ensure RESEND_FROM_ADDRESS is a verified domain email and has no quotes. Format: Zira Technologies <support@ziratech.com>.";
        } else if (/RESEND_API_KEY/i.test(msg)) {
          friendly = "Email service not configured. Please set RESEND_API_KEY in Supabase secrets.";
        } else if (/only send testing emails/i.test(msg)) {
          friendly = "Resend sandbox: verify your domain and use a domain email as From (e.g., support@ziratech.com).";
        }

        toast({
          title: "Email Send Failed",
          description: friendly || "Failed to send test email. Please check your email configuration.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Test Email Sent",
        description: `Test email sent to ${testEmail} using "${selectedTemplate.name}" template.`,
      });
      
      setTestEmailModalOpen(false);
      setTestEmail("");
    } catch (error: any) {
      console.error('Email send error:', error);
      toast({
        title: "Email Send Failed", 
        description: error.message || "Failed to send test email. Please ensure email service is configured properly.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = () => {
    if (!newTemplate.name || !newTemplate.subject || !newTemplate.content) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const template: EmailTemplate = {
      id: Date.now().toString(),
      name: newTemplate.name,
      subject: newTemplate.subject,
      content: newTemplate.content,
      category: newTemplate.category || 'authentication',
      variables: extractVariables((newTemplate.content || '') + ' ' + (newTemplate.subject || '')),
      enabled: newTemplate.enabled || true
    };

    setTemplates([...templates, template]);
    setSelectedTemplate(template);
    setIsCreating(false);
    setNewTemplate({
      name: '',
      subject: '',
      content: '',
      category: 'authentication',
      variables: [],
      enabled: true
    });

    toast({
      title: "Template Created",
      description: "New email template has been created successfully.",
    });
  };

  const extractVariables = (text: string): string[] => {
    const regex = /\{\{([^}]+)\}\}/g;
    const variables: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    return variables;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "authentication":
        return <Key className="h-4 w-4" />;
      case "payments":
        return <CreditCard className="h-4 w-4" />;
      case "maintenance":
        return <Settings className="h-4 w-4" />;
      case "announcements":
        return <Bell className="h-4 w-4" />;
      case "leases":
        return <Home className="h-4 w-4" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "authentication":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "payments":
        return "bg-green-100 text-green-800 border-green-200";
      case "maintenance":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "announcements":
        return "bg-red-100 text-red-800 border-red-200";
      case "leases":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const renderPreview = () => {
    if (!selectedTemplate) return { content: '', subject: '' };
    
    let content = selectedTemplate.content;
    let subject = selectedTemplate.subject;
    
    // Replace variables with sample data for preview
    const sampleData: Record<string, string> = {
      user_name: "John Doe",
      tenant_name: "John Doe",
      user_role: "Tenant",
      user_email: "john.doe@example.com",
      platform_name: "ZIRA Property Management",
      amount: "15,000",
      amount_due: "15,000",
      amount_paid: "15,000",
      currency: "KES",
      property_name: "Sunset Apartments",
      unit_number: "A-101",
      payment_date: "January 15, 2024",
      payment_method: "M-Pesa",
      payment_reference: "PAY-001234",
      transaction_id: "TXN123456",
      invoice_number: "INV-2024-001",
      due_date: "January 31, 2024",
      days_overdue: "5",
      temporary_password: "TempPass123!",
      request_title: "Leaking faucet in kitchen",
      status: "In Progress",
      priority: "Medium",
      update_date: "January 15, 2024",
      update_notes: "Plumber has been scheduled for tomorrow morning.",
      completion_notes: "Faucet has been repaired and tested",
      service_provider_name: "ABC Plumbing Services",
      announcement_title: "Pool Maintenance Notice",
      announcement_message: "The pool will be closed for maintenance from 9 AM to 5 PM tomorrow.",
      announcement_type: "maintenance",
      is_urgent: "false",
      expires_at: "February 15, 2024",
      expiry_date: "March 31, 2024",
      days_remaining: "45",
      reset_link: "https://portal.ziraproperty.com/reset-password?token=abc123",
      login_url: "https://portal.ziraproperty.com/login",
      payment_url: "https://portal.ziraproperty.com/payments"
    };

    selectedTemplate.variables.forEach(variable => {
      const regex = new RegExp(`{{${variable}}}`, 'g');
      content = content.replace(regex, sampleData[variable] || `[${variable}]`);
      subject = subject.replace(regex, sampleData[variable] || `[${variable}]`);
    });

    return { content, subject };
  };

  const templateStats = {
    total: templates.length,
    enabled: templates.filter(t => t.enabled).length,
    authentication: templates.filter(t => t.category === "authentication").length,
    payments: templates.filter(t => t.category === "payments").length,
    maintenance: templates.filter(t => t.category === "maintenance").length,
    announcements: templates.filter(t => t.category === "announcements").length,
  };

  return (
    <DashboardLayout>
      <div className="bg-tint-gray p-3 sm:p-4 lg:p-6 space-y-8">
        <Tabs defaultValue="templates" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="templates">Email Templates</TabsTrigger>
            <TabsTrigger value="logs">Email Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="templates">
            <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-primary">Email Templates</h1>
          <p className="text-muted-foreground">
            Manage system email templates and notifications
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <Card className="card-gradient-blue hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white">Total Templates</CardTitle>
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <Mail className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">{templateStats.total}</div>
              <p className="text-sm text-white/90 font-medium">Email templates</p>
            </CardContent>
          </Card>

          <Card className="card-gradient-green hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white">Active Templates</CardTitle>
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">{templateStats.enabled}</div>
              <p className="text-sm text-white/90 font-medium">Currently enabled</p>
            </CardContent>
          </Card>

          <Card className="card-gradient-orange hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white">Auth Templates</CardTitle>
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <Key className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">{templateStats.authentication}</div>
              <p className="text-sm text-white/90 font-medium">Login & signup</p>
            </CardContent>
          </Card>

          <Card className="card-gradient-purple hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white">Payment Templates</CardTitle>
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <CreditCard className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">{templateStats.payments}</div>
              <p className="text-sm text-white/90 font-medium">Payment related</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Template List */}
          <Card className="bg-card">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-primary">Email Templates</CardTitle>
                <Button
                  size="sm"
                  onClick={() => setIsCreating(true)}
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  New Template
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {loading ? (
                  <div className="text-center py-4 text-muted-foreground">Loading templates...</div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">No email templates found.</div>
                ) : (
                  templates.map((template) => (
                  <div
                    key={template.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedTemplate?.id === template.id ? "bg-primary/10 border-primary" : "hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-sm">{template.name}</h3>
                      <div className="flex items-center gap-2">
                        <Badge className={`${getCategoryColor(template.category)} border text-xs`}>
                          {getCategoryIcon(template.category)}
                          <span className="ml-1">{template.category}</span>
                        </Badge>
                        {template.enabled && (
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{template.subject}</p>
                  </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Template Editor */}
          <Card className="lg:col-span-2 bg-card">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-primary">
                  {isCreating ? "Create New Template" : previewMode ? "Preview" : "Edit"} - {isCreating ? "New Template" : selectedTemplate?.name}
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                  {isCreating && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCreating(false)}
                    >
                      Cancel
                    </Button>
                  )}
                  {!isCreating && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewMode(!previewMode)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        {previewMode ? "Edit" : "Preview"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleSendTest}>
                        <Send className="h-4 w-4 mr-2" />
                        Send Test
                      </Button>
                      
                      {/* Test Email Dialog */}
                      {testEmailModalOpen && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                          <div className="bg-white rounded-lg p-6 w-full max-w-md">
                            <h3 className="text-lg font-semibold mb-4">Send Test Email</h3>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="test-email">Email Address</Label>
                                <Input
                                  id="test-email"
                                  type="email"
                                  value={testEmail}
                                  onChange={(e) => setTestEmail(e.target.value)}
                                  placeholder="Enter email address"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={sendTestEmail} className="flex-1">
                                  <Send className="h-4 w-4 mr-2" />
                                  Send Test
                                </Button>
                                <Button variant="outline" onClick={() => setTestEmailModalOpen(false)}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isCreating ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="new-template-name">Template Name *</Label>
                    <Input
                      id="new-template-name"
                      value={newTemplate.name || ''}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter template name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-template-category">Category</Label>
                    <Select 
                      value={newTemplate.category} 
                      onValueChange={(value) => setNewTemplate(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="authentication">Authentication</SelectItem>
                        <SelectItem value="payments">Payments</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="leases">Leases</SelectItem>
                        <SelectItem value="notifications">Notifications</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-template-subject">Subject Line *</Label>
                    <Input
                      id="new-template-subject"
                      value={newTemplate.subject || ''}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, subject: e.target.value }))}
                      placeholder="Enter email subject"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="new-template-content">Email Content *</Label>
                    <Textarea
                      id="new-template-content"
                      value={newTemplate.content || ''}
                      onChange={(e) => setNewTemplate(prev => ({ ...prev, content: e.target.value }))}
                      rows={12}
                      className="font-mono text-sm"
                      placeholder="Enter email content. Use {{variable_name}} for dynamic content."
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={newTemplate.enabled || true}
                      onCheckedChange={(checked) => setNewTemplate(prev => ({ ...prev, enabled: checked }))}
                    />
                    <Label>Enable this template</Label>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsCreating(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCreateTemplate}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Create Template
                    </Button>
                  </div>
                </div>
              ) : previewMode ? (
                <div className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">Subject:</Label>
                        <p className="text-sm mt-1">{renderPreview().subject}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Content:</Label>
                        <div className="text-sm mt-1 whitespace-pre-wrap">
                          {renderPreview().content}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : selectedTemplate ? (
                <div className="space-y-6">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={selectedTemplate.enabled}
                      onCheckedChange={(checked) =>
                        setSelectedTemplate(prev => prev ? { ...prev, enabled: checked } : null)
                      }
                    />
                    <Label>Enable this template</Label>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-name">Template Name</Label>
                    <Input
                      id="template-name"
                      value={selectedTemplate.name}
                      onChange={(e) =>
                        setSelectedTemplate(prev => prev ? { ...prev, name: e.target.value } : null)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-subject">Subject Line</Label>
                    <Input
                      id="template-subject"
                      value={selectedTemplate.subject}
                      onChange={(e) =>
                        setSelectedTemplate(prev => prev ? { ...prev, subject: e.target.value } : null)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-content">Email Content</Label>
                    <Textarea
                      id="template-content"
                      value={selectedTemplate.content}
                      onChange={(e) =>
                        setSelectedTemplate(prev => prev ? { ...prev, content: e.target.value } : null)
                      }
                      rows={12}
                      className="font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Available Variables</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.variables.map((variable) => (
                        <Badge key={variable} variant="outline" className="text-xs">
                          <Copy 
                            className="h-3 w-3 mr-1 cursor-pointer" 
                            onClick={() => {
                              navigator.clipboard.writeText(`{{${variable}}}`);
                              toast({
                                title: "Copied",
                                description: `Variable {{${variable}}} copied to clipboard.`,
                              });
                            }}
                          />
                          {variable}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleSaveTemplate} className="bg-primary hover:bg-primary/90">
                      <Save className="h-4 w-4 mr-2" />
                      Save Template
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {loading ? "Loading templates..." : "No templates available. Create one to get started."}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <EmailLogsViewer />
          </TabsContent>
        </Tabs>

        {/* Test Email Modal */}
        <Dialog open={testEmailModalOpen} onOpenChange={setTestEmailModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                Send Test Email
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                {testingTemplate && `Send a test using "${testingTemplate.name}" template`}
              </p>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="test-email">Email Address</Label>
                <Input
                  id="test-email"
                  type="email"
                  placeholder="Enter email address to test"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  From: <span className="font-medium">Zira Technologies &lt;support@ziratech.com&gt;</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Note: In Resend sandbox, emails can only be sent to your account email until your domain is verified. After verification, tests can be sent to any address using the From above.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setTestEmailModalOpen(false);
                    setTestEmail("");
                    setTestingTemplate(null);
                  }}
                >
                  Cancel
                </Button>
                 <Button
                   onClick={sendTestEmail}
                   disabled={loading}
                   className="bg-primary hover:bg-primary/90"
                 >
                   <Send className="h-4 w-4 mr-2" />
                   {loading ? "Sending..." : "Send Test"}
                 </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default EmailTemplates;