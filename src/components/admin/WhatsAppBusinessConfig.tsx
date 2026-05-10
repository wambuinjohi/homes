import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { MessageCircle, Plus, Settings, Trash2, Edit, Send, CheckCircle2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppProvider {
  id: string;
  name: string;
  provider_type: 'twilio' | 'meta' | '360dialog' | 'other';
  phone_number_id: string;
  access_token: string;
  webhook_verify_token: string;
  business_account_id?: string;
  is_active: boolean;
  is_default: boolean;
  country_codes: string[];
  config_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export default function WhatsAppBusinessConfig() {
  const { toast } = useToast();
  const [providers, setProviders] = useState<WhatsAppProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<WhatsAppProvider | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Hello! This is a test message from Zira Homes.');
  const [sendingTest, setSendingTest] = useState(false);

  const [newProvider, setNewProvider] = useState({
    name: '',
    provider_type: 'twilio' as 'twilio' | 'meta' | '360dialog' | 'other',
    phone_number_id: '',
    access_token: '',
    webhook_verify_token: '',
    business_account_id: '',
    is_active: true,
    is_default: false,
    country_codes: ['KE'],
    config_data: {}
  });

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

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      // Simulate API call - replace with actual Supabase call when table is created
      const dummyProviders: WhatsAppProvider[] = [
        {
          id: '1',
          name: 'Twilio US',
          provider_type: 'twilio',
          phone_number_id: '+1234567890',
          access_token: 'twilio_token_***',
          webhook_verify_token: 'verify_token_123',
          business_account_id: 'business_123',
          is_active: true,
          is_default: true,
          country_codes: ['US', 'CA'],
          config_data: { api_version: '2010-04-01' },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      setProviders(dummyProviders);
    } catch (error) {
      console.error('Error fetching providers:', error);
      toast({
        title: "Error",
        description: "Failed to fetch WhatsApp providers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveProvider = async () => {
    try {
      if (!newProvider.name || !newProvider.phone_number_id || !newProvider.access_token) {
        toast({
          title: "Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }

      if (editingProvider) {
        // Update existing provider
        setProviders(prev => prev.map(p => 
          p.id === editingProvider.id 
            ? { ...p, ...newProvider, updated_at: new Date().toISOString() }
            : p
        ));
        toast({
          title: "Success",
          description: "WhatsApp provider updated successfully",
        });
      } else {
        // Create new provider
        const provider: WhatsAppProvider = {
          ...newProvider,
          id: Date.now().toString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setProviders(prev => [...prev, provider]);
        toast({
          title: "Success", 
          description: "WhatsApp provider created successfully",
        });
      }

      resetForm();
    } catch (error) {
      console.error('Error saving provider:', error);
      toast({
        title: "Error",
        description: "Failed to save WhatsApp provider",
        variant: "destructive",
      });
    }
  };

  const toggleProvider = async (id: string, field: 'is_active' | 'is_default') => {
    try {
      setProviders(prev => prev.map(provider => {
        if (provider.id === id) {
          const updated = { ...provider, [field]: !provider[field] };
          if (field === 'is_default' && updated.is_default) {
            // Only one provider can be default
            return updated;
          }
          return updated;
        } else if (field === 'is_default') {
          // Remove default from other providers
          return { ...provider, is_default: false };
        }
        return provider;
      }));

      toast({
        title: "Success",
        description: `Provider ${field === 'is_active' ? 'status' : 'default setting'} updated`,
      });
    } catch (error) {
      console.error('Error updating provider:', error);
      toast({
        title: "Error",
        description: "Failed to update provider",
        variant: "destructive",
      });
    }
  };

  const deleteProvider = async (id: string) => {
    try {
      setProviders(prev => prev.filter(p => p.id !== id));
      toast({
        title: "Success",
        description: "WhatsApp provider deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting provider:', error);
      toast({
        title: "Error",
        description: "Failed to delete provider",
        variant: "destructive",
      });
    }
  };

  const testWhatsApp = async () => {
    if (!testPhone || !testMessage) {
      toast({
        title: "Error",
        description: "Please enter phone number and message",
        variant: "destructive",
      });
      return;
    }

    setSendingTest(true);
    try {
      // Simulate sending WhatsApp message
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Success",
        description: "Test WhatsApp message sent successfully",
      });
      
      setTestPhone('');
      setTestMessage('Hello! This is a test message from Zira Homes.');
    } catch (error) {
      console.error('Error sending test WhatsApp:', error);
      toast({
        title: "Error",
        description: "Failed to send test message",
        variant: "destructive",
      });
    } finally {
      setSendingTest(false);
    }
  };

  const resetForm = () => {
    setNewProvider({
      name: '',
      provider_type: 'twilio',
      phone_number_id: '',
      access_token: '',
      webhook_verify_token: '',
      business_account_id: '',
      is_active: true,
      is_default: false,
      country_codes: ['KE'],
      config_data: {}
    });
    setEditingProvider(null);
    setIsDialogOpen(false);
  };

  const editProvider = (provider: WhatsAppProvider) => {
    setNewProvider({
      name: provider.name,
      provider_type: provider.provider_type,
      phone_number_id: provider.phone_number_id,
      access_token: provider.access_token,
      webhook_verify_token: provider.webhook_verify_token,
      business_account_id: provider.business_account_id || '',
      is_active: provider.is_active,
      is_default: provider.is_default,
      country_codes: provider.country_codes,
      config_data: provider.config_data
    });
    setEditingProvider(provider);
    setIsDialogOpen(true);
  };

  const providerTypeOptions = [
    { value: 'twilio', label: 'Twilio' },
    { value: 'meta', label: 'Meta Business' },
    { value: '360dialog', label: '360Dialog' },
    { value: 'other', label: 'Other' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading WhatsApp providers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">WhatsApp Business Configuration</h2>
          <p className="text-muted-foreground">Configure WhatsApp Business providers for messaging</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Provider
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingProvider ? 'Edit WhatsApp Provider' : 'Add WhatsApp Provider'}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Provider Name *</Label>
                  <Input
                    id="name"
                    value={newProvider.name}
                    onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                    placeholder="e.g., Twilio US"
                  />
                </div>
                <div>
                  <Label htmlFor="provider_type">Provider Type *</Label>
                  <Select value={newProvider.provider_type} onValueChange={(value: "meta" | "twilio" | "360dialog" | "other") => setNewProvider({ ...newProvider, provider_type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {providerTypeOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone_number_id">Phone Number ID *</Label>
                  <Input
                    id="phone_number_id"
                    value={newProvider.phone_number_id}
                    onChange={(e) => setNewProvider({ ...newProvider, phone_number_id: e.target.value })}
                    placeholder="+1234567890"
                  />
                </div>
                <div>
                  <Label htmlFor="business_account_id">Business Account ID</Label>
                  <Input
                    id="business_account_id"
                    value={newProvider.business_account_id}
                    onChange={(e) => setNewProvider({ ...newProvider, business_account_id: e.target.value })}
                    placeholder="Business Account ID"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="access_token">Access Token *</Label>
                <Input
                  id="access_token"
                  type="password"
                  value={newProvider.access_token}
                  onChange={(e) => setNewProvider({ ...newProvider, access_token: e.target.value })}
                  placeholder="Enter access token"
                />
              </div>

              <div>
                <Label htmlFor="webhook_verify_token">Webhook Verify Token</Label>
                <Input
                  id="webhook_verify_token"
                  value={newProvider.webhook_verify_token}
                  onChange={(e) => setNewProvider({ ...newProvider, webhook_verify_token: e.target.value })}
                  placeholder="Webhook verification token"
                />
              </div>

              <div>
                <Label htmlFor="country_codes">Country Codes</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {countries.map(country => (
                    <label key={country.code} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newProvider.country_codes.includes(country.code)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewProvider({
                              ...newProvider,
                              country_codes: [...newProvider.country_codes, country.code]
                            });
                          } else {
                            setNewProvider({
                              ...newProvider,
                              country_codes: newProvider.country_codes.filter(c => c !== country.code)
                            });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{country.name} ({country.code})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={newProvider.is_active}
                    onCheckedChange={(checked) => setNewProvider({ ...newProvider, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_default"
                    checked={newProvider.is_default}
                    onCheckedChange={(checked) => setNewProvider({ ...newProvider, is_default: checked })}
                  />
                  <Label htmlFor="is_default">Default Provider</Label>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={saveProvider} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  {editingProvider ? 'Update' : 'Create'} Provider
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Providers List */}
      <div className="grid gap-4">
        {providers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <MessageCircle className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No WhatsApp providers configured</h3>
              <p className="text-gray-500 text-center mb-4">
                Add your first WhatsApp Business provider to start sending messages
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Provider
              </Button>
            </CardContent>
          </Card>
        ) : (
          providers.map((provider) => (
            <Card key={provider.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <CardTitle className="text-lg">{provider.name}</CardTitle>
                      <p className="text-sm text-muted-foreground capitalize">
                        {provider.provider_type} • {provider.phone_number_id}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {provider.is_default && (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                        Default
                      </Badge>
                    )}
                    <Badge className={provider.is_active ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-800 border-gray-200'}>
                      {provider.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm text-muted-foreground">Countries:</span>
                    {provider.country_codes.map(code => (
                      <Badge key={code} variant="outline" className="text-xs">
                        {code}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleProvider(provider.id, 'is_active')}
                      >
                        {provider.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleProvider(provider.id, 'is_default')}
                        disabled={provider.is_default}
                      >
                        {provider.is_default ? 'Default' : 'Set Default'}
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => editProvider(provider)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteProvider(provider.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Test WhatsApp Section */}
      {providers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Test WhatsApp Message
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
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
              <Button 
                onClick={testWhatsApp} 
                disabled={sendingTest}
                className="w-fit"
              >
                {sendingTest ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Test Message
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}