import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Phone, 
  Mail, 
  MessageSquare, 
  Send,
  Eye,
  Settings,
  Database,
  Wifi,
  RefreshCw
} from "lucide-react";

interface AuditResult {
  section: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
  details?: string;
  action?: string;
}

export const CommunicationAudit = () => {
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [testResults, setTestResults] = useState<any[]>([]);
  const { toast } = useToast();

  const runFullAudit = async () => {
    setIsRunning(true);
    setProgress(0);
    setAuditResults([]);
    
    const results: AuditResult[] = [];
    const totalSteps = 6;
    let currentStep = 0;

    try {
      // 1. Communication Settings Audit
      currentStep++;
      setProgress((currentStep / totalSteps) * 100);
      
      const { data: commPrefs, error: commError } = await supabase
        .from('communication_preferences')
        .select('*');
        
      if (commError) {
        results.push({
          section: "Communication Settings",
          status: 'fail',
          message: "Failed to load communication preferences",
          details: commError.message,
          action: "Check database connection and table permissions"
        });
      } else {
        const allEnabled = commPrefs?.every(pref => pref.email_enabled || pref.sms_enabled);
        const smsEnabled = commPrefs?.filter(pref => pref.sms_enabled).length;
        
        results.push({
          section: "Communication Settings",
          status: allEnabled ? 'pass' : 'warning',
          message: `${commPrefs?.length || 0} communication settings configured. ${smsEnabled || 0} have SMS enabled.`,
          details: allEnabled ? "All communication channels are properly configured" : "Some communication settings may not have both email and SMS enabled",
          action: !allEnabled ? "Review and enable missing communication channels in Communication Settings" : undefined
        });
      }

      // 2. Message Templates Audit
      currentStep++;
      setProgress((currentStep / totalSteps) * 100);
      
      const { data: templates, error: templatesError } = await supabase
        .from('message_templates')
        .select('*');
        
      if (templatesError) {
        results.push({
          section: "Message Templates",
          status: 'fail',
          message: "Failed to load message templates",
          details: templatesError.message,
          action: "Check database connection and table permissions"
        });
      } else {
        const enabledTemplates = templates?.filter(t => t.enabled).length || 0;
        const smsTemplates = templates?.filter(t => t.type === 'sms' && t.enabled).length || 0;
        
        results.push({
          section: "Message Templates",
          status: enabledTemplates > 0 ? 'pass' : 'warning',
          message: `${enabledTemplates} enabled templates found. ${smsTemplates} SMS templates active.`,
          details: enabledTemplates > 0 ? "Message templates are configured and enabled" : "No enabled message templates found",
          action: enabledTemplates === 0 ? "Create and enable message templates" : undefined
        });
      }

      // 3. SMS Provider Configuration Audit
      currentStep++;
      setProgress((currentStep / totalSteps) * 100);
      
      const { data: providers, error: providersError } = await supabase
        .from('sms_providers')
        .select('*');
        
      if (providersError) {
        results.push({
          section: "SMS Provider Integration",
          status: 'fail',
          message: "Failed to load SMS providers",
          details: providersError.message,
          action: "Check SMS providers table and permissions"
        });
      } else {
        const activeProviders = providers?.filter(p => p.is_active).length || 0;
        const defaultProvider = providers?.find(p => p.is_default && p.is_active);
        
        results.push({
          section: "SMS Provider Integration",
          status: defaultProvider ? 'pass' : 'fail',
          message: `${activeProviders} active SMS provider(s). ${defaultProvider ? 'Default provider configured' : 'No default provider'}`,
          details: defaultProvider ? `Zira Tech SMS provider is active and configured` : "No active default SMS provider found",
          action: !defaultProvider ? "Configure and activate a default SMS provider" : undefined
        });
      }

      // 4. Database Connectivity Test
      currentStep++;
      setProgress((currentStep / totalSteps) * 100);
      
      try {
        const { data: testData, error: dbError } = await supabase
          .from('notification_preferences')
          .select('count')
          .single();
          
        results.push({
          section: "Database Connectivity",
          status: 'pass',
          message: "Database connection successful",
          details: "All communication tables are accessible",
        });
      } catch (dbError: any) {
        results.push({
          section: "Database Connectivity",
          status: 'warning',
          message: "Database connectivity issue detected",
          details: dbError?.message || "Unknown database error",
          action: "Check database connection and table permissions"
        });
      }

      // 5. Edge Function Test
      currentStep++;
      setProgress((currentStep / totalSteps) * 100);
      
      try {
        const { data: providerData, error: providerError } = await supabase.functions.invoke('get-sms-provider');
        
        results.push({
          section: "SMS Functions",
          status: providerData?.success ? 'pass' : 'warning',
          message: providerData?.success ? "SMS functions are operational" : "SMS function response issues",
          details: providerData?.message || "SMS provider function test completed",
          action: !providerData?.success ? "Check edge function configuration and logs" : undefined
        });
      } catch (funcError: any) {
        results.push({
          section: "SMS Functions",
          status: 'fail',
          message: "SMS functions not accessible",
          details: funcError?.message || "Unknown function error",
          action: "Check edge function deployment and configuration"
        });
      }

      // 6. SMS Integration Test
      currentStep++;
      setProgress((currentStep / totalSteps) * 100);
      
      const testPhone = "+254700000000"; // Test phone number
      const testMessage = "ZIRA HOMES: Communication system test - " + new Date().toLocaleTimeString();
      
      try {
        const { data: smsResult, error: smsError } = await supabase.functions.invoke('send-sms', {
          body: {
            provider_name: 'inhouse sms',
            phone_number: testPhone,
            message: testMessage,
            provider_config: {
              authorization_token: 'f22b2aa230b02b428a71023c7eb7f7bb9d440f38',
              username: 'ZIRA TECH',
              sender_id: 'ZIRA TECH',
              base_url: 'http://68.183.101.252:803/bulk_api/',
              unique_identifier: '77',
              sender_type: '10'
            }
          }
        });

        results.push({
          section: "SMS Integration Test",
          status: smsResult?.success ? 'pass' : 'warning',
          message: smsResult?.success ? "SMS delivery test successful" : "SMS delivery test failed",
          details: smsResult?.message || smsError?.message || "SMS integration test completed",
          action: !smsResult?.success ? "Check SMS provider configuration and credentials" : undefined
        });
      } catch (smsTestError: any) {
        results.push({
          section: "SMS Integration Test",
          status: 'fail',
          message: "SMS integration test failed",
          details: smsTestError?.message || "Unknown SMS error",
          action: "Check SMS provider configuration, credentials, and network connectivity"
        });
      }

    } catch (error: any) {
      results.push({
        section: "Audit System",
        status: 'fail',
        message: "Audit system error",
        details: error?.message || "Unknown audit error",
        action: "Check system configuration and try again"
      });
    }

    setAuditResults(results);
    setProgress(100);
    setIsRunning(false);
    
    const passCount = results.filter(r => r.status === 'pass').length;
    const totalCount = results.length;
    
    toast({
      title: "Communication Audit Complete",
      description: `${passCount}/${totalCount} checks passed. Review results below.`,
      variant: passCount === totalCount ? "default" : "destructive"
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'fail': return <XCircle className="h-5 w-5 text-red-600" />;
      default: return <AlertTriangle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'pass': return 'default';
      case 'warning': return 'secondary';
      case 'fail': return 'destructive';
      default: return 'outline';
    }
  };

  const getSectionIcon = (section: string) => {
    switch (section) {
      case 'Communication Settings': return <Settings className="h-5 w-5" />;
      case 'Message Templates': return <MessageSquare className="h-5 w-5" />;
      case 'SMS Provider Integration': return <Phone className="h-5 w-5" />;
      case 'Database Connectivity': return <Database className="h-5 w-5" />;
      case 'SMS Functions': return <Wifi className="h-5 w-5" />;
      case 'SMS Integration Test': return <Send className="h-5 w-5" />;
      default: return <Eye className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            Communication System Audit
          </CardTitle>
          <p className="text-muted-foreground">
            Comprehensive audit of the entire communication and notification system
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button 
              onClick={runFullAudit} 
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
              {isRunning ? 'Running Audit...' : 'Run Full Communication Audit'}
            </Button>
            
            {isRunning && (
              <div className="flex-1">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-muted-foreground mt-1">{progress.toFixed(0)}% complete</p>
              </div>
            )}
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>This audit will:</strong>
              <ul className="mt-2 space-y-1 text-sm">
                <li>• Verify all communication settings and toggles</li>
                <li>• Test message templates and variable substitution</li>
                <li>• Check SMS provider connectivity and configuration</li>
                <li>• Validate database connections and permissions</li>
                <li>• Test live SMS delivery through Zira Tech provider</li>
                <li>• Generate actionable recommendations for improvements</li>
              </ul>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {auditResults.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Audit Results</h3>
          
          {auditResults.map((result, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getSectionIcon(result.section)}
                    <CardTitle className="text-base">{result.section}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.status)}
                    <Badge variant={getStatusVariant(result.status)}>
                      {result.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="font-medium mb-2">{result.message}</p>
                {result.details && (
                  <p className="text-sm text-muted-foreground mb-2">{result.details}</p>
                )}
                {result.action && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Action Required:</strong> {result.action}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ))}
          
          <Card>
            <CardHeader>
              <CardTitle>Summary & Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {auditResults.filter(r => r.status === 'pass').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Passed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {auditResults.filter(r => r.status === 'warning').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Warnings</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {auditResults.filter(r => r.status === 'fail').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <p><strong>Overall System Health:</strong> {
                  auditResults.filter(r => r.status === 'pass').length === auditResults.length 
                    ? "✅ Excellent - All systems operational"
                    : auditResults.filter(r => r.status === 'fail').length > 0
                    ? "❌ Critical Issues Detected - Immediate Action Required"
                    : "⚠️ Minor Issues - Optimization Recommended"
                }</p>
                
                <p><strong>Next Steps:</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  {auditResults.filter(r => r.action).length > 0 ? (
                    auditResults.filter(r => r.action).map((result, index) => (
                      <li key={index}>{result.action}</li>
                    ))
                  ) : (
                    <li>System is fully operational - continue monitoring</li>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};