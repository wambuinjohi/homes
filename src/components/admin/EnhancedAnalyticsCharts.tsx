import React, { useState, useEffect } from "react";
import { formatAmount } from "@/utils/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { supabase } from "@/integrations/supabase/client";
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface RevenueData {
  month: string;
  subscription_revenue: number;
  commission_revenue: number;
  sms_revenue: number;
  total_revenue: number;
}

interface DistributionData {
  name: string;
  value: number;
  color: string;
}

export const EnhancedAnalyticsCharts: React.FC = () => {
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [distributionData, setDistributionData] = useState<DistributionData[]>([]);
  const [loading, setLoading] = useState(true);

  const sanitizeArray = (arr: any[]): any[] => {
    if (!Array.isArray(arr)) return [];
    return arr.map((r) => {
      if (!r || typeof r !== 'object') return {};
      const out: any = {};
      Object.keys(r).forEach((k) => {
        const v = (r as any)[k];
        if (v == null) out[k] = 0;
        else if (typeof v === 'string') {
          const num = Number(v.replace(/,/g, ''));
          out[k] = Number.isFinite(num) ? num : v;
        } else out[k] = v;
      });
      return out;
    });
  };

  const safeRevenueData = sanitizeArray(revenueData);
  const safeDistribution = sanitizeArray(distributionData);

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Fetch payment transactions for revenue analysis
      const { data: transactions, error: transactionsError } = await supabase
        .from('payment_transactions')
        .select('*')
        .gte('created_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());

      if (transactionsError) throw transactionsError;

      // Fetch landlord subscriptions for distribution
      const { data: subscriptions, error: subscriptionsError } = await supabase
        .from('landlord_subscriptions')
        .select(`
          *,
          billing_plan:billing_plans(*)
        `);

      if (subscriptionsError) throw subscriptionsError;

      // Process revenue data by month
      const monthlyRevenue = processRevenueData(transactions || []);
      setRevenueData(monthlyRevenue);

      // Process distribution data
      const distribution = processDistributionData(subscriptions || []);
      setDistributionData(distribution);

    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const processRevenueData = (transactions: { amount: number; created_at: string; status?: string; payment_method?: string; invoice_id?: string }[]): RevenueData[] => {
    const monthlyData: { [key: string]: RevenueData } = {};
    
    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
      const monthName = date.toLocaleDateString('en-US', { month: 'short' });
      
      monthlyData[monthKey] = {
        month: monthName,
        subscription_revenue: 0,
        commission_revenue: 0,
        sms_revenue: 0,
        total_revenue: 0
      };
    }

    // Process actual transactions with better categorization
    transactions.forEach(transaction => {
      const monthKey = transaction.created_at.slice(0, 7);
      if (monthlyData[monthKey] && transaction.status === 'completed') {
        const amount = Number(transaction.amount) || 0;
        
        // Enhanced categorization based on invoice or transaction type
        const paymentMethod = transaction.payment_method?.toLowerCase() || '';
        const invoiceId = transaction.invoice_id;
        
        // Check if it's subscription-related (recurring payments)
        if (paymentMethod.includes('subscription') || paymentMethod.includes('monthly') || paymentMethod.includes('annual')) {
          monthlyData[monthKey].subscription_revenue += amount;
        } 
        // Check if it's SMS credit purchase
        else if (paymentMethod.includes('sms') || paymentMethod.includes('credit')) {
          monthlyData[monthKey].sms_revenue += amount;
        }
        // Everything else is commission (property management fees, etc.)
        else {
          monthlyData[monthKey].commission_revenue += amount;
        }
        
        monthlyData[monthKey].total_revenue += amount;
      }
    });

    return Object.values(monthlyData);
  };

  const processDistributionData = (subscriptions: { billing_plan: { name: string }; [key: string]: unknown }[]): DistributionData[] => {
    const planDistribution: { [key: string]: number } = {};
    
    subscriptions.forEach(sub => {
      const planName = sub.billing_plan?.name || 'No Plan';
      planDistribution[planName] = (planDistribution[planName] || 0) + 1;
    });

    const colors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];
    
    return Object.entries(planDistribution).map(([name, value], index) => ({
      name,
      value,
      color: colors[index % colors.length]
    }));
  };

  const formatCurrency = (value: number) => {
    return formatAmount(value);
  };

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Loading Revenue Chart...</CardTitle>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Loading Distribution Chart...</CardTitle>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Breakdown</CardTitle>
          <p className="text-muted-foreground text-sm">
            Monthly revenue from subscriptions, commissions, and SMS credits
          </p>
        </CardHeader>
        <CardContent>
          <ErrorBoundary level="component">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={safeRevenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={formatCurrency} />
              <Tooltip formatter={(value: number) => [formatCurrency(value), '']} />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="subscription_revenue" 
                stackId="1" 
                stroke="#0088FE" 
                fill="#0088FE" 
                fillOpacity={0.6}
                name="Subscriptions"
              />
              <Area 
                type="monotone" 
                dataKey="commission_revenue" 
                stackId="1" 
                stroke="#00C49F" 
                fill="#00C49F" 
                fillOpacity={0.6}
                name="Commissions"
              />
              <Area 
                type="monotone" 
                dataKey="sms_revenue" 
                stackId="1" 
                stroke="#FFBB28" 
                fill="#FFBB28" 
                fillOpacity={0.6}
                name="SMS Credits"
              />
            </AreaChart>
          </ResponsiveContainer>
          </ErrorBoundary>
        </CardContent>
      </Card>

      {/* Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Plan Distribution</CardTitle>
          <p className="text-muted-foreground text-sm">
            Distribution of landlords across billing plans
          </p>
        </CardHeader>
        <CardContent>
          <ErrorBoundary level="component">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={safeDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(props: any) => `${props.name} ${(props.percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {distributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          </ErrorBoundary>
        </CardContent>
      </Card>

      {/* Total Revenue Line Chart */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Total Revenue Trend</CardTitle>
          <p className="text-muted-foreground text-sm">
            Monthly total revenue growth over time
          </p>
        </CardHeader>
        <CardContent>
          <ErrorBoundary level="component">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={safeRevenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={formatCurrency} />
              <Tooltip formatter={(value: number) => [formatCurrency(value), 'Total Revenue']} />
              <Line 
                type="monotone" 
                dataKey="total_revenue" 
                stroke="#8884d8" 
                strokeWidth={3}
                dot={{ fill: '#8884d8', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#8884d8', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
          </ErrorBoundary>
        </CardContent>
      </Card>
    </div>
  );
};
