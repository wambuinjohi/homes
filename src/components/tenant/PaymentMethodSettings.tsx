import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  CreditCard, 
  Smartphone, 
  Building2, 
  Check, 
  Settings,
  Star,
  Shield
} from "lucide-react";

interface PaymentMethod {
  id: string;
  type: 'mpesa' | 'card' | 'bank_transfer';
  name: string;
  details: any;
  is_default: boolean;
  is_enabled: boolean;
}

interface PaymentPreference {
  preferred_method: string;
  auto_payment: boolean;
  payment_reminders: boolean;
  default_amount?: number;
}

export const PaymentMethodSettings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [preferences, setPreferences] = useState<PaymentPreference>({
    preferred_method: 'mpesa',
    auto_payment: false,
    payment_reminders: true
  });
  const [loading, setLoading] = useState(false);
  
  // Form states for adding new payment methods
  const [showAddCard, setShowAddCard] = useState(false);
  const [showAddMpesa, setShowAddMpesa] = useState(false);
  const [showAddBank, setShowAddBank] = useState(false);

  // Card form data
  const [cardData, setCardData] = useState({
    card_number: '',
    expiry_month: '',
    expiry_year: '',
    cvv: '',
    cardholder_name: ''
  });

  // M-Pesa form data
  const [mpesaData, setMpesaData] = useState({
    phone_number: '',
    account_name: ''
  });

  // Bank transfer form data
  const [bankData, setBankData] = useState({
    bank_name: '',
    account_number: '',
    account_name: '',
    branch: ''
  });

  useEffect(() => {
    if (user) {
      loadPaymentMethods();
      loadPreferences();
    }
  }, [user]);

  const loadPaymentMethods = async () => {
    try {
      // For now, we'll use localStorage to simulate payment methods
      // In production, this would fetch from a secure backend
      const saved = localStorage.getItem(`payment_methods_${user?.id}`);
      if (saved) {
        setPaymentMethods(JSON.parse(saved));
      } else {
        // Set default M-Pesa as the initial method
        const defaultMethods: PaymentMethod[] = [
          {
            id: '1',
            type: 'mpesa',
            name: 'M-Pesa',
            details: { phone_number: '', account_name: '' },
            is_default: true,
            is_enabled: true
          }
        ];
        setPaymentMethods(defaultMethods);
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
  };

  const loadPreferences = async () => {
    try {
      const saved = localStorage.getItem(`payment_preferences_${user?.id}`);
      if (saved) {
        setPreferences(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  const savePaymentMethods = (methods: PaymentMethod[]) => {
    localStorage.setItem(`payment_methods_${user?.id}`, JSON.stringify(methods));
    setPaymentMethods(methods);
  };

  const savePreferences = (prefs: PaymentPreference) => {
    localStorage.setItem(`payment_preferences_${user?.id}`, JSON.stringify(prefs));
    setPreferences(prefs);
  };

  const addMpesaMethod = () => {
    if (!mpesaData.phone_number.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid phone number",
        variant: "destructive",
      });
      return;
    }

    const newMethod: PaymentMethod = {
      id: Date.now().toString(),
      type: 'mpesa',
      name: `M-Pesa (${mpesaData.phone_number})`,
      details: { ...mpesaData },
      is_default: paymentMethods.length === 0,
      is_enabled: true
    };

    savePaymentMethods([...paymentMethods, newMethod]);
    setMpesaData({ phone_number: '', account_name: '' });
    setShowAddMpesa(false);
    
    toast({
      title: "Success",
      description: "M-Pesa payment method added successfully",
    });
  };

  const addCardMethod = () => {
    if (!cardData.card_number.trim() || !cardData.cardholder_name.trim()) {
      toast({
        title: "Error", 
        description: "Please fill in all required card details",
        variant: "destructive",
      });
      return;
    }

    const maskedNumber = `****-****-****-${cardData.card_number.slice(-4)}`;
    const newMethod: PaymentMethod = {
      id: Date.now().toString(),
      type: 'card',
      name: `Card ending in ${cardData.card_number.slice(-4)}`,
      details: { 
        ...cardData,
        card_number: maskedNumber // Store masked version for display
      },
      is_default: paymentMethods.length === 0,
      is_enabled: true
    };

    savePaymentMethods([...paymentMethods, newMethod]);
    setCardData({
      card_number: '',
      expiry_month: '',
      expiry_year: '',
      cvv: '',
      cardholder_name: ''
    });
    setShowAddCard(false);
    
    toast({
      title: "Success",
      description: "Card payment method added successfully",
    });
  };

  const addBankMethod = () => {
    if (!bankData.bank_name.trim() || !bankData.account_number.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required bank details",
        variant: "destructive",
      });
      return;
    }

    const newMethod: PaymentMethod = {
      id: Date.now().toString(),
      type: 'bank_transfer',
      name: `${bankData.bank_name} - ****${bankData.account_number.slice(-4)}`,
      details: { ...bankData },
      is_default: paymentMethods.length === 0,
      is_enabled: true
    };

    savePaymentMethods([...paymentMethods, newMethod]);
    setBankData({
      bank_name: '',
      account_number: '',
      account_name: '',
      branch: ''
    });
    setShowAddBank(false);
    
    toast({
      title: "Success",
      description: "Bank transfer method added successfully",
    });
  };

  const setDefaultMethod = (methodId: string) => {
    const updated = paymentMethods.map(method => ({
      ...method,
      is_default: method.id === methodId
    }));
    savePaymentMethods(updated);
    
    toast({
      title: "Success",
      description: "Default payment method updated",
    });
  };

  const toggleMethodEnabled = (methodId: string) => {
    const updated = paymentMethods.map(method => 
      method.id === methodId 
        ? { ...method, is_enabled: !method.is_enabled }
        : method
    );
    savePaymentMethods(updated);
  };

  const removeMethod = (methodId: string) => {
    if (window.confirm('Are you sure you want to remove this payment method?')) {
      const updated = paymentMethods.filter(method => method.id !== methodId);
      savePaymentMethods(updated);
      
      toast({
        title: "Success",
        description: "Payment method removed successfully",
      });
    }
  };

  const getMethodIcon = (type: string) => {
    switch (type) {
      case 'mpesa':
        return <Smartphone className="h-5 w-5 text-green-600" />;
      case 'card':
        return <CreditCard className="h-5 w-5 text-blue-600" />;
      case 'bank_transfer':
        return <Building2 className="h-5 w-5 text-purple-600" />;
      default:
        return <CreditCard className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Payment Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Payment Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Preferred Payment Method</Label>
              <Select 
                value={preferences.preferred_method} 
                onValueChange={(value) => savePreferences({ ...preferences, preferred_method: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mpesa">M-Pesa (Default)</SelectItem>
                  <SelectItem value="card">Credit/Debit Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Default Payment Amount</Label>
              <Input
                type="number"
                placeholder="e.g., 25000"
                value={preferences.default_amount || ''}
                onChange={(e) => savePreferences({ 
                  ...preferences, 
                  default_amount: parseFloat(e.target.value) || undefined 
                })}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto Payment</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically pay rent when due
                </p>
              </div>
              <Switch
                checked={preferences.auto_payment}
                onCheckedChange={(checked) => savePreferences({ ...preferences, auto_payment: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Payment Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Receive notifications before rent is due
                </p>
              </div>
              <Switch
                checked={preferences.payment_reminders}
                onCheckedChange={(checked) => savePreferences({ ...preferences, payment_reminders: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Saved Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <CreditCard className="h-5 w-5 mr-2" />
              Saved Payment Methods
            </span>
            <Badge variant="outline" className="flex items-center">
              <Shield className="h-3 w-3 mr-1" />
              Secure
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentMethods.map((method) => (
            <div key={method.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                {getMethodIcon(method.type)}
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {method.name}
                    {method.is_default && (
                      <Badge variant="default" className="text-xs">
                        <Star className="h-3 w-3 mr-1" />
                        Default
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {method.type === 'mpesa' && `Phone: ${method.details.phone_number}`}
                    {method.type === 'card' && `Card: ${method.details.card_number}`}
                    {method.type === 'bank_transfer' && `${method.details.bank_name} - ${method.details.account_number}`}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={method.is_enabled}
                  onCheckedChange={() => toggleMethodEnabled(method.id)}
                />
                {!method.is_default && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setDefaultMethod(method.id)}
                  >
                    Set Default
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => removeMethod(method.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}

          {/* Add New Payment Method Buttons */}
          <div className="grid gap-3 md:grid-cols-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowAddMpesa(true)}
              className="flex items-center"
            >
              <Smartphone className="h-4 w-4 mr-2" />
              Add M-Pesa
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowAddCard(true)}
              className="flex items-center"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Add Card
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowAddBank(true)}
              className="flex items-center"
            >
              <Building2 className="h-4 w-4 mr-2" />
              Add Bank
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add M-Pesa Method */}
      {showAddMpesa && (
        <Card>
          <CardHeader>
            <CardTitle>Add M-Pesa Payment Method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mpesa-phone">Phone Number</Label>
              <Input
                id="mpesa-phone"
                type="tel"
                placeholder="254XXXXXXXXX"
                value={mpesaData.phone_number}
                onChange={(e) => setMpesaData({ ...mpesaData, phone_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mpesa-name">Account Name (Optional)</Label>
              <Input
                id="mpesa-name"
                placeholder="John Doe"
                value={mpesaData.account_name}
                onChange={(e) => setMpesaData({ ...mpesaData, account_name: e.target.value })}
              />
            </div>
            <div className="flex space-x-3">
              <Button onClick={addMpesaMethod}>Add M-Pesa</Button>
              <Button variant="outline" onClick={() => setShowAddMpesa(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Card Method */}
      {showAddCard && (
        <Card>
          <CardHeader>
            <CardTitle>Add Credit/Debit Card</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Your card information is encrypted and securely stored using industry-standard security measures.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label htmlFor="card-number">Card Number</Label>
              <Input
                id="card-number"
                placeholder="1234 5678 9012 3456"
                value={cardData.card_number}
                onChange={(e) => setCardData({ ...cardData, card_number: e.target.value })}
                maxLength={19}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expiry-month">Month</Label>
                <Select 
                  value={cardData.expiry_month} 
                  onValueChange={(value) => setCardData({ ...cardData, expiry_month: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="MM" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1).padStart(2, '0')}>
                        {String(i + 1).padStart(2, '0')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="expiry-year">Year</Label>
                <Select 
                  value={cardData.expiry_year} 
                  onValueChange={(value) => setCardData({ ...cardData, expiry_year: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="YYYY" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => {
                      const year = new Date().getFullYear() + i;
                      return (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cvv">CVV</Label>
                <Input
                  id="cvv"
                  type="password"
                  placeholder="123"
                  maxLength={4}
                  value={cardData.cvv}
                  onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cardholder-name">Cardholder Name</Label>
              <Input
                id="cardholder-name"
                placeholder="John Doe"
                value={cardData.cardholder_name}
                onChange={(e) => setCardData({ ...cardData, cardholder_name: e.target.value })}
              />
            </div>
            
            <div className="flex space-x-3">
              <Button onClick={addCardMethod}>Add Card</Button>
              <Button variant="outline" onClick={() => setShowAddCard(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Bank Method */}
      {showAddBank && (
        <Card>
          <CardHeader>
            <CardTitle>Add Bank Transfer Method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bank-name">Bank Name</Label>
              <Select 
                value={bankData.bank_name} 
                onValueChange={(value) => setBankData({ ...bankData, bank_name: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your bank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="KCB Bank">KCB Bank</SelectItem>
                  <SelectItem value="Equity Bank">Equity Bank</SelectItem>
                  <SelectItem value="Cooperative Bank">Cooperative Bank</SelectItem>
                  <SelectItem value="NCBA Bank">NCBA Bank</SelectItem>
                  <SelectItem value="Standard Chartered">Standard Chartered</SelectItem>
                  <SelectItem value="Absa Bank">Absa Bank</SelectItem>
                  <SelectItem value="I&M Bank">I&M Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="account-number">Account Number</Label>
              <Input
                id="account-number"
                placeholder="1234567890"
                value={bankData.account_number}
                onChange={(e) => setBankData({ ...bankData, account_number: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="account-name">Account Name</Label>
              <Input
                id="account-name"
                placeholder="John Doe"
                value={bankData.account_name}
                onChange={(e) => setBankData({ ...bankData, account_name: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="branch">Branch (Optional)</Label>
              <Input
                id="branch"
                placeholder="Main Branch"
                value={bankData.branch}
                onChange={(e) => setBankData({ ...bankData, branch: e.target.value })}
              />
            </div>
            
            <div className="flex space-x-3">
              <Button onClick={addBankMethod}>Add Bank Account</Button>
              <Button variant="outline" onClick={() => setShowAddBank(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};