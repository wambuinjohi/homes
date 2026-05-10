import React from "react";
import { Badge } from "@/components/ui/badge";
import { Building2, Smartphone, CreditCard } from "lucide-react";

interface PaymentProviderBadgeProps {
  source: 'jenga_pay' | 'kcb_buni' | 'mpesa' | 'bank';
  bankCode?: string;
  className?: string;
}

export function PaymentProviderBadge({ source, bankCode, className }: PaymentProviderBadgeProps) {
  const getProviderConfig = () => {
    switch (source) {
      case 'jenga_pay':
        return {
          label: 'Equity Bank',
          icon: Building2,
          variant: 'default' as const,
          className: 'bg-red-600 hover:bg-red-700 text-white'
        };
      case 'kcb_buni':
        return {
          label: 'KCB Buni',
          icon: Building2,
          variant: 'default' as const,
          className: 'bg-green-600 hover:bg-green-700 text-white'
        };
      case 'mpesa':
        return {
          label: 'M-Pesa',
          icon: Smartphone,
          variant: 'default' as const,
          className: 'bg-emerald-500 hover:bg-emerald-600 text-white'
        };
      case 'bank':
        return {
          label: bankCode ? bankCode.toUpperCase() : 'Bank',
          icon: CreditCard,
          variant: 'secondary' as const,
          className: 'bg-blue-600 hover:bg-blue-700 text-white'
        };
      default:
        return {
          label: 'Unknown',
          icon: CreditCard,
          variant: 'secondary' as const,
          className: ''
        };
    }
  };

  const config = getProviderConfig();
  const Icon = config.icon;

  return (
    <Badge 
      variant={config.variant} 
      className={`${config.className} ${className || ''}`}
    >
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}
