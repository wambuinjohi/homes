import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, DollarSign, AlertTriangle } from "lucide-react";

// Sample data - in a real app, this would come from your database
const monthlyRevenueData = [
  { month: "Jan", revenue: 245000, target: 250000 },
  { month: "Feb", revenue: 238000, target: 250000 },
  { month: "Mar", revenue: 252000, target: 250000 },
  { month: "Apr", revenue: 248000, target: 250000 },
  { month: "May", revenue: 265000, target: 250000 },
  { month: "Jun", revenue: 248000, target: 250000 },
];

const occupancyData = [
  { name: "Occupied", value: 142, color: "#4CAF50" },
  { name: "Vacant", value: 14, color: "#FBAF3D" },
];

const collectionsData = [
  { status: "Collected", amount: 235000, color: "#4CAF50" },
  { status: "Pending", amount: 13000, color: "#FBAF3D" },
  { status: "Overdue", amount: 8000, color: "#E53935" },
];

const maintenanceData = [
  { priority: "Urgent", count: 8, color: "#E53935" },
  { priority: "High", count: 6, color: "#FBAF3D" },
  { priority: "Normal", count: 9, color: "#4CAF50" },
];

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "#3AA6FF",
  },
  target: {
    label: "Target",
    color: "#1B2B3C",
  },
};

export function ChartsSection() {
  const totalExpectedRevenue = collectionsData.reduce((sum, item) => sum + item.amount, 0);
  
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Monthly Revenue Trend */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <CardTitle>Monthly Revenue</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyRevenueData}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                <XAxis 
                  dataKey="month" 
                  className="text-xs"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  className="text-xs"
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  formatter={(value, name) => [`$${value.toLocaleString()}`, name === "revenue" ? "Revenue" : "Target"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3B82F6"
                  strokeWidth={3}
                  fill="url(#revenueGradient)"
                  dot={{ fill: "#3B82F6", strokeWidth: 2, r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            <CardTitle>Performance Summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="font-medium text-green-800">Occupancy Rate</span>
              <span className="text-lg font-bold text-green-600">91%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span className="font-medium text-blue-800">Collection Rate</span>
              <span className="text-lg font-bold text-blue-600">95%</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
              <span className="font-medium text-purple-800">Avg. Rent/Unit</span>
              <span className="text-lg font-bold text-purple-600">$1,590</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
              <span className="font-medium text-orange-800">Maintenance Cost</span>
              <span className="text-lg font-bold text-orange-600">$12,450</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Collections Status - Stacked Progress Bar */}
      <Card className="col-span-full lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              <CardTitle>Collections Status</CardTitle>
            </div>
            <div className="text-sm text-muted-foreground">
              Expected: ${totalExpectedRevenue.toLocaleString()}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Stacked Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
              <div className="h-full flex">
                {collectionsData.map((item, index) => (
                  <div
                    key={item.status}
                    className="h-full flex items-center justify-center text-xs font-medium text-white"
                    style={{
                      backgroundColor: item.color,
                      width: `${(item.amount / totalExpectedRevenue) * 100}%`,
                    }}
                  >
                    {(item.amount / totalExpectedRevenue) * 100 > 15 && (
                      `${Math.round((item.amount / totalExpectedRevenue) * 100)}%`
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Legend and Details */}
            <div className="grid grid-cols-3 gap-4">
              {collectionsData.map((item) => (
                <div key={item.status} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-medium">{item.status}</span>
                  </div>
                  <span className="text-sm font-bold">${item.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Requests by Priority */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            <CardTitle>Maintenance by Priority</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {maintenanceData.map((item) => (
              <div key={item.priority} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium">{item.priority}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-300"
                      style={{ 
                        backgroundColor: item.color,
                        width: `${(item.count / Math.max(...maintenanceData.map(d => d.count))) * 100}%`
                      }}
                    />
                  </div>
                  <span className="text-sm font-bold min-w-[2rem]">{item.count}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}