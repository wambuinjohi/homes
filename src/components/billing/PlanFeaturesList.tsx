import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, X, Crown, Zap, Star } from "lucide-react";

interface PlanFeaturesListProps {
  features: string[];
  planName: string;
  maxUnits?: number | null;
  smsCredits?: number;
}

export function PlanFeaturesList({ features, planName, maxUnits, smsCredits }: PlanFeaturesListProps) {
  const getFeatureIcon = (feature: string) => {
    if (feature.includes('advanced') || feature.includes('priority')) {
      return <Crown className="h-3 w-3 text-yellow-600" />;
    }
    if (feature.includes('integration') || feature.includes('api')) {
      return <Zap className="h-3 w-3 text-blue-600" />;
    }
    if (feature.includes('team') || feature.includes('roles')) {
      return <Star className="h-3 w-3 text-purple-600" />;
    }
    return <Check className="h-3 w-3 text-green-600" />;
  };

  const getFeatureDisplayName = (feature: string): string => {
    const displayNames: Record<string, string> = {
      'reports.basic': 'Basic Reporting',
      'reports.advanced': 'Advanced Analytics & Reports',
      'reports.financial': 'Financial Reports & Statements',
      'maintenance.tracking': 'Maintenance Request Management',
      'tenant.portal': 'Tenant Self-Service Portal',
      'integrations.api': 'API Access & Integrations',
      'integrations.accounting': 'Accounting Software Integration',
      'notifications.sms': 'SMS Notifications',
      'notifications.email': 'Email Notifications',
      'team.roles': 'Team Roles & Permissions',
      'team.sub_users': 'Sub-User Management',
      'team.permissions': 'Granular Permissions',
      'branding.white_label': 'White Label Solution',
      'branding.custom': 'Custom Branding',
      'support.priority': 'Priority Support',
      'support.dedicated': 'Dedicated Account Manager',
      'operations.bulk': 'Bulk Operations',
      'billing.automated': 'Automated Billing',
      'documents.templates': 'Custom Document Templates',
    };
    
    return displayNames[feature] || feature.split('.').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const isBasicFeature = (feature: string) => {
    return feature.includes('basic') || 
           feature.includes('maintenance') || 
           feature.includes('tenant.portal') ||
           feature.includes('notifications.email');
  };

  const isPremiumFeature = (feature: string) => {
    return feature.includes('advanced') || 
           feature.includes('integration') || 
           feature.includes('team') || 
           feature.includes('branding') ||
           feature.includes('priority');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>{planName} Features</span>
          {isPremiumFeature(features.join(',')) && (
            <Badge variant="secondary">Premium</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Limits */}
        {maxUnits && (
          <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
            <span className="text-sm font-medium">Units Limit</span>
            <Badge variant="outline">{maxUnits === 999999 ? 'Unlimited' : `${maxUnits} units`}</Badge>
          </div>
        )}
        
        {smsCredits && (
          <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
            <span className="text-sm font-medium">SMS Credits</span>
            <Badge variant="outline">{smsCredits === 999999 ? 'Unlimited' : `${smsCredits}/month`}</Badge>
          </div>
        )}

        {/* Features */}
        <div className="space-y-2">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              {getFeatureIcon(feature)}
              <span className={`${isPremiumFeature(feature) ? 'font-medium' : ''}`}>
                {getFeatureDisplayName(feature)}
              </span>
              {isPremiumFeature(feature) && (
                <Badge variant="secondary" className="text-xs ml-auto">Pro</Badge>
              )}
            </div>
          ))}
        </div>

        {/* Feature Categories */}
        <div className="pt-2 border-t">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className={`p-2 rounded-lg ${features.some(f => f.includes('reports')) ? 'bg-green-50 text-green-700' : 'bg-muted text-muted-foreground'}`}>
              <div className="text-xs font-medium">Reporting</div>
              <div className="text-xs">
                {features.some(f => f.includes('reports.advanced')) ? 'Advanced' : 
                 features.some(f => f.includes('reports')) ? 'Basic' : 'None'}
              </div>
            </div>
            <div className={`p-2 rounded-lg ${features.some(f => f.includes('integration')) ? 'bg-blue-50 text-blue-700' : 'bg-muted text-muted-foreground'}`}>
              <div className="text-xs font-medium">Integrations</div>
              <div className="text-xs">
                {features.some(f => f.includes('integration')) ? 'Available' : 'None'}
              </div>
            </div>
            <div className={`p-2 rounded-lg ${features.some(f => f.includes('team')) ? 'bg-purple-50 text-purple-700' : 'bg-muted text-muted-foreground'}`}>
              <div className="text-xs font-medium">Team</div>
              <div className="text-xs">
                {features.some(f => f.includes('team')) ? 'Multi-user' : 'Single'}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}