import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Settings, MessageSquare, Plus, Edit, Trash2, Send, Phone, Globe } from "lucide-react";

interface SMSProvider {
  id: string;
  provider_name: string;
  api_key?: string;
  api_secret?: string;
  authorization_token?: string;
  username?: string;
  sender_id?: string;
  base_url?: string;
  unique_identifier?: string;
  sender_type?: string;
  country_code?: string;
  is_active: boolean;
  is_default: boolean;
  config_data: any;
}

const SMSProviderConfig = () => {
  const { toast } = useToast();
  const [providers, setProviders] = useState<SMSProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [testMessage, setTestMessage] = useState("Hello! This is a test message from Zira Homes.");
  const [testPhone, setTestPhone] = useState("");
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [editingProvider, setEditingProvider] = useState<SMSProvider | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [countries] = useState([
    { code: 'KE', name: 'Kenya' },
    { code: 'UG', name: 'Uganda' },
    { code: 'TZ', name: 'Tanzania' },
    { code: 'RW', name: 'Rwanda' },
    { code: 'BI', name: 'Burundi' },
    { code: 'ET', name: 'Ethiopia' },
    { code: 'SO', name: 'Somalia' },
    { code: 'SS', name: 'South Sudan' },
    { code: 'ER', name: 'Eritrea' },
    { code: 'DJ', name: 'Djibouti' },
    { code: 'NG', name: 'Nigeria' },
    { code: 'GH', name: 'Ghana' },
    { code: 'ZA', name: 'South Africa' },
    { code: 'ZW', name: 'Zimbabwe' },
    { code: 'ZM', name: 'Zambia' },
    { code: 'MW', name: 'Malawi' },
    { code: 'MZ', name: 'Mozambique' },
    { code: 'BW', name: 'Botswana' },
    { code: 'NA', name: 'Namibia' },
    { code: 'AO', name: 'Angola' },
    { code: 'CM', name: 'Cameroon' },
    { code: 'CD', name: 'Democratic Republic of Congo' },
    { code: 'CG', name: 'Republic of Congo' },
    { code: 'CF', name: 'Central African Republic' },
    { code: 'TD', name: 'Chad' },
    { code: 'GA', name: 'Gabon' },
    { code: 'GQ', name: 'Equatorial Guinea' },
    { code: 'ST', name: 'São Tomé and Príncipe' },
    { code: 'MG', name: 'Madagascar' },
    { code: 'MU', name: 'Mauritius' },
    { code: 'SC', name: 'Seychelles' },
    { code: 'KM', name: 'Comoros' },
  ]);

  // New provider form
  const [newProvider, setNewProvider] = useState({
    provider_name: '',
    api_key: '',
    api_secret: '',
    sender_id: '',
    base_url: '',
    username: '', // For Africa's Talking
    authorization_token: '', // For InHouse SMS
    unique_identifier: '', // For InHouse SMS
    sender_type: '10', // For InHouse SMS
    additional_config: '',
    country_code: 'KE'
  });

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      
      // Fetch from database first
      const { data: dbProviders, error } = await supabase
        .from('sms_providers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database error:', error);
        // Fallback to localStorage
        const savedProviders = localStorage.getItem('sms_providers');
        if (savedProviders) {
          setProviders(JSON.parse(savedProviders));
        } else {
          // Ultimate fallback to default data
          const defaultProviders: SMSProvider[] = [
            {
              id: '1',
              provider_name: 'InHouse SMS',
              authorization_token: 'f22b2aa230b02b428a71023c7eb7f7bb9d440f38',
              sender_id: 'ZIRA TECH',
              base_url: 'http://68.183.101.252:803/bulk_api/',
              is_active: true,
              is_default: true,
              config_data: { 
                username: 'ZIRA TECH',
                unique_identifier: '77',
                sender_type: '10',
                authorization_token: 'f22b2aa230b02b428a71023c7eb7f7bb9d440f38'
              }
            }
          ];
          setProviders(defaultProviders);
        }
      } else {
        setProviders((dbProviders || []) as SMSProvider[]);
      }
    } catch (error) {
      console.error('Error fetching SMS providers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch SMS provider configurations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveProvider = async () => {
    try {
      if (!newProvider.provider_name) {
        toast({
          title: "Validation Error",
          description: "Provider name is required",
          variant: "destructive",
        });
        return;
      }

      const config_data: Record<string, any> = {};
      if (newProvider.username) config_data.username = newProvider.username;
      if (newProvider.authorization_token) config_data.authorization_token = newProvider.authorization_token;
      if (newProvider.unique_identifier) config_data.unique_identifier = newProvider.unique_identifier;
      if (newProvider.sender_type) config_data.sender_type = newProvider.sender_type;
      if (newProvider.api_key) config_data.api_key = newProvider.api_key;
      if (newProvider.api_secret) config_data.api_secret = newProvider.api_secret;
      if (newProvider.country_code) config_data.country_code = newProvider.country_code;
      if (newProvider.additional_config) {
        try {
          Object.assign(config_data, JSON.parse(newProvider.additional_config));
        } catch (e) {
          toast({
            title: "Invalid JSON",
            description: "Additional configuration must be valid JSON",
            variant: "destructive",
          });
          return;
        }
      }

      const providerData = {
        provider_name: newProvider.provider_name,
        sender_id: newProvider.sender_id || null,
        base_url: newProvider.base_url || null,
        is_active: editingProvider ? editingProvider.is_active : (providers.length === 0),
        is_default: editingProvider ? editingProvider.is_default : (providers.length === 0),
        config_data
      };

      if (editingProvider) {
        // Update existing provider
        const { error } = await supabase
          .from('sms_providers')
          .update(providerData)
          .eq('id', editingProvider.id);

        if (error) throw error;
      } else {
        // Insert new provider
        const { error } = await supabase
          .from('sms_providers')
          .insert([providerData]);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `Provider ${editingProvider ? 'updated' : 'added'} successfully`,
      });

      resetForm();
      setIsDialogOpen(false);
      fetchProviders(); // Refresh the list
    } catch (error: any) {
      console.error('Error saving provider:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save provider configuration",
        variant: "destructive",
      });
    }
  };

  const toggleProvider = async (providerId: string, field: 'is_active' | 'is_default') => {
    try {
      const provider = providers.find(p => p.id === providerId);
      if (!provider) return;

      let updateData: any = {};
      
      if (field === 'is_default' && !provider.is_default) {
        // Set as default and ensure it's active
        updateData = { is_default: true, is_active: true };
        
        // First, remove default from all other providers
        await supabase
          .from('sms_providers')
          .update({ is_default: false })
          .neq('id', providerId);
      } else if (field === 'is_active') {
        updateData = { is_active: !provider.is_active };
      } else {
        updateData = { [field]: !provider[field] };
      }

      // Update the specific provider
      const { error } = await supabase
        .from('sms_providers')
        .update(updateData)
        .eq('id', providerId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Provider configuration updated",
      });

      fetchProviders(); // Refresh the list
    } catch (error: any) {
      console.error('Error updating provider:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update provider",
        variant: "destructive",
      });
    }
  };

  const deleteProvider = async (providerId: string) => {
    try {
      const { error } = await supabase
        .from('sms_providers')
        .delete()
        .eq('id', providerId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Provider deleted successfully",
      });

      fetchProviders(); // Refresh the list
    } catch (error: any) {
      console.error('Error deleting provider:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete provider",
        variant: "destructive",
      });
    }
  };

  const testSMS = async (providerId: string) => {
    if (!testMessage || !testPhone) {
      toast({
        title: "Validation Error",
        description: "Please enter both message and phone number",
        variant: "destructive",
      });
      return;
    }

    const provider = providers.find(p => p.id === providerId);
    if (!provider) {
      toast({
        title: "Error",
        description: "Provider not found",
        variant: "destructive",
      });
      return;
    }

    setTestingProvider(providerId);
    
    try {
      // Call the actual SMS edge function
      const { data, error } = await supabase.functions.invoke('send-sms-with-logging', {
        body: {
          provider_name: provider.provider_name.toLowerCase(), // Convert to lowercase for backend
          phone_number: testPhone,
          message: testMessage,
          provider_config: {
            api_key: provider.api_key,
            authorization_token: provider.config_data?.authorization_token,
            username: provider.config_data?.username,
            sender_id: provider.sender_id,
            base_url: provider.base_url,
            unique_identifier: provider.config_data?.unique_identifier,
            sender_type: provider.config_data?.sender_type,
            config_data: provider.config_data
          }
        }
      });

      if (error) {
        console.error('SMS sending error:', error);
        throw new Error(error.message || 'Failed to send SMS');
      }

      if (data?.success) {
        toast({
          title: "Test SMS Sent",
          description: `Test message sent to ${testPhone} via ${provider.provider_name}`,
        });
      } else {
        throw new Error(data?.error || 'Unknown error occurred');
      }
    } catch (error: unknown) {
      console.error('SMS test failed:', error);
      toast({
        title: "Test Failed",
        description: error instanceof Error ? error.message : "Failed to send test SMS",
        variant: "destructive",
      });
    } finally {
      setTestingProvider(null);
    }
  };

  const resetForm = () => {
    setNewProvider({
      provider_name: '',
      api_key: '',
      api_secret: '',
      sender_id: '',
      base_url: '',
      username: '',
      authorization_token: '',
      unique_identifier: '',
      sender_type: '10',
      additional_config: '',
      country_code: 'KE'
    });
    setEditingProvider(null);
  };

  const editProvider = (provider: SMSProvider) => {
    setEditingProvider(provider);
    setNewProvider({
      provider_name: provider.provider_name,
      api_key: provider.config_data?.api_key || '',
      api_secret: provider.config_data?.api_secret || '',
      sender_id: provider.sender_id || '',
      base_url: provider.base_url || '',
      username: provider.config_data?.username || '',
      authorization_token: provider.config_data?.authorization_token || '',
      unique_identifier: provider.config_data?.unique_identifier || '',
      sender_type: provider.config_data?.sender_type || '10',
      additional_config: JSON.stringify(provider.config_data || {}, null, 2),
      country_code: provider.config_data?.country_code || 'KE'
    });
    setIsDialogOpen(true);
  };

  const getProviderIcon = (name: string) => {
    if (name.toLowerCase().includes('twilio')) return <Phone className="h-5 w-5" />;
    if (name.toLowerCase().includes('africa')) return <Globe className="h-5 w-5" />;
    return <MessageSquare className="h-5 w-5" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading SMS providers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-primary">SMS Provider Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Configure SMS providers for bulk messaging and notifications
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Provider
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProvider ? 'Edit' : 'Add'} SMS Provider</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Basic Configuration */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground border-b pb-2">Basic Configuration</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="provider_name">Provider Name *</Label>
                    <Select 
                      value={newProvider.provider_name} 
                      onValueChange={(value) => setNewProvider(prev => ({ ...prev, provider_name: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Twilio">Twilio</SelectItem>
                        <SelectItem value="Africa's Talking">Africa's Talking</SelectItem>
                        <SelectItem value="InHouse SMS">InHouse SMS</SelectItem>
                        <SelectItem value="Custom">Custom Provider</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="country_code">Country Code</Label>
                    <Select 
                      value={newProvider.country_code} 
                      onValueChange={(value) => setNewProvider(prev => ({ ...prev, country_code: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name} ({country.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sender_id">Sender ID</Label>
                    <Input
                      id="sender_id"
                      value={newProvider.sender_id}
                      onChange={(e) => setNewProvider(prev => ({ ...prev, sender_id: e.target.value }))}
                      placeholder="Sender ID or phone number"
                    />
                  </div>

                  <div>
                    <Label htmlFor="base_url">Base URL</Label>
                    <Input
                      id="base_url"
                      value={newProvider.base_url}
                      onChange={(e) => setNewProvider(prev => ({ ...prev, base_url: e.target.value }))}
                      placeholder="API base URL"
                    />
                  </div>
                </div>
              </div>

              {/* Authentication Configuration */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground border-b pb-2">Authentication</h4>
                
                <div>
                  <Label htmlFor="api_key">API Key</Label>
                  <Input
                    id="api_key"
                    value={newProvider.api_key}
                    onChange={(e) => setNewProvider(prev => ({ ...prev, api_key: e.target.value }))}
                    placeholder="Enter API key"
                  />
                </div>

                {newProvider.provider_name === 'Twilio' && (
                  <div>
                    <Label htmlFor="api_secret">Auth Token</Label>
                    <Input
                      id="api_secret"
                      type="password"
                      value={newProvider.api_secret}
                      onChange={(e) => setNewProvider(prev => ({ ...prev, api_secret: e.target.value }))}
                      placeholder="Enter auth token"
                    />
                  </div>
                )}
              </div>

              {/* Provider-Specific Configuration */}
              {newProvider.provider_name === "Africa's Talking" && (
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground border-b pb-2">Africa's Talking Settings</h4>
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={newProvider.username}
                      onChange={(e) => setNewProvider(prev => ({ ...prev, username: e.target.value }))}
                      placeholder="Africa's Talking username"
                    />
                  </div>
                </div>
              )}

              {newProvider.provider_name === "InHouse SMS" && (
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground border-b pb-2">InHouse SMS Settings</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="username">Username</Label>
                      <Input
                        id="username"
                        value={newProvider.username}
                        onChange={(e) => setNewProvider(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="ZIRA TECH"
                      />
                    </div>
                    <div>
                      <Label htmlFor="unique_identifier">Unique Identifier</Label>
                      <Input
                        id="unique_identifier"
                        value={newProvider.unique_identifier}
                        onChange={(e) => setNewProvider(prev => ({ ...prev, unique_identifier: e.target.value }))}
                        placeholder="77"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="authorization_token">Authorization Token</Label>
                    <Input
                      id="authorization_token"
                      type="password"
                      value={newProvider.authorization_token}
                      onChange={(e) => setNewProvider(prev => ({ ...prev, authorization_token: e.target.value }))}
                      placeholder="f22b2aa230b02b428a71023c7eb7f7bb9d440f38"
                    />
                  </div>

                  <div>
                    <Label htmlFor="sender_type">Sender Type</Label>
                    <Select 
                      value={newProvider.sender_type} 
                      onValueChange={(value) => setNewProvider(prev => ({ ...prev, sender_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select sender type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">Premium (10)</SelectItem>
                        <SelectItem value="5">Standard (5)</SelectItem>
                        <SelectItem value="1">Basic (1)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Advanced Configuration */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground border-b pb-2">Advanced Configuration</h4>
                <div>
                  <Label htmlFor="additional_config">Additional Config (JSON)</Label>
                  <Textarea
                    id="additional_config"
                    value={newProvider.additional_config}
                    onChange={(e) => setNewProvider(prev => ({ ...prev, additional_config: e.target.value }))}
                    placeholder='{"custom_field": "value"}'
                    rows={4}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button onClick={saveProvider} className="flex-1 bg-primary hover:bg-primary/90">
                  {editingProvider ? 'Update' : 'Add'} Provider
                </Button>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Provider Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {providers.map((provider) => (
          <Card key={provider.id} className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    {getProviderIcon(provider.provider_name)}
                  </div>
                  <div>
                    <CardTitle className="text-base">{provider.provider_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {provider.sender_id || 'No sender ID'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {provider.is_default && (
                    <Badge className="bg-primary text-primary-foreground">Default</Badge>
                  )}
                  {provider.is_active && (
                    <Badge className="bg-success text-success-foreground">Active</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Active</span>
                  <Switch
                    checked={provider.is_active}
                    onCheckedChange={() => toggleProvider(provider.id, 'is_active')}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Default</span>
                  <Switch
                    checked={provider.is_default}
                    onCheckedChange={() => toggleProvider(provider.id, 'is_default')}
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => editProvider(provider)}
                  className="flex-1"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteProvider(provider.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Test SMS Section */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-primary">Test SMS</CardTitle>
          <p className="text-sm text-muted-foreground">
            Send a test SMS using any of your configured providers
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="test_phone">Phone Number (with country code)</Label>
              <Input
                id="test_phone"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+1234567890"
              />
            </div>
            <div>
              <Label htmlFor="test_message">Test Message</Label>
              <Textarea
                id="test_message"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Enter your test message..."
                rows={3}
              />
            </div>
          </div>
          
          <div className="mt-4 flex flex-wrap gap-2">
            {providers.filter(p => p.is_active).map((provider) => (
              <Button
                key={provider.id}
                variant="outline"
                onClick={() => testSMS(provider.id)}
                disabled={testingProvider === provider.id}
                className="flex items-center gap-2"
              >
                {testingProvider === provider.id ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    Testing...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Test {provider.provider_name}
                  </>
                )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SMSProviderConfig;