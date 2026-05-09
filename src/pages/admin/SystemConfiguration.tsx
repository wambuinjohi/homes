import React, { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Settings, 
  ToggleLeft, 
  Mail, 
  Shield, 
  Database,
  HardDrive,
  RefreshCw,
  AlertTriangle,
  MessageSquare,
  Clock,
  Key,
  Wrench,
  Users,
  Bell,
  Plus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SmsTemplateEditor } from "@/components/admin/SmsTemplateEditor";
import SMSProviderConfig from "@/components/admin/SMSProviderConfig";
import WhatsAppBusinessConfig from "@/components/admin/WhatsAppBusinessConfig";
import { CommunicationAudit } from "@/components/admin/CommunicationAudit";

const SystemConfiguration = () => {
  const { toast } = useToast();
  
  // Template Editor State
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  
  // SMS Automation Settings
  const [smsAutomations, setSmsAutomations] = useState({
    // Rent-Related Reminders
    rentDueReminder: {
      enabled: true,
      timing: "5-7",
      audienceType: "tenants",
      template: "Reminder: Your rent of KES {{rent_amount}} is due on {{due_date}} for Unit {{unit_number}}."
    },
    onDueDateReminder: {
      enabled: true,
      timing: "morning",
      audienceType: "tenants",
      template: "Rent is due today. Kindly pay via MPESA Till {{mpesa_till}}."
    },
    latePaymentAlert: {
      enabled: true,
      timing: "2-3",
      audienceType: "tenants",
      template: "Your rent payment is overdue. Please settle immediately to avoid penalties."
    },
    receiptConfirmation: {
      enabled: true,
      timing: "instant",
      audienceType: "tenants",
      template: "Payment of KES {{amount}} received. Thank you! Zira Homes."
    },
    
    // Lease Lifecycle Notifications
    leaseExpiryWarning: {
      enabled: true,
      timing: "30-7",
      audienceType: "tenants",
      template: "Your lease will expire on {{lease_end_date}}. Please confirm renewal or notice to vacate."
    },
    leaseRenewalConfirmation: {
      enabled: true,
      timing: "instant",
      audienceType: "tenants",
      template: "Your lease has been renewed until {{new_end_date}}. Welcome again!"
    },
    moveInInstructions: {
      enabled: true,
      timing: "1-day",
      audienceType: "tenants",
      template: "Welcome to Zira Homes! You can collect keys for Unit {{unit_number}} on {{move_date}} at {{move_time}}."
    },
    
    // Maintenance Updates
    requestAcknowledgment: {
      enabled: true,
      timing: "instant",
      audienceType: "tenants",
      template: "We received your maintenance request. We'll respond shortly."
    },
    technicianAssigned: {
      enabled: true,
      timing: "instant",
      audienceType: "tenants",
      template: "Technician {{technician_name}} ({{technician_phone}}) will visit tomorrow between {{visit_time}}."
    },
    statusUpdate: {
      enabled: true,
      timing: "instant",
      audienceType: "tenants",
      template: "Your maintenance request is now marked as '{{status}}'. Kindly confirm."
    },
    
    // General Tenant Communication
    announcementNotice: {
      enabled: true,
      timing: "manual",
      audienceType: "tenants",
      template: "{{announcement_message}}"
    },
    reminderToSubmitInfo: {
      enabled: true,
      timing: "manual",
      audienceType: "tenants",
      template: "Kindly upload your {{required_documents}} to complete onboarding."
    },
    
    // System/Security Notifications
    newLoginAlert: {
      enabled: true,
      timing: "instant",
      audienceType: "all",
      template: "New login to your Zira Homes account. Was this you?"
    },
    passwordResetOTP: {
      enabled: true,
      timing: "instant",
      audienceType: "all",
      template: "Use code {{otp_code}} to reset your Zira Homes password."
    }
  });

  const [features, setFeatures] = useState({
    maintenanceMode: false,
    userRegistration: true,
    emailNotifications: true,
    smsNotifications: true,
    autoBackup: true,
    debugMode: false,
  });

  const [systemSettings, setSystemSettings] = useState({
    platformName: "Zira Homes",
    supportEmail: "support@zirahomes.com",
    maxFileSize: "10MB",
    sessionTimeout: "30",
    backupFrequency: "daily",
  });

  const handleFeatureToggle = (feature: string) => {
    setFeatures(prev => ({
      ...prev,
      [feature]: !prev[feature]
    }));
    toast({
      title: "Feature Updated",
      description: `${feature} has been ${!features[feature] ? 'enabled' : 'disabled'}`,
    });
  };

  const handleSmsAutomationToggle = (automation: string) => {
    setSmsAutomations(prev => ({
      ...prev,
      [automation]: {
        ...prev[automation],
        enabled: !prev[automation].enabled
      }
    }));
    toast({
      title: "SMS Automation Updated",
      description: `${automation} has been ${!smsAutomations[automation].enabled ? 'enabled' : 'disabled'}`,
    });
  };

  const handleSystemSave = () => {
    toast({
      title: "Settings Saved",
      description: "System configuration has been updated successfully.",
    });
  };

  const handleDatabaseMaintenance = () => {
    toast({
      title: "Database Maintenance",
      description: "Database optimization started in background.",
    });
  };

  const handleBackupNow = () => {
    toast({
      title: "Backup Started",
      description: "Manual backup initiated. You'll be notified when complete.",
    });
  };

  const editTemplate = (key: string, automation: any) => {
    setSelectedTemplate({ id: key, ...automation });
    setTemplateEditorOpen(true);
  };

  const handleTemplateSave = (templateData: any) => {
    if (selectedTemplate?.id) {
      setSmsAutomations(prev => ({
        ...prev,
        [selectedTemplate.id]: {
          ...prev[selectedTemplate.id],
          ...templateData
        }
      }));
    }
    setTemplateEditorOpen(false);
    setSelectedTemplate(null);
  };

  const getTimingText = (timing: string) => {
    switch (timing) {
      case "5-7": return "5-7 days before due date";
      case "morning": return "Morning of due date";
      case "2-3": return "2-3 days after due date";
      case "instant": return "Instantly after trigger";
      case "30-7": return "30 and 7 days before";
      case "1-day": return "Day before move-in";
      case "manual": return "Sent by admin";
      default: return timing;
    }
  };

  const getAudienceColor = (audience: string) => {
    switch (audience) {
      case "tenants": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "landlords": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "admins": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "all": return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  return (
    <DashboardLayout>
      <div className="bg-tint-gray p-6 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-primary">System Configuration</h1>
          <p className="text-muted-foreground">
            Manage SMS automations, platform settings, and system maintenance
          </p>
        </div>

        <Tabs defaultValue="audit" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Communication Audit
            </TabsTrigger>
            <TabsTrigger value="sms-automations" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              SMS Automations
            </TabsTrigger>
            <TabsTrigger value="sms-providers" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              SMS Providers
            </TabsTrigger>
            <TabsTrigger value="features" className="flex items-center gap-2">
              <ToggleLeft className="h-4 w-4" />
              Features
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              System
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Maintenance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="audit">
            <CommunicationAudit />
          </TabsContent>

          <TabsContent value="sms-automations">
            <div className="space-y-6">
              {/* Rent-Related Reminders */}
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-primary">SMS Automation Templates</h2>
                  <p className="text-muted-foreground">Configure automated SMS notifications and templates</p>
                </div>
                <Button onClick={() => {
                  setSelectedTemplate(null);
                  setTemplateEditorOpen(true);
                }} className="bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Template
                </Button>
              </div>

              <Card className="bg-card">
                <CardHeader>
                  <CardTitle className="text-primary flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    1. Rent-Related Reminders
                  </CardTitle>
                  <p className="text-muted-foreground">Automated payment reminders and confirmations</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {Object.entries(smsAutomations)
                    .filter(([key]) => ['rentDueReminder', 'onDueDateReminder', 'latePaymentAlert', 'receiptConfirmation'].includes(key))
                    .map(([key, automation]) => (
                      <div key={key} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Switch 
                              checked={automation.enabled}
                              onCheckedChange={() => handleSmsAutomationToggle(key)}
                            />
                            <div>
                              <Label className="text-base font-medium capitalize">
                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                              </Label>
                              <p className="text-sm text-muted-foreground">
                                {getTimingText(automation.timing)}
                              </p>
                            </div>
                          </div>
                          <Badge className={getAudienceColor(automation.audienceType)}>
                            {automation.audienceType}
                          </Badge>
                        </div>
                       <div className="bg-muted p-3 rounded text-sm">
                          "{automation.template}"
                        </div>
                        <div className="flex justify-end mt-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => editTemplate(key, automation)}
                            className="text-xs"
                          >
                            Edit Template
                          </Button>
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>

              {/* Lease Lifecycle Notifications */}
              <Card className="bg-card">
                <CardHeader>
                  <CardTitle className="text-primary flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    2. Lease Lifecycle Notifications
                  </CardTitle>
                  <p className="text-muted-foreground">Lease expiry, renewal, and move-in communications</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {Object.entries(smsAutomations)
                    .filter(([key]) => ['leaseExpiryWarning', 'leaseRenewalConfirmation', 'moveInInstructions'].includes(key))
                    .map(([key, automation]) => (
                      <div key={key} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Switch 
                              checked={automation.enabled}
                              onCheckedChange={() => handleSmsAutomationToggle(key)}
                            />
                            <div>
                              <Label className="text-base font-medium capitalize">
                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                              </Label>
                              <p className="text-sm text-muted-foreground">
                                {getTimingText(automation.timing)}
                              </p>
                            </div>
                          </div>
                          <Badge className={getAudienceColor(automation.audienceType)}>
                            {automation.audienceType}
                          </Badge>
                        </div>
                        <div className="bg-muted p-3 rounded text-sm">
                          "{automation.template}"
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>

              {/* Maintenance Updates */}
              <Card className="bg-card">
                <CardHeader>
                  <CardTitle className="text-primary flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    3. Maintenance Updates
                  </CardTitle>
                  <p className="text-muted-foreground">Maintenance request status and technician updates</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {Object.entries(smsAutomations)
                    .filter(([key]) => ['requestAcknowledgment', 'technicianAssigned', 'statusUpdate'].includes(key))
                    .map(([key, automation]) => (
                      <div key={key} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Switch 
                              checked={automation.enabled}
                              onCheckedChange={() => handleSmsAutomationToggle(key)}
                            />
                            <div>
                              <Label className="text-base font-medium capitalize">
                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                              </Label>
                              <p className="text-sm text-muted-foreground">
                                {getTimingText(automation.timing)}
                              </p>
                            </div>
                          </div>
                          <Badge className={getAudienceColor(automation.audienceType)}>
                            {automation.audienceType}
                          </Badge>
                        </div>
                        <div className="bg-muted p-3 rounded text-sm">
                          "{automation.template}"
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>

              {/* General Tenant Communication */}
              <Card className="bg-card">
                <CardHeader>
                  <CardTitle className="text-primary flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    4. General Tenant Communication
                  </CardTitle>
                  <p className="text-muted-foreground">Announcements and information requests</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {Object.entries(smsAutomations)
                    .filter(([key]) => ['announcementNotice', 'reminderToSubmitInfo'].includes(key))
                    .map(([key, automation]) => (
                      <div key={key} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Switch 
                              checked={automation.enabled}
                              onCheckedChange={() => handleSmsAutomationToggle(key)}
                            />
                            <div>
                              <Label className="text-base font-medium capitalize">
                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                              </Label>
                              <p className="text-sm text-muted-foreground">
                                {getTimingText(automation.timing)}
                              </p>
                            </div>
                          </div>
                          <Badge className={getAudienceColor(automation.audienceType)}>
                            {automation.audienceType}
                          </Badge>
                        </div>
                        <div className="bg-muted p-3 rounded text-sm">
                          "{automation.template}"
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>

              {/* System/Security Notifications */}
              <Card className="bg-card">
                <CardHeader>
                  <CardTitle className="text-primary flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    5. System / Security Notifications
                  </CardTitle>
                  <p className="text-muted-foreground">Authentication and security alerts</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {Object.entries(smsAutomations)
                    .filter(([key]) => ['newLoginAlert', 'passwordResetOTP'].includes(key))
                    .map(([key, automation]) => (
                      <div key={key} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Switch 
                              checked={automation.enabled}
                              onCheckedChange={() => handleSmsAutomationToggle(key)}
                            />
                            <div>
                              <Label className="text-base font-medium capitalize">
                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                              </Label>
                              <p className="text-sm text-muted-foreground">
                                {getTimingText(automation.timing)}
                              </p>
                            </div>
                          </div>
                          <Badge className={getAudienceColor(automation.audienceType)}>
                            {automation.audienceType}
                          </Badge>
                        </div>
                        <div className="bg-muted p-3 rounded text-sm">
                          "{automation.template}"
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={handleSystemSave} className="bg-primary hover:bg-primary/90">
                  Save SMS Automation Settings
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sms-providers">
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-primary mb-2">SMS & WhatsApp Provider Configuration</h2>
                <p className="text-muted-foreground">Configure SMS and WhatsApp providers with country-specific assignments</p>
              </div>
              
              <Tabs defaultValue="sms-config" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="sms-config">SMS Providers</TabsTrigger>
                  <TabsTrigger value="whatsapp-config">WhatsApp Business</TabsTrigger>
                </TabsList>
                
                <TabsContent value="sms-config">
                  <SMSProviderConfig />
                </TabsContent>
                
                <TabsContent value="whatsapp-config">
                  <WhatsAppBusinessConfig />
                </TabsContent>
              </Tabs>
            </div>
          </TabsContent>

          <TabsContent value="features">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="bg-card">
                <CardHeader>
                  <CardTitle className="text-primary">Platform Features</CardTitle>
                  <p className="text-muted-foreground">Control platform-wide feature availability</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium">Maintenance Mode</Label>
                      <p className="text-sm text-muted-foreground">Temporarily disable platform access</p>
                    </div>
                    <Switch 
                      checked={features.maintenanceMode}
                      onCheckedChange={() => handleFeatureToggle('maintenanceMode')}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium">User Registration</Label>
                      <p className="text-sm text-muted-foreground">Allow new user signups</p>
                    </div>
                    <Switch 
                      checked={features.userRegistration}
                      onCheckedChange={() => handleFeatureToggle('userRegistration')}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium">Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">System email notifications</p>
                    </div>
                    <Switch 
                      checked={features.emailNotifications}
                      onCheckedChange={() => handleFeatureToggle('emailNotifications')}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium">SMS Notifications</Label>
                      <p className="text-sm text-muted-foreground">SMS alerts and notifications</p>
                    </div>
                    <Switch 
                      checked={features.smsNotifications}
                      onCheckedChange={() => handleFeatureToggle('smsNotifications')}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card">
                <CardHeader>
                  <CardTitle className="text-primary">System Features</CardTitle>
                  <p className="text-muted-foreground">Advanced system functionality</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium">Auto Backup</Label>
                      <p className="text-sm text-muted-foreground">Automatic daily backups</p>
                    </div>
                    <Switch 
                      checked={features.autoBackup}
                      onCheckedChange={() => handleFeatureToggle('autoBackup')}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium">Debug Mode</Label>
                      <p className="text-sm text-muted-foreground">Enable detailed logging</p>
                    </div>
                    <Switch 
                      checked={features.debugMode}
                      onCheckedChange={() => handleFeatureToggle('debugMode')}
                    />
                  </div>

                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <span className="font-medium text-orange-700 dark:text-orange-300">Current Status</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-sm">Maintenance Mode:</span>
                        <Badge variant={features.maintenanceMode ? "destructive" : "secondary"}>
                          {features.maintenanceMode ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">SMS Automation:</span>
                        <Badge variant={features.smsNotifications ? "default" : "secondary"}>
                          {features.smsNotifications ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="system">
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="text-primary">System Settings</CardTitle>
                <p className="text-muted-foreground">Configure platform-wide system parameters</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="platformName">Platform Name</Label>
                    <Input 
                      id="platformName"
                      value={systemSettings.platformName}
                      onChange={(e) => setSystemSettings(prev => ({...prev, platformName: e.target.value}))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="supportEmail">Support Email</Label>
                    <Input 
                      id="supportEmail"
                      type="email"
                      value={systemSettings.supportEmail}
                      onChange={(e) => setSystemSettings(prev => ({...prev, supportEmail: e.target.value}))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="maxFileSize">Max File Upload Size</Label>
                    <Input 
                      id="maxFileSize"
                      value={systemSettings.maxFileSize}
                      onChange={(e) => setSystemSettings(prev => ({...prev, maxFileSize: e.target.value}))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                    <Input 
                      id="sessionTimeout"
                      type="number"
                      value={systemSettings.sessionTimeout}
                      onChange={(e) => setSystemSettings(prev => ({...prev, sessionTimeout: e.target.value}))}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSystemSave} className="bg-primary hover:bg-primary/90">
                    Save System Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="security">
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="text-primary">Security Settings</CardTitle>
                <p className="text-muted-foreground">Configure platform security parameters</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Password Policy</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Minimum Password Length</Label>
                        <Input className="w-20" value="8" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Require Special Characters</Label>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Require Numbers</Label>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Password Expiry (days)</Label>
                        <Input className="w-20" value="90" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Access Control</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Two-Factor Authentication</Label>
                        <Switch />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Login Attempts Limit</Label>
                        <Input className="w-20" value="5" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Account Lockout Duration</Label>
                        <Input className="w-20" value="30" />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>IP Whitelisting</Label>
                        <Switch />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button className="bg-primary hover:bg-primary/90">
                    Update Security Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="maintenance">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="bg-card">
                <CardHeader>
                  <CardTitle className="text-primary">Database Maintenance</CardTitle>
                  <p className="text-muted-foreground">Database optimization and cleanup tasks</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    onClick={handleDatabaseMaintenance}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    <Database className="mr-2 h-4 w-4" />
                    Optimize Database
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Rebuild Indexes
                  </Button>

                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span>Database Size:</span>
                        <span className="font-medium">2.4 GB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Last Optimization:</span>
                        <span className="font-medium">2 days ago</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <Badge variant="secondary">Healthy</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card">
                <CardHeader>
                  <CardTitle className="text-primary">System Backup</CardTitle>
                  <p className="text-muted-foreground">Backup management and restoration</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button 
                    onClick={handleBackupNow}
                    className="w-full bg-primary hover:bg-primary/90"
                  >
                    <HardDrive className="mr-2 h-4 w-4" />
                    Backup Now
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Restore from Backup
                  </Button>

                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span>Last Backup:</span>
                        <span className="font-medium">6 hours ago</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Backup Size:</span>
                        <span className="font-medium">1.8 GB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Auto Backup:</span>
                        <Badge variant={features.autoBackup ? "default" : "secondary"}>
                          {features.autoBackup ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* SMS Template Editor */}
      <SmsTemplateEditor
        template={selectedTemplate}
        open={templateEditorOpen}
        onOpenChange={setTemplateEditorOpen}
        onSave={handleTemplateSave}
      />
    </DashboardLayout>
  );
};

export default SystemConfiguration;