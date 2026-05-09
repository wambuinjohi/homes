import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useSmsCredits } from "@/hooks/useSmsCredits";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Users, Filter, MessageSquare, AlertTriangle, CreditCard, Plus, X, Building2 } from "lucide-react";
import { FeatureGate } from "@/components/ui/feature-gate";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";
import { useNavigate } from "react-router-dom";

interface Tenant {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  property_id: string;
  property_name: string;
}

interface Property {
  id: string;
  name: string;
}

interface CustomRecipient {
  phone: string;
  name?: string;
}

const BulkMessaging = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { balance: smsCredits, isLow: isLowCredits } = useSmsCredits();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedTenants, setSelectedTenants] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [customRecipients, setCustomRecipients] = useState<CustomRecipient[]>([]);
  const [customPhone, setCustomPhone] = useState("");
  const [customName, setCustomName] = useState("");

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Step 1: Load properties
      const { data: propertiesData, error: propError } = await supabase
        .from('properties')
        .select('id, name')
        .eq('owner_id', user?.id)
        .order('name');

      if (propError) throw propError;
      setProperties(propertiesData || []);
      console.log('Loaded properties:', propertiesData?.length);
      
      // Create property ID to name map for efficient lookups
      const propertyIdToNameMap = new Map(
        propertiesData?.map(p => [p.id, p.name]) || []
      );

      const propertyIds = propertiesData?.map(p => p.id) || [];

      if (propertyIds.length === 0) {
        setTenants([]);
        setLoading(false);
        return;
      }

      // Step 2: Get units for these properties
      const { data: unitsData, error: unitsError } = await supabase
        .from('units')
        .select('id, property_id, unit_number')
        .in('property_id', propertyIds);
      console.log('Loaded units:', unitsData?.length);

      if (unitsError) throw unitsError;

      const unitIds = unitsData?.map(u => u.id) || [];

      if (unitIds.length === 0) {
        setTenants([]);
        setLoading(false);
        return;
      }

      // Step 3: Get active leases for these units
      const { data: leasesData, error: leasesError } = await supabase
        .from('leases')
        .select('tenant_id, unit_id')
        .eq('status', 'active')
        .in('unit_id', unitIds);
      console.log('Loaded leases:', leasesData?.length);

      if (leasesError) throw leasesError;

      const tenantIds = [...new Set(leasesData?.map(l => l.tenant_id) || [])];

      if (tenantIds.length === 0) {
        setTenants([]);
        setLoading(false);
        return;
      }

      // Step 4: Get tenant details
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('tenants')
        .select('id, first_name, last_name, email, phone')
        .in('id', tenantIds);
      console.log('Loaded tenants:', tenantsData?.length);

      if (tenantsError) throw tenantsError;

      // Step 5: Map tenants to their properties
      const tenantPropertyMap = new Map<string, { property_id: string; property_name: string }>();
      leasesData?.forEach((lease: any) => {
        const unit = unitsData?.find(u => u.id === lease.unit_id);
        if (unit && !tenantPropertyMap.has(lease.tenant_id)) {
          tenantPropertyMap.set(lease.tenant_id, {
            property_id: unit.property_id,
            property_name: propertyIdToNameMap.get(unit.property_id) || 'Unknown'
          });
        }
      });

      const enrichedTenants: Tenant[] = (tenantsData || []).map(tenant => ({
        id: tenant.id,
        first_name: tenant.first_name,
        last_name: tenant.last_name,
        email: tenant.email,
        phone: tenant.phone,
        property_id: tenantPropertyMap.get(tenant.id)?.property_id || '',
        property_name: tenantPropertyMap.get(tenant.id)?.property_name || 'Unknown'
      }));

      console.log(`✅ Loaded ${enrichedTenants.length} tenants from ${propertyIds.length} properties`);
      setTenants(enrichedTenants);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error("Failed to load tenants");
    } finally {
      setLoading(false);
    }
  };

  const toggleTenant = (tenantId: string) => {
    const newSelected = new Set(selectedTenants);
    if (newSelected.has(tenantId)) {
      newSelected.delete(tenantId);
    } else {
      newSelected.add(tenantId);
    }
    setSelectedTenants(newSelected);
  };

  const selectAll = () => {
    const filtered = getFilteredTenants();
    setSelectedTenants(new Set(filtered.map(t => t.id)));
  };

  const deselectAll = () => {
    setSelectedTenants(new Set());
  };

  const getFilteredTenants = () => {
    if (propertyFilter === "all") return tenants;
    return tenants.filter(t => t.property_id === propertyFilter);
  };

  const formatPhoneNumber = (phone: string): string | null => {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('254') && cleaned.length === 12) {
      return `+${cleaned}`;
    } else if (cleaned.startsWith('0') && cleaned.length === 10) {
      return `+254${cleaned.substring(1)}`;
    } else if (cleaned.length === 9) {
      return `+254${cleaned}`;
    }
    
    return null;
  };

  const addCustomRecipient = () => {
    if (!customPhone.trim()) {
      toast.error("Please enter a phone number");
      return;
    }

    const formatted = formatPhoneNumber(customPhone);
    if (!formatted) {
      toast.error("Invalid phone number. Use format: +254..., 0..., or 254...");
      return;
    }

    if (customRecipients.some(r => r.phone === formatted)) {
      toast.error("This number is already added");
      return;
    }

    setCustomRecipients([...customRecipients, { 
      phone: formatted, 
      name: customName.trim() || undefined 
    }]);
    setCustomPhone("");
    setCustomName("");
    toast.success("Recipient added");
  };

  const removeCustomRecipient = (phone: string) => {
    setCustomRecipients(customRecipients.filter(r => r.phone !== phone));
  };

  const handleSend = async () => {
    const totalRecipients = selectedTenants.size + customRecipients.length;
    
    if (totalRecipients === 0) {
      toast.error("Please select at least one recipient");
      return;
    }

    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    // Check SMS credits
    if (smsCredits < totalRecipients) {
      toast.error(`Insufficient SMS credits. You have ${smsCredits} but need ${totalRecipients}.`);
      return;
    }

    if (message.length > 160) {
      toast.warning("Message is longer than 160 characters and will be sent as multiple SMS");
    }

    try {
      setSending(true);

      const selectedTenantsList = tenants.filter(t => selectedTenants.has(t.id));
      let successCount = 0;
      let failCount = 0;

      // Send to selected tenants
      for (const tenant of selectedTenantsList) {
        if (!tenant.phone) {
          failCount++;
          continue;
        }

        try {
          const { error } = await supabase.functions.invoke('send-sms-with-logging', {
            body: {
              phone_number: tenant.phone,
              message: message.replace('{tenant_name}', `${tenant.first_name} ${tenant.last_name}`),
              message_type: 'bulk',
              landlord_id: user?.id,
              user_id: user?.id
            }
          });

          if (error) {
            console.error(`Failed to send to ${tenant.phone}:`, error);
            failCount++;
          } else {
            successCount++;
          }
        } catch (error) {
          console.error(`Error sending to ${tenant.phone}:`, error);
          failCount++;
        }
      }

      // Send to custom recipients
      for (const recipient of customRecipients) {
        try {
          const { error } = await supabase.functions.invoke('send-sms-with-logging', {
            body: {
              phone_number: recipient.phone,
              message: message.replace('{tenant_name}', recipient.name || 'there'),
              message_type: 'bulk',
              landlord_id: user?.id,
              user_id: user?.id
            }
          });

          if (error) {
            console.error(`Failed to send to ${recipient.phone}:`, error);
            failCount++;
          } else {
            successCount++;
          }
        } catch (error) {
          console.error(`Error sending to ${recipient.phone}:`, error);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully sent ${successCount} SMS messages`);
      }
      if (failCount > 0) {
        toast.error(`Failed to send ${failCount} messages`);
      }

      setMessage("");
      setSelectedTenants(new Set());
      setCustomRecipients([]);
    } catch (error) {
      console.error('Error sending bulk SMS:', error);
      toast.error("Failed to send bulk SMS");
    } finally {
      setSending(false);
    }
  };

  const totalRecipients = selectedTenants.size + customRecipients.length;
  const estimatedCost = totalRecipients * 2.5; // KES 2.50 per SMS
  const filteredTenants = getFilteredTenants();
  const tenantsWithPhone = filteredTenants.filter(t => t.phone);
  
  // Calculate tenant and unit counts per property and sort by tenant count
  const propertyStats = properties.map(prop => {
    const tenantCount = tenants.filter(t => t.property_id === prop.id).length;
    return { ...prop, tenantCount };
  }).sort((a, b) => b.tenantCount - a.tenantCount); // Sort by tenant count descending
  
  // Check for duplicate property names
  const propertyNames = properties.map(p => p.name);
  const hasDuplicateNames = propertyNames.some((name, idx) => 
    propertyNames.indexOf(name) !== idx
  );
  
  const getMessagePreview = () => {
    if (!message) return "";
    const firstTenant = tenants.find(t => selectedTenants.has(t.id));
    const firstCustom = customRecipients[0];
    const sampleName = firstTenant 
      ? `${firstTenant.first_name} ${firstTenant.last_name}`
      : firstCustom?.name || "there";
    return message.replace('{tenant_name}', sampleName);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-3 sm:p-4 lg:p-6 space-y-6">
        <FeatureGate
          feature={FEATURES.SMS_NOTIFICATIONS}
          fallbackTitle="Bulk SMS Messaging"
          fallbackDescription="Send SMS notifications to multiple tenants at once. Keep your tenants informed with automated and manual communications."
          allowReadOnly={false}
        >
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold">Bulk SMS Messaging</h1>
            <p className="text-muted-foreground">Send SMS to multiple tenants at once</p>
          </div>

          {/* Low Credits Warning */}
          {isLowCredits && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  Low SMS credits ({smsCredits} remaining). Purchase more to continue messaging.
                </span>
                <Button size="sm" onClick={() => navigate('/billing')}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Buy Credits
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Duplicate Property Names Warning */}
          {hasDuplicateNames && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                ⚠️ You have multiple properties with the same name. Consider renaming them for better clarity.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recipient Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Select Recipients</span>
                  <Badge variant="secondary">
                    {totalRecipients} total
                  </Badge>
                </CardTitle>
                <CardDescription>Choose tenants or add custom numbers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Property Filter */}
                {properties.length > 1 && (
                  <div className="space-y-2">
                    <Label>Filter by Property</Label>
                    <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Properties ({tenants.length} tenants)</SelectItem>
                        {propertyStats.map(prop => {
                          return (
                            <SelectItem key={prop.id} value={prop.id}>
                              {prop.name} ({prop.tenantCount} tenant{prop.tenantCount !== 1 ? 's' : ''})
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={selectAll}>
                      Select All {propertyFilter !== "all" && "Filtered"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={deselectAll}>
                      Deselect All
                    </Button>
                  </div>
                  <Badge variant="outline">
                    {selectedTenants.size} / {filteredTenants.length}
                  </Badge>
                </div>

                {/* Tenants List */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {properties.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="font-medium">No properties found</p>
                      <p className="text-sm">Add properties first to manage tenants</p>
                    </div>
                  ) : filteredTenants.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="font-medium">No tenants found</p>
                      <p className="text-sm">Add tenants with active leases</p>
                    </div>
                  ) : (
                    filteredTenants.map((tenant) => (
                      <div
                        key={tenant.id}
                        className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent cursor-pointer"
                        onClick={() => toggleTenant(tenant.id)}
                      >
                        <Checkbox
                          checked={selectedTenants.has(tenant.id)}
                          onCheckedChange={() => toggleTenant(tenant.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">
                              {tenant.first_name} {tenant.last_name}
                            </p>
                            {properties.length > 1 && (
                              <Badge variant="outline" className="text-xs">
                                <Building2 className="h-3 w-3 mr-1" />
                                {tenant.property_name}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {tenant.phone || (
                              <span className="text-orange-500 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                No phone number
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Custom Recipients */}
                <div className="pt-4 border-t space-y-3">
                  <Label className="text-sm font-medium">Add Custom Recipients</Label>
                  
                  <div className="flex gap-2">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Phone (+254...)"
                        value={customPhone}
                        onChange={(e) => setCustomPhone(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addCustomRecipient()}
                      />
                      <Input
                        placeholder="Name (optional)"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addCustomRecipient()}
                      />
                    </div>
                    <Button size="icon" onClick={addCustomRecipient}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  {customRecipients.length > 0 && (
                    <div className="space-y-2">
                      {customRecipients.map((recipient, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg border bg-muted/50">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{recipient.name || 'Custom Recipient'}</p>
                            <p className="text-xs text-muted-foreground">{recipient.phone}</p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeCustomRecipient(recipient.phone)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Message Composer */}
            <Card>
              <CardHeader>
                <CardTitle>Compose Message</CardTitle>
                <CardDescription>Write your SMS message (max 160 characters recommended)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message here... Use {tenant_name} to personalize"
                    rows={8}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{message.length} characters</span>
                    <span>{Math.ceil(message.length / 160)} SMS</span>
                  </div>
                </div>

                {/* Message Preview */}
                {message && totalRecipients > 0 && (
                  <div className="p-3 bg-muted rounded-lg">
                    <Label className="text-xs text-muted-foreground">Preview:</Label>
                    <p className="text-sm mt-1">{getMessagePreview()}</p>
                  </div>
                )}

                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Tenants Selected:</span>
                    <span className="font-medium">{selectedTenants.size}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Custom Recipients:</span>
                    <span className="font-medium">{customRecipients.length}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium pt-1 border-t">
                    <span>Total Recipients:</span>
                    <span>{totalRecipients}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>SMS Credits Available:</span>
                    <span className={`font-medium ${smsCredits < totalRecipients ? 'text-red-500' : ''}`}>
                      {smsCredits}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Credits Required:</span>
                    <span className="font-medium">{totalRecipients}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Estimated Cost:</span>
                    <span className="font-medium">KES {estimatedCost.toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  onClick={handleSend}
                  disabled={sending || totalRecipients === 0 || !message.trim()}
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sending ? 'Sending...' : `Send to ${totalRecipients} Recipient${totalRecipients === 1 ? '' : 's'}`}
                </Button>
              </CardContent>
            </Card>
          </div>
        </FeatureGate>
      </div>
    </DashboardLayout>
  );
};

export default BulkMessaging;
