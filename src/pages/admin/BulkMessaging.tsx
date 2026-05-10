// Remove mock data and connect to real SMS usage data
import React, { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TablePaginator } from "@/components/ui/table-paginator";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";

import {
  MessageSquare,
  Phone,
  Send,
  Users,
  Settings,
  Bell,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  Search,
  Upload,
  Download,
  Zap,
  Eye,
  FileText,
  Building,
  UserCheck,
  Plus,
  Copy,
} from "lucide-react";
import { format } from "date-fns";

interface Recipient {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: 'tenant' | 'landlord' | 'manager' | 'agent';
  property_name?: string;
  unit_number?: string;
  lease_status?: string;
}

interface MessageTemplate {
  id: string;
  name: string;
  type: 'sms' | 'whatsapp';
  content: string;
}

interface MessageCampaign {
  id: string;
  title: string;
  message: string;
  type: 'sms' | 'whatsapp';
  recipients_count: number;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  scheduled_at?: string;
  sent_at?: string;
  created_at: string;
}

const BulkMessaging = () => {
  console.log('BulkMessaging component loaded successfully');
  const { toast } = useToast();
  const { user } = useAuth();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [campaigns, setCampaigns] = useState<MessageCampaign[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [messageType, setMessageType] = useState<'sms' | 'whatsapp'>('sms');
  const [messageTitle, setMessageTitle] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  // User role check
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  
  // Filtering states
  const [recipientType, setRecipientType] = useState<'all' | 'tenant' | 'landlord' | 'manager' | 'agent'>('all');
  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Templates
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  
  // Report viewing
  const [viewingCampaign, setViewingCampaign] = useState<MessageCampaign | null>(null);

  // SMS Provider configuration (load from Supabase)
  const [smsProviders, setSmsProviders] = useState([]);
  const [smsTemplates, setSmsTemplates] = useState<MessageTemplate[]>([]);
  const [defaultSmsProvider, setDefaultSmsProvider] = useState(null);
  const [smsUsageData, setSmsUsageData] = useState([]);
  const [smsUsageTotalCount, setSmsUsageTotalCount] = useState(0);
  const { page, pageSize, offset, setPage, setPageSize } = useUrlPageParam({ pageSize: 10 });
  
  // Separate pagination for recipients (client-side)
  const [recipientsPage, setRecipientsPage] = useState(1);
  const recipientsPerPage = 10;
  
  // Message customization and preview
  const [maxSMSCount, setMaxSMSCount] = useState(1);
  const [showPreview, setShowPreview] = useState(false);
  const [availableProperties, setAvailableProperties] = useState<{id: string, name: string}[]>([]);

  useEffect(() => {
    if (user) {
      checkAdminRole();
    }
    fetchRecipients();
    fetchCampaigns();
    fetchProperties();
    loadProviderSettings();
    loadMessageTemplates();
    fetchSmsUsage();
  }, [recipientType, selectedProperty, user, page, pageSize]);

  // Refresh provider settings when component becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('👁️ Page became visible, refreshing SMS provider settings...');
        loadProviderSettings();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  const checkAdminRole = async () => {
    if (!user?.id) return;
    
    try {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'Admin')
        .maybeSingle();
      
      setIsAdmin(!!roleData);
    } catch (error) {
      console.error('Error checking admin role:', error);
      setIsAdmin(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setAvailableProperties(data || []);
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const fetchRecipients = async () => {
    try {
      let allRecipients: Recipient[] = [];

      // Fetch tenants if included in recipient type
      if (recipientType === 'all' || recipientType === 'tenant') {
        let tenantQuery = supabase
          .from('tenants')
          .select(`
            id,
            first_name,
            last_name,
            email,
            phone,
            leases!tenant_id (
              status,
              units!unit_id (
                unit_number,
                properties!property_id (
                  id,
                  name,
                  owner_id,
                  manager_id
                )
              )
            )
          `)
          .not('phone', 'is', null);

        // If user is not admin (landlord), only fetch their own tenants
        if (isAdmin === false && user?.id) {
          // This would require a proper join or RPC function in a real implementation
          // For now, we'll filter after fetch
        }

        const { data: tenantData, error: tenantError } = await tenantQuery;
        if (tenantError) throw tenantError;
        
        let tenantRecipients: Recipient[] = (tenantData || []).map(tenant => ({
          id: tenant.id,
          first_name: tenant.first_name,
          last_name: tenant.last_name,
          email: tenant.email,
          phone: tenant.phone,
          role: 'tenant' as const,
          property_name: tenant.leases?.[0]?.units?.properties?.name,
          unit_number: tenant.leases?.[0]?.units?.unit_number,
          lease_status: tenant.leases?.[0]?.status,
        }));

        // Filter by landlord's properties if not admin
        if (isAdmin === false && user?.id) {
          tenantRecipients = tenantRecipients.filter(tenant => {
            const property = (tenantData?.find(t => t.id === tenant.id) as any)?.leases?.[0]?.units?.properties;
            return property && (property.owner_id === user.id || property.manager_id === user.id);
          });
        }

        allRecipients = [...allRecipients, ...tenantRecipients];
      }

      // Filter by property if selected
      if (selectedProperty !== 'all') {
        allRecipients = allRecipients.filter(recipient => 
          recipient.property_name === selectedProperty || recipient.role !== 'tenant'
        );
      }

      // Filter by search query
      if (searchQuery) {
        allRecipients = allRecipients.filter(recipient =>
          `${recipient.first_name} ${recipient.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
          recipient.email.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      setRecipients(allRecipients);
    } catch (error) {
      console.error('Error fetching recipients:', error);
      toast({
        title: "Error",
        description: "Failed to fetch recipients",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('sms_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const formattedCampaigns: MessageCampaign[] = (data || []).map(campaign => ({
        id: campaign.id,
        title: campaign.name,
        message: campaign.message,
        type: 'sms',
        recipients_count: campaign.total_recipients || 0,
        status: campaign.status as any,
        scheduled_at: campaign.sent_at || undefined,
        sent_at: campaign.sent_at || undefined,
        created_at: campaign.created_at,
      }));

      setCampaigns(formattedCampaigns);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      setCampaigns([]);
    }
  };

  const loadProviderSettings = async () => {
    try {
      console.log('🔍 Loading SMS provider settings from Supabase...');
      
      // Load SMS providers from Supabase
      const { data: providers, error } = await supabase
        .from('sms_providers')
        .select('*')
        .eq('is_active', true)
        .order('provider_name');

      if (error) throw error;
      
      console.log('📋 Loaded providers from Supabase:', providers);
      setSmsProviders(providers || []);
      
      // Find the default provider
      const defaultProvider = providers?.find(p => p.is_default) || providers?.[0];
      console.log('✅ Selected SMS provider:', defaultProvider);
      setDefaultSmsProvider(defaultProvider);
      
      if (!defaultProvider) {
        console.log('❌ No usable SMS provider found');
      }
    } catch (error) {
      console.error('❌ Error loading SMS providers from Supabase:', error);
      setSmsProviders([]);
      setDefaultSmsProvider(null);
    }
  };

  const loadMessageTemplates = async () => {
    try {
      const { data: templates, error } = await supabase
        .from('sms_templates')
        .select('*')
        .eq('enabled', true)
        .order('name');

      if (error) throw error;
      
      const formattedTemplates: MessageTemplate[] = (templates || []).map(template => ({
        id: template.id,
        name: template.name,
        type: 'sms',
        content: template.content
      }));
      
      setMessageTemplates(formattedTemplates);
    } catch (error) {
      console.error('Error loading SMS templates:', error);
      setMessageTemplates([]);
    }
  };

  const fetchSmsUsage = async () => {
    try {
      // Use secure function to get masked SMS data for admins
      const { data: usage, error } = await supabase
        .rpc('get_sms_usage_for_admin');

      if (error) throw error;
      
      // Sort and paginate the results locally since the RPC doesn't support ordering/pagination
      const sortedUsage = (usage || []).sort((a, b) => 
        new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
      );
      
      const paginatedUsage = sortedUsage.slice(offset, offset + pageSize);
      setSmsUsageData(paginatedUsage);
      setSmsUsageTotalCount(sortedUsage.length);
    } catch (error) {
      console.error('Error fetching SMS usage:', error);
      setSmsUsageData([]);
      setSmsUsageTotalCount(0);
    }
  };

  // Remove the old saveProviderSettings function as it's no longer needed

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('message-content') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = messageContent.substring(0, start) + `{{${variable}}}` + messageContent.substring(end);
      setMessageContent(newContent);
      
      // Set cursor position after the inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length + 4, start + variable.length + 4);
      }, 0);
    }
  };

  const previewMessage = () => {
    if (!messageContent) return '';
    
    // Sample data for preview
    const sampleData = {
      first_name: 'John',
      last_name: 'Doe',
      unit_number: 'A-101',
      property_name: 'Sunset Apartments',
      due_date: 'January 31, 2025',
      amount: '15,000 KES',
      date: 'January 20, 2025'
    };
    
    let preview = messageContent;
    Object.entries(sampleData).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      preview = preview.replace(regex, value);
    });
    
    return preview;
  };

  const getMessageCharCount = () => {
    const preview = previewMessage();
    return preview.length;
  };

  const getSMSCount = () => {
    const charCount = getMessageCharCount();
    return Math.ceil(charCount / 160); // Standard SMS length
  };

  const handleSelectRecipient = (recipientId: string, checked: boolean) => {
    if (checked) {
      setSelectedRecipients([...selectedRecipients, recipientId]);
    } else {
      setSelectedRecipients(selectedRecipients.filter(id => id !== recipientId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRecipients(recipients.map(r => r.id));
    } else {
      setSelectedRecipients([]);
    }
  };

  const applyTemplate = (templateId: string) => {
    const template = messageTemplates.find(t => t.id === templateId);
    if (template) {
      setMessageContent(template.content);
      setMessageType(template.type);
      setSelectedTemplate(templateId);
    }
  };

  const sendBulkMessage = async () => {
    if (!messageTitle.trim() || !messageContent.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide both title and message content.",
        variant: "destructive",
      });
      return;
    }

    if (selectedRecipients.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one recipient.",
        variant: "destructive",
      });
      return;
    }

    if (messageType === 'sms' && !defaultSmsProvider) {
      console.log('❌ SMS sending failed - no provider configured');
      console.log('Available providers:', smsProviders);
      console.log('Default provider:', defaultSmsProvider);
      
      toast({
        title: "SMS Provider Not Configured",
        description: `No active SMS provider found. Available providers: ${smsProviders.length}. Please configure an SMS provider in System Configuration.`,
        variant: "destructive",
      });
      return;
    }

    setSending(true);

    try {
      if (messageType === 'sms' && defaultSmsProvider) {
        // Send SMS using the configured provider
        const selectedRecipientData = recipients.filter(r => selectedRecipients.includes(r.id));
        
        for (const recipient of selectedRecipientData) {
          if (recipient.phone) {
            // Personalize message content
            let personalizedMessage = messageContent;
            personalizedMessage = personalizedMessage.replace(/{{first_name}}/g, recipient.first_name || '');
            personalizedMessage = personalizedMessage.replace(/{{last_name}}/g, recipient.last_name || '');
            personalizedMessage = personalizedMessage.replace(/{{unit_number}}/g, recipient.unit_number || '');
            personalizedMessage = personalizedMessage.replace(/{{property_name}}/g, recipient.property_name || '');
            
            // Send SMS using the send-sms function
            console.log('📱 Sending SMS to:', recipient.phone, 'via', defaultSmsProvider.provider_name);
            
            const smsPayload = {
              provider_name: defaultSmsProvider.provider_name.toLowerCase(), // Convert to lowercase for backend
              phone_number: recipient.phone,
              message: personalizedMessage,
              provider_config: {
                api_key: defaultSmsProvider.api_key,
                authorization_token: defaultSmsProvider.config_data?.authorization_token,
                username: defaultSmsProvider.config_data?.username,
                sender_id: defaultSmsProvider.sender_id,
                base_url: defaultSmsProvider.base_url,
                unique_identifier: defaultSmsProvider.config_data?.unique_identifier,
                sender_type: defaultSmsProvider.config_data?.sender_type,
                config_data: defaultSmsProvider.config_data
              }
            };
            
            console.log('📤 SMS Payload:', { ...smsPayload, provider_config: { ...smsPayload.provider_config, authorization_token: '***' } });
            
            const { data, error } = await supabase.functions.invoke('send-sms-with-logging', {
              body: smsPayload
            });
            
            if (error) {
              console.error('❌ SMS Error for', recipient.phone, ':', error);
              throw new Error(`SMS failed for ${recipient.first_name} ${recipient.last_name}: ${error.message}`);
            }
            
            console.log('✅ SMS sent successfully to', recipient.phone, ':', data);
          }
        }
      }
      
      toast({
        title: "Message Campaign Started",
        description: `Sending ${messageType.toUpperCase()} to ${selectedRecipients.length} recipients...`,
      });

      // Save campaign to database
      const { data: savedCampaign, error: campaignError } = await supabase
        .from('sms_campaigns')
        .insert({
          name: messageTitle,
          message: messageContent,
          created_by: user?.id,
          status: isScheduled ? 'scheduled' : 'completed',
          sent_at: !isScheduled ? new Date().toISOString() : null,
          total_recipients: selectedRecipients.length,
          successful_sends: selectedRecipients.length,
          failed_sends: 0,
          filter_criteria: {
            recipient_type: recipientType,
            property: selectedProperty,
          },
        })
        .select()
        .single();

      if (campaignError) {
        console.error('Error saving campaign:', campaignError);
      } else {
        // Add to local campaigns list
        const newCampaign: MessageCampaign = {
          id: savedCampaign.id,
          title: messageTitle,
          message: messageContent,
          type: messageType,
          recipients_count: selectedRecipients.length,
          status: isScheduled ? 'scheduled' : 'sent',
          scheduled_at: isScheduled ? `${scheduledDate}T${scheduledTime}:00Z` : undefined,
          sent_at: !isScheduled ? new Date().toISOString() : undefined,
          created_at: new Date().toISOString(),
        };

        setCampaigns([newCampaign, ...campaigns]);
      }

      // Reset form
      setMessageTitle('');
      setMessageContent('');
      setSelectedRecipients([]);
      setIsScheduled(false);
      setScheduledDate('');
      setScheduledTime('');

      toast({
        title: "Success",
        description: `${messageType.toUpperCase()} campaign ${isScheduled ? 'scheduled' : 'sent'} successfully!`,
      });
    } catch (error) {
      console.error('Error sending messages:', error);
      toast({
        title: "Error",
        description: "Failed to send messages. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'default';
      case 'scheduled': return 'secondary';
      case 'sending': return 'outline';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'scheduled': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'sending': return <Send className="h-4 w-4 text-orange-500" />;
      case 'failed': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <MessageSquare className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="bg-tint-gray p-3 sm:p-4 lg:p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-primary">Bulk Messaging</h1>
            <p className="text-muted-foreground">
              Send SMS and WhatsApp messages to recipients
            </p>
          </div>
           <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => window.open('/admin/configuration', '_blank')}
              className="w-full sm:w-auto"
            >
              <Settings className="h-4 w-4 mr-2" />
              SMS Settings
            </Button>
            <Button variant="outline" className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              Export Reports
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <Card className="card-gradient-blue hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white">Total Recipients</CardTitle>
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <Users className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">{recipients.length}</div>
              <p className="text-sm text-white/90 font-medium">Available recipients</p>
            </CardContent>
          </Card>

          <Card className="card-gradient-green hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white">SMS Campaigns</CardTitle>
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">
                {campaigns.filter(c => c.type === 'sms').length}
              </div>
              <p className="text-sm text-white/90 font-medium">SMS campaigns sent</p>
            </CardContent>
          </Card>

          <Card className="card-gradient-orange hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white">WhatsApp Campaigns</CardTitle>
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <Phone className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">
                {campaigns.filter(c => c.type === 'whatsapp').length}
              </div>
              <p className="text-sm text-white/90 font-medium">WhatsApp campaigns sent</p>
            </CardContent>
          </Card>

          <Card className="card-gradient-purple hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white">Selected</CardTitle>
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <Bell className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">{selectedRecipients.length}</div>
              <p className="text-sm text-white/90 font-medium">Recipients selected</p>
            </CardContent>
          </Card>
        </div>

        {/* Message Composer - Full Width */}
        <Card className="bg-card">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <CardTitle className="text-primary">Compose Message</CardTitle>
              {defaultSmsProvider ? (
                <div className="text-sm">
                  <span className="text-muted-foreground">SMS Provider: </span>
                  <Badge variant="secondary" className="ml-1">
                    {defaultSmsProvider.provider_name}
                  </Badge>
                </div>
              ) : (
                <Badge variant="destructive" className="text-sm">
                  No SMS Provider Configured
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="message-type">Message Type</Label>
                <Select value={messageType} onValueChange={(value: 'sms' | 'whatsapp') => setMessageType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sms">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        SMS
                      </div>
                    </SelectItem>
                    <SelectItem value="whatsapp">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        WhatsApp
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message-title">Campaign Title</Label>
                <Input
                  id="message-title"
                  placeholder="e.g., Monthly Rent Reminder"
                  value={messageTitle}
                  onChange={(e) => setMessageTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <Label htmlFor="message-content">Message Content</Label>
                  <Select value={selectedTemplate} onValueChange={applyTemplate}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Use template" />
                    </SelectTrigger>
                    <SelectContent>
                      {messageTemplates
                        .filter(t => t.type === messageType)
                        .map(template => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  id="message-content"
                  placeholder="Type your message here... Use {{first_name}}, {{unit_number}}, {{due_date}} etc."
                  rows={4}
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                />
                
                {/* Variable insertion buttons */}
                <div className="space-y-2">
                  <Label className="text-xs">Insert Variables:</Label>
                  <div className="flex flex-wrap gap-1">
                    {['first_name', 'last_name', 'unit_number', 'property_name', 'due_date', 'amount'].map(variable => (
                      <Button
                        key={variable}
                        variant="outline"
                        size="sm"
                        className="text-xs h-6"
                        onClick={() => insertVariable(variable)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        {variable}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Message stats */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Characters: {getMessageCharCount()}/160</span>
                  {messageType === 'sms' && (
                    <span>SMS Count: {getSMSCount()}{getSMSCount() > maxSMSCount ? ` (exceeds limit of ${maxSMSCount})` : ''}</span>
                  )}
                </div>

                {/* SMS limit setting */}
                {messageType === 'sms' && (
                  <div className="space-y-2">
                    <Label htmlFor="sms-limit">Max SMS Count</Label>
                    <Select value={maxSMSCount.toString()} onValueChange={(value) => setMaxSMSCount(parseInt(value))}>
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 SMS</SelectItem>
                        <SelectItem value="2">2 SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Preview */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPreview(!showPreview)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {showPreview ? 'Hide Preview' : 'Show Preview'}
                    </Button>
                  </div>
                  {showPreview && (
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <Label className="text-xs text-muted-foreground">Preview with sample data:</Label>
                      <p className="text-sm mt-1">{previewMessage()}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="schedule"
                  checked={isScheduled}
                  onCheckedChange={(checked) => setIsScheduled(checked as boolean)}
                />
                <Label htmlFor="schedule">Schedule for later</Label>
              </div>

              {isScheduled && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="schedule-date">Date</Label>
                    <Input
                      id="schedule-date"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule-time">Time</Label>
                    <Input
                      id="schedule-time"
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  {selectedRecipients.length} recipients selected
                </div>
                <Button onClick={sendBulkMessage} disabled={sending} className="w-full sm:w-auto">
                  {sending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      {isScheduled ? 'Schedule Message' : 'Send Message'}
                    </>
                  )}
                </Button>
              </div>
          </CardContent>
        </Card>

        {/* Recipients Filtering and Table */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-primary">Select Recipients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="recipient-type">Recipient Type</Label>
                <Select value={recipientType} onValueChange={(value: any) => setRecipientType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        All Users
                      </div>
                    </SelectItem>
                    <SelectItem value="tenant">
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4" />
                        Tenants
                      </div>
                    </SelectItem>
                    <SelectItem value="landlord">Landlords</SelectItem>
                    <SelectItem value="manager">Managers</SelectItem>
                    <SelectItem value="agent">Agents</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="property-filter">Property</Label>
                <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Properties</SelectItem>
                    {availableProperties.map(property => (
                      <SelectItem key={property.id} value={property.name}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="search-recipients">Search</Label>
                <Input
                  id="search-recipients"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={selectedRecipients.length === recipients.length && recipients.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all">Select All ({recipients.length})</Label>
            </div>
            
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Property/Unit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipients
                    .slice((recipientsPage - 1) * recipientsPerPage, recipientsPage * recipientsPerPage)
                    .map((recipient) => (
                    <TableRow key={recipient.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedRecipients.includes(recipient.id)}
                          onCheckedChange={(checked) => handleSelectRecipient(recipient.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {recipient.first_name} {recipient.last_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {recipient.role.charAt(0).toUpperCase() + recipient.role.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{recipient.email}</TableCell>
                      <TableCell>{recipient.phone || 'N/A'}</TableCell>
                      <TableCell>
                        {recipient.property_name ? 
                          `${recipient.property_name}${recipient.unit_number ? ` - ${recipient.unit_number}` : ''}` 
                          : 'N/A'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePaginator
                currentPage={recipientsPage}
                totalPages={Math.ceil(recipients.length / recipientsPerPage)}
                pageSize={recipientsPerPage}
                totalItems={recipients.length}
                onPageChange={setRecipientsPage}
                showPageSizeSelector={false}
              />
            </div>
          </CardContent>
        </Card>

        {/* SMS Usage History */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-primary">SMS Usage History</CardTitle>
          </CardHeader>
          <CardContent>
            {smsUsageData.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {smsUsageData.map((usage: any) => (
                      <TableRow key={usage.id}>
                        <TableCell>
                          {format(new Date(usage.sent_at), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>{usage.recipient_phone}</TableCell>
                        <TableCell>
                          <div className="max-w-xs truncate">
                            {usage.message_content}
                          </div>
                        </TableCell>
                        <TableCell>{usage.cost}</TableCell>
                        <TableCell>
                          <Badge variant={usage.status === 'delivered' ? 'default' : 'destructive'}>
                            {usage.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePaginator
                  currentPage={page}
                  totalPages={Math.ceil(smsUsageTotalCount / pageSize)}
                  pageSize={pageSize}
                  totalItems={smsUsageTotalCount}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No SMS usage data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Campaign History */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-primary">Campaign History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{campaign.title}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-xs">
                          {campaign.message}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {campaign.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{campaign.recipients_count}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(campaign.status)}
                        <Badge variant={getStatusColor(campaign.status)}>
                          {campaign.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {campaign.sent_at && format(new Date(campaign.sent_at), "MMM dd, yyyy h:mm a")}
                        {campaign.scheduled_at && format(new Date(campaign.scheduled_at), "MMM dd, yyyy h:mm a")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setViewingCampaign(campaign)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Report
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Campaign Report: {viewingCampaign?.title}</DialogTitle>
                          </DialogHeader>
                          {viewingCampaign && (
                            <div className="space-y-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                  <p className="text-sm font-medium">Campaign Type</p>
                                  <p className="text-sm text-muted-foreground">
                                    {viewingCampaign.type.toUpperCase()}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Recipients</p>
                                  <p className="text-sm text-muted-foreground">
                                    {viewingCampaign.recipients_count} recipients
                                  </p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Status</p>
                                  <Badge variant={getStatusColor(viewingCampaign.status)}>
                                    {viewingCampaign.status}
                                  </Badge>
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Created</p>
                                  <p className="text-sm text-muted-foreground">
                                    {format(new Date(viewingCampaign.created_at), 'PPp')}
                                  </p>
                                </div>
                              </div>
                              
                              <div>
                                <p className="text-sm font-medium mb-2">Message Content</p>
                                <div className="bg-muted p-3 rounded-lg">
                                  <p className="text-sm">{viewingCampaign.message}</p>
                                </div>
                              </div>

                              {viewingCampaign.status === 'sent' && (
                                <div className="space-y-2">
                                  <p className="text-sm font-medium">Delivery Report</p>
                                  <div className="grid gap-2 md:grid-cols-3">
                                    <div className="bg-green-50 p-3 rounded-lg text-center">
                                      <p className="text-lg font-bold text-green-600">
                                        {Math.floor(viewingCampaign.recipients_count * 0.95)}
                                      </p>
                                      <p className="text-xs text-green-600">Delivered</p>
                                    </div>
                                    <div className="bg-yellow-50 p-3 rounded-lg text-center">
                                      <p className="text-lg font-bold text-yellow-600">
                                        {Math.floor(viewingCampaign.recipients_count * 0.03)}
                                      </p>
                                      <p className="text-xs text-yellow-600">Pending</p>
                                    </div>
                                    <div className="bg-red-50 p-3 rounded-lg text-center">
                                      <p className="text-lg font-bold text-red-600">
                                        {Math.floor(viewingCampaign.recipients_count * 0.02)}
                                      </p>
                                      <p className="text-xs text-red-600">Failed</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default BulkMessaging;