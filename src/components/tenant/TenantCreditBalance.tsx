import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, Gift, Calendar } from "lucide-react";
import { fmtCurrency, fmtDate } from "@/lib/format";

interface Credit {
  id: string;
  amount: number;
  balance: number;
  description: string;
  source_type: string;
  created_at: string;
  expires_at?: string;
}

interface TenantCreditBalanceProps {
  credits: Credit[];
  totalBalance: number;
  variant?: 'card' | 'inline';
}

export function TenantCreditBalance({ credits, totalBalance, variant = 'card' }: TenantCreditBalanceProps) {
  if (totalBalance <= 0 && credits.length === 0) {
    return null;
  }

  const getSourceBadge = (sourceType: string) => {
    switch (sourceType) {
      case 'overpayment':
        return <Badge variant="secondary" className="text-xs">Overpayment</Badge>;
      case 'refund':
        return <Badge variant="outline" className="text-xs">Refund</Badge>;
      case 'adjustment':
        return <Badge variant="outline" className="text-xs">Adjustment</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{sourceType}</Badge>;
    }
  };

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
        <Wallet className="h-5 w-5 text-green-600" />
        <div className="flex-1">
          <span className="text-sm font-medium text-green-700 dark:text-green-300">
            Available Credit Balance
          </span>
        </div>
        <span className="text-lg font-bold text-green-600">
          {fmtCurrency(totalBalance)}
        </span>
      </div>
    );
  }

  return (
    <Card className="border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50/50 to-white dark:from-green-950/20 dark:to-background">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
          <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50">
            <Wallet className="h-5 w-5" />
          </div>
          Credit Balance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total Available</span>
          <span className="text-2xl font-bold text-green-600">{fmtCurrency(totalBalance)}</span>
        </div>

        {credits.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Credit History
            </p>
            {credits.slice(0, 3).map((credit) => (
              <div
                key={credit.id}
                className="flex items-center justify-between p-2 bg-background/80 rounded-md text-sm"
              >
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-green-500" />
                  <div>
                    <p className="font-medium">{credit.description || 'Credit'}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {getSourceBadge(credit.source_type)}
                      <span>{fmtDate(credit.created_at)}</span>
                    </div>
                  </div>
                </div>
                <span className="font-semibold text-green-600">
                  {fmtCurrency(credit.balance)}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Use your credit balance to pay outstanding invoices by clicking "Apply Credit" on any unpaid invoice.
        </p>
      </CardContent>
    </Card>
  );
}

export default TenantCreditBalance;
