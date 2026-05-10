import React from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
import { 
  TrendingUp, 
  Users, 
  Building2, 
  DollarSign, 
  Activity,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw
} from "lucide-react";
import { usePlatformAnalytics } from "@/hooks/usePlatformAnalytics";
import { ErrorBoundary } from '@/components/ErrorBoundary';

const PlatformAnalytics = () => {
  const { analytics, loading, refetch } = usePlatformAnalytics();

  const sanitize = (arr: any[] | undefined) => {
    if (!Array.isArray(arr)) return [];
    return arr.map((r: any) => {
      if (!r || typeof r !== 'object') return {};
      const out: any = {};
      Object.keys(r).forEach((k) => {
        const v = r[k];
        if (v == null) out[k] = 0;
        else if (typeof v === 'string') {
          const num = Number(v.replace(/,/g, ''));
          out[k] = Number.isFinite(num) ? num : v;
        } else out[k] = v;
      });
      return out;
    });
  };

  const safeUserGrowthData = sanitize(analytics?.userGrowthData);
  const safePieData = sanitize((analytics as any)?.planDistribution);
  const safeUserTypeData = sanitize(analytics?.userTypeData);
  const safeBarData = sanitize(analytics?.userGrowthData);
  const safeRevenueData = sanitize(analytics?.revenueData);
  const safeActivityData = sanitize(analytics?.activityData);

  return (
    <DashboardLayout>
      <div className="bg-tint-gray p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-primary">Platform Analytics</h1>
              <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Live Data
              </div>
            </div>
            <p className="text-muted-foreground">
              Real-time insights into platform performance and user behavior
              {analytics?.lastUpdated && (
                <span className="block text-xs mt-1">
                  Last updated: {analytics.lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <Button onClick={refetch} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>

        {/* Key Metrics Overview */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card className="card-gradient-blue hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white">Monthly Active Users</CardTitle>
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <Users className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">
                {loading ? "..." : analytics?.monthlyActiveUsers.toLocaleString() || 0}
              </div>
              <div className="flex items-center gap-1">
                <ArrowUpRight className="h-4 w-4 text-white" />
                <p className="text-sm text-white/90 font-medium">+24% from last month</p>
              </div>
            </CardContent>
          </Card>

          <Card className="card-gradient-green hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white">Property Growth</CardTitle>
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <Building2 className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">
                {loading ? "..." : analytics?.propertyGrowth.toLocaleString() || 0}
              </div>
              <div className="flex items-center gap-1">
                <ArrowUpRight className="h-4 w-4 text-white" />
                <p className="text-sm text-white/90 font-medium">+18% this quarter</p>
              </div>
            </CardContent>
          </Card>

          <Card className="card-gradient-orange hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white">Platform Revenue</CardTitle>
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">
                {loading ? "..." : `KES ${(analytics?.platformRevenue || 0).toLocaleString()}`}
              </div>
              <div className="flex items-center gap-1">
                <ArrowUpRight className="h-4 w-4 text-white" />
                <p className="text-sm text-white/90 font-medium">+32% growth</p>
              </div>
            </CardContent>
          </Card>

          <Card className="card-gradient-navy hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white">Avg Session Time</CardTitle>
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <Activity className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">
                {loading ? "..." : analytics?.avgSessionTime || "14m 32s"}
              </div>
              <div className="flex items-center gap-1">
                <ArrowDownRight className="h-4 w-4 text-white" />
                <p className="text-sm text-white/90 font-medium">-5% this week</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="growth" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="growth" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Growth Analytics
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              User Analytics
            </TabsTrigger>
            <TabsTrigger value="revenue" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Revenue Analytics
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Activity Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="growth">
            <div className="grid gap-6">
              <Card className="bg-card">
                <CardHeader>
                  <CardTitle className="text-primary">Platform Growth Overview</CardTitle>
                  <p className="text-muted-foreground">User and property growth trends over time</p>
                </CardHeader>
                <CardContent>
                  <ErrorBoundary level="component">
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={safeUserGrowthData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="users" stackId="1" stroke="#0088FE" fill="#0088FE" fillOpacity={0.3} />
                      <Area type="monotone" dataKey="properties" stackId="2" stroke="#00C49F" fill="#00C49F" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </ErrorBoundary>
                </CardContent>
              </Card>

              <div className="grid gap-6 md:grid-cols-3">
                <Card className="bg-card">
                  <CardHeader>
                    <CardTitle className="text-primary">Growth Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600 mb-2">
                      {loading ? "..." : `+${analytics?.totalProperties > 10 ? Math.round(((analytics.totalProperties - 10) / 10) * 100) : 0}%`}
                    </div>
                    <p className="text-sm text-muted-foreground">Property growth rate</p>
                  </CardContent>
                </Card>

                <Card className="bg-card">
                  <CardHeader>
                    <CardTitle className="text-primary">Active Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600 mb-2">
                      {loading ? "..." : analytics?.monthlyActiveUsers || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Current active users</p>
                  </CardContent>
                </Card>

                <Card className="bg-card">
                  <CardHeader>
                    <CardTitle className="text-primary">Total Properties</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600 mb-2">
                      {loading ? "..." : analytics?.totalProperties || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Platform properties</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="bg-card">
                <CardHeader>
                  <CardTitle className="text-primary">User Distribution</CardTitle>
                  <p className="text-muted-foreground">Breakdown by user type</p>
                </CardHeader>
                <CardContent>
                  <ErrorBoundary level="component">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={safeUserTypeData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={(props: any) => `${props.name} ${(props.percent * 100).toFixed(0)}%`}
                      >
                        {safeUserTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  </ErrorBoundary>
                </CardContent>
              </Card>

              <Card className="bg-card">
                <CardHeader>
                  <CardTitle className="text-primary">User Acquisition</CardTitle>
                  <p className="text-muted-foreground">New user registrations over time</p>
                </CardHeader>
                <CardContent>
                  <ErrorBoundary level="component">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={safeBarData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="users" fill="#0088FE" />
                    </BarChart>
                  </ResponsiveContainer>
                  </ErrorBoundary>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="revenue">
            <div className="space-y-6">
              <Card className="bg-card">
                <CardHeader>
                  <CardTitle className="text-primary">Revenue Breakdown</CardTitle>
                  <p className="text-muted-foreground">Commission and subscription revenue trends</p>
                </CardHeader>
                <CardContent>
                  <ErrorBoundary level="component">
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={safeRevenueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => [`KES ${value.toLocaleString()}`, '']} />
                      <Legend />
                      <Bar dataKey="commission" stackId="a" fill="#0088FE" name="Commission" />
                      <Bar dataKey="subscriptions" stackId="a" fill="#00C49F" name="Subscriptions" />
                    </BarChart>
                  </ResponsiveContainer>
                  </ErrorBoundary>
                </CardContent>
              </Card>

              <div className="grid gap-6 md:grid-cols-3">
                <Card className="bg-card">
                  <CardHeader>
                    <CardTitle className="text-primary">Total Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600 mb-2">
                      {loading ? "..." : `KES ${(analytics?.platformRevenue || 0).toLocaleString()}`}
                    </div>
                    <p className="text-sm text-muted-foreground">Last 6 months</p>
                  </CardContent>
                </Card>

                <Card className="bg-card">
                  <CardHeader>
                    <CardTitle className="text-primary">Avg Revenue per User</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600 mb-2">
                      {loading ? "..." : `KES ${analytics?.monthlyActiveUsers ? Math.round((analytics.platformRevenue || 0) / analytics.monthlyActiveUsers).toLocaleString() : 0}`}
                    </div>
                    <p className="text-sm text-muted-foreground">Monthly ARPU</p>
                  </CardContent>
                </Card>

                <Card className="bg-card">
                  <CardHeader>
                    <CardTitle className="text-primary">Commission Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600 mb-2">3%</div>
                    <p className="text-sm text-muted-foreground">Platform commission</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="activity">
            <div className="grid gap-6">
              <Card className="bg-card">
                <CardHeader>
                  <CardTitle className="text-primary">Daily Activity Pattern</CardTitle>
                  <p className="text-muted-foreground">Active users throughout the day</p>
                </CardHeader>
                <CardContent>
                  <ErrorBoundary level="component">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={safeActivityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="active" stroke="#0088FE" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                  </ErrorBoundary>
                </CardContent>
              </Card>

              <div className="grid gap-6 md:grid-cols-4">
                <Card className="bg-card">
                  <CardHeader>
                    <CardTitle className="text-primary">Peak Hours</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600 mb-2">
                      {loading ? "..." : "4-6 PM"}
                    </div>
                    <p className="text-sm text-muted-foreground">Highest activity</p>
                  </CardContent>
                </Card>

                <Card className="bg-card">
                  <CardHeader>
                    <CardTitle className="text-primary">Avg Session</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600 mb-2">
                      {loading ? "..." : analytics?.avgSessionTime || "14m 32s"}
                    </div>
                    <p className="text-sm text-muted-foreground">Session duration</p>
                  </CardContent>
                </Card>

                <Card className="bg-card">
                  <CardHeader>
                    <CardTitle className="text-primary">Total Transactions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600 mb-2">
                      {loading ? "..." : analytics?.totalTransactions || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Completed payments</p>
                  </CardContent>
                </Card>

                <Card className="bg-card">
                  <CardHeader>
                    <CardTitle className="text-primary">Total Units</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600 mb-2">
                      {loading ? "..." : analytics?.totalUnits || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Platform units</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default PlatformAnalytics;
