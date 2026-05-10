import React from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Building2, 
  DollarSign, 
  TrendingUp, 
  Activity,
  AlertCircle,
  Shield,
  Database,
  RefreshCw
} from "lucide-react";
import { useAdminDashboardStats } from "@/hooks/useAdminDashboardStats";
import { formatAmount } from "@/utils/currency";

const AdminDashboard = () => {
  const { stats, loading, refetch } = useAdminDashboardStats();
  return (
    <DashboardLayout>
      <div className="bg-tint-gray p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">Super Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Platform-wide oversight and system administration
            </p>
          </div>
          <Button onClick={refetch} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>
        
        {/* Platform-wide KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-6 md:grid-cols-4">
          <Card className="card-gradient-blue hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl min-h-[120px] sm:min-h-[140px] lg:min-h-[160px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 p-4 lg:p-6">
              <CardTitle className="text-sm font-semibold text-white">Total Users</CardTitle>
              <div className="p-2.5 lg:p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <Users className="h-5 w-5 lg:h-6 lg:w-6 text-white" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 lg:p-6">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1">
                {loading ? "..." : stats?.totalUsers.toLocaleString() || 0}
              </div>
              <p className="text-sm text-white/90 font-medium">Platform wide</p>
            </CardContent>
          </Card>

          <Card className="card-gradient-green hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl min-h-[120px] sm:min-h-[140px] lg:min-h-[160px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 p-4 lg:p-6">
              <CardTitle className="text-sm font-semibold text-white">Total Properties</CardTitle>
              <div className="p-2.5 lg:p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <Building2 className="h-5 w-5 lg:h-6 lg:w-6 text-white" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 lg:p-6">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1">
                {loading ? "..." : stats?.totalProperties.toLocaleString() || 0}
              </div>
              <p className="text-sm text-white/90 font-medium">All properties</p>
            </CardContent>
          </Card>

          <Card className="card-gradient-orange hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl min-h-[120px] sm:min-h-[140px] lg:min-h-[160px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 p-4 lg:p-6">
              <CardTitle className="text-sm font-semibold text-white">Platform Revenue</CardTitle>
              <div className="p-2.5 lg:p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <DollarSign className="h-5 w-5 lg:h-6 lg:w-6 text-white" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 lg:p-6">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1">
                {loading ? "..." : formatAmount(stats?.platformRevenue || 0)}
              </div>
              <p className="text-sm text-white/90 font-medium">This month</p>
            </CardContent>
          </Card>

          <Card className="card-gradient-navy hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl min-h-[120px] sm:min-h-[140px] lg:min-h-[160px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 p-4 lg:p-6">
              <CardTitle className="text-sm font-semibold text-white">Growth Rate</CardTitle>
              <div className="p-2.5 lg:p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <TrendingUp className="h-5 w-5 lg:h-6 lg:w-6 text-white" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 lg:p-6">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1">
                {loading ? "..." : `+${stats?.growthRate || 0}%`}
              </div>
              <p className="text-sm text-white/90 font-medium">Monthly growth</p>
            </CardContent>
          </Card>
        </div>

        {/* System Health Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-6 md:grid-cols-4">
          <Card className="card-gradient-green hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl min-h-[120px] sm:min-h-[140px] lg:min-h-[160px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 p-4 lg:p-6">
              <CardTitle className="text-sm font-semibold text-white">System Health</CardTitle>
              <div className="p-2.5 lg:p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <Activity className="h-5 w-5 lg:h-6 lg:w-6 text-white" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 lg:p-6">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1">
                {loading ? "..." : `${stats?.systemHealth || 99.8}%`}
              </div>
              <p className="text-sm text-white/90 font-medium">Uptime</p>
            </CardContent>
          </Card>

          <Card className="card-gradient-orange hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl min-h-[120px] sm:min-h-[140px] lg:min-h-[160px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 p-4 lg:p-6">
              <CardTitle className="text-sm font-semibold text-white">Active Sessions</CardTitle>
              <div className="p-2.5 lg:p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <Shield className="h-5 w-5 lg:h-6 lg:w-6 text-white" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 lg:p-6">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1">
                {loading ? "..." : stats?.activeSessions.toLocaleString() || 0}
              </div>
              <p className="text-sm text-white/90 font-medium">Active users</p>
            </CardContent>
          </Card>

          <Card className="card-gradient-red hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl min-h-[120px] sm:min-h-[140px] lg:min-h-[160px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 p-4 lg:p-6">
              <CardTitle className="text-sm font-semibold text-white">System Alerts</CardTitle>
              <div className="p-2.5 lg:p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <AlertCircle className="h-5 w-5 lg:h-6 lg:w-6 text-white" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 lg:p-6">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1">
                {loading ? "..." : stats?.systemAlerts || 0}
              </div>
              <p className="text-sm text-white/90 font-medium">Require attention</p>
            </CardContent>
          </Card>

          <Card className="card-gradient-purple hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl min-h-[120px] sm:min-h-[140px] lg:min-h-[160px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 p-4 lg:p-6">
              <CardTitle className="text-sm font-semibold text-white">Database Size</CardTitle>
              <div className="p-2.5 lg:p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <Database className="h-5 w-5 lg:h-6 lg:w-6 text-white" />
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 lg:p-6">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-1">
                {loading ? "..." : stats?.databaseSize || "2.4GB"}
              </div>
              <p className="text-sm text-white/90 font-medium">Total storage</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Access Admin Actions */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="text-primary">Recent Admin Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg animate-pulse">
                        <div className="space-y-2">
                          <div className="h-4 bg-muted rounded w-32"></div>
                          <div className="h-3 bg-muted rounded w-48"></div>
                        </div>
                        <div className="h-3 bg-muted rounded w-16"></div>
                      </div>
                    ))}
                  </div>
                ) : stats?.recentActions?.length ? (
                  stats.recentActions.map((action) => (
                    <div key={action.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{action.action}</p>
                        <p className="text-sm text-muted-foreground">{action.description}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{action.timestamp}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No recent actions</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="text-primary">System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center justify-between animate-pulse">
                        <div className="h-4 bg-muted rounded w-32"></div>
                        <div className="h-4 bg-muted rounded w-20"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span>Database Status</span>
                      <span className="text-green-500 font-medium">{stats?.systemStatus.database}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>API Response Time</span>
                      <span className="text-green-500 font-medium">{stats?.systemStatus.apiResponseTime}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Storage Usage</span>
                      <span className="text-yellow-500 font-medium">{stats?.systemStatus.storageUsage}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Backup Status</span>
                      <span className="text-green-500 font-medium">{stats?.systemStatus.backupStatus}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Security Scans</span>
                      <span className="text-green-500 font-medium">{stats?.systemStatus.securityScans}</span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;