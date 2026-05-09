import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Smartphone, 
  Settings, 
  Bell, 
  CreditCard, 
  Shield, 
  Clock 
} from "lucide-react";

export function TenantPaymentSettings() {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {/* Primary Payment Method */}
      <Card className="card-payment-method">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/90 font-medium">Primary Method</p>
              <p className="text-xl font-bold text-white">Mpesa</p>
              <Badge className="bg-white/20 text-white border-white/30 text-xs mt-2">
                <Shield className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            </div>
            <div className="icon-bg-white">
              <Smartphone className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto Pay Status */}
      <Card className="card-auto-pay">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/90 font-medium">Auto Pay</p>
              <p className="text-xl font-bold text-white">Disabled</p>
              <Button 
                variant="secondary" 
                size="sm" 
                className="mt-2 bg-white/20 text-white border-white/30 hover:bg-white/30"
              >
                <Settings className="h-3 w-3 mr-1" />
                Enable
              </Button>
            </div>
            <div className="icon-bg-white">
              <CreditCard className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Reminders */}
      <Card className="card-reminders">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/90 font-medium">Reminders</p>
              <p className="text-xl font-bold text-white">3 days before</p>
              <div className="flex items-center space-x-2 mt-2">
                <Switch id="reminders" defaultChecked />
                <Label htmlFor="reminders" className="text-xs text-white/90">
                  Enabled
                </Label>
              </div>
            </div>
            <div className="icon-bg-white">
              <Bell className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}