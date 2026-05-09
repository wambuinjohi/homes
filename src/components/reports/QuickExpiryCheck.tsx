import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  AlertTriangle, 
  Eye, 
  ArrowRight,
  Building2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ExpiryData {
  count: number;
  leases: Array<{
    property_name: string;
    unit_number: string;
    tenant_name: string;
    lease_end_date: string;
    days_until_expiry: number;
  }>;
}

interface QuickExpiryCheckProps {
  onViewDetails: () => void;
  hideWhenEmpty?: boolean;
}

export function QuickExpiryCheck({ onViewDetails, hideWhenEmpty = false }: QuickExpiryCheckProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState(90);
  const [expiryData, setExpiryData] = useState<ExpiryData>({ count: 0, leases: [] });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const timeframes = [
    { days: 30, label: "30 days" },
    { days: 60, label: "60 days" }, 
    { days: 90, label: "90 days" },
    { days: 180, label: "180 days" }
  ];

  useEffect(() => {
    const fetchExpiryData = async () => {
      setLoading(true);
      try {
        const startDate = new Date().toISOString().split('T')[0];
        const endDate = new Date(Date.now() + selectedTimeframe * 24 * 60 * 60 * 1000)
          .toISOString().split('T')[0];

        const { data, error } = await (supabase as any)
          .rpc('get_lease_expiry_report', {
            p_start_date: startDate,
            p_end_date: endDate
          });

        if (error) throw error;

        // Safely parse the JSON response
        let reportData = data as any;
        let rawLeases = Array.isArray(reportData?.table) ? reportData.table : [];

        // Fallback via client-side queries if RPC returned empty due to RLS
        if (!Array.isArray(rawLeases) || rawLeases.length === 0) {
          const { data, error } = await (supabase as any)
            .from('leases')
            .select('lease_end_date, tenants:tenants!leases_tenant_id_fkey(first_name,last_name), units:units!leases_unit_id_fkey(unit_number, properties:properties!units_property_id_fkey(name))')
            .gte('lease_end_date', startDate)
            .lte('lease_end_date', endDate);
          if (!error && Array.isArray(data)) {
            rawLeases = data.map((l: any) => ({
              property_name: l.units?.properties?.name,
              unit_number: l.units?.unit_number,
              tenant_name: `${l.tenants?.first_name || ''} ${l.tenants?.last_name || ''}`.trim(),
              lease_end_date: l.lease_end_date
            }));
          }
        }

        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        let leases = rawLeases
          .map((l: any) => {
            const end = l?.lease_end_date ? new Date(l.lease_end_date) : null;
            const days = end ? Math.max(0, Math.ceil((end.getTime() - startOfToday.getTime()) / (1000*60*60*24))) : 0;
            return {
              property_name: l.property_name || l.property || '',
              unit_number: l.unit_number || l.unit || '',
              tenant_name: l.tenant_name || `${l.first_name || ''} ${l.last_name || ''}`.trim(),
              lease_end_date: l.lease_end_date,
              days_until_expiry: days
            };
          })
          .filter((l: any) => l.days_until_expiry >= 0 && l.days_until_expiry <= selectedTimeframe);


        leases.sort((a: any, b: any) => a.days_until_expiry - b.days_until_expiry);
        const count = leases.length;
        setExpiryData({ count, leases });
      } catch (error) {
        console.error('Error fetching expiry data:', error);
        setExpiryData({ count: 0, leases: [] });
      } finally {
        setLoading(false);
      }
    };

    fetchExpiryData();
  }, [selectedTimeframe]);

  const urgentCount = expiryData.leases.filter(lease => lease.days_until_expiry <= 30).length;

  // Hide card when empty if hideWhenEmpty prop is true
  if (hideWhenEmpty && !loading && expiryData.count === 0) {
    return null;
  }

  return (
    <Card className="border-warning/20 bg-gradient-to-r from-warning/5 to-orange-500/5">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-warning" />
            <span className="text-foreground">Lease Expiry Check</span>
          </div>
          {urgentCount > 0 && (
            <Badge variant="destructive" className="bg-destructive text-destructive-foreground">
              {urgentCount} urgent
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Timeframe Chips */}
        <div className="flex flex-wrap gap-2">
          {timeframes.map((timeframe) => (
            <Button
              key={timeframe.days}
              variant={selectedTimeframe === timeframe.days ? "default" : "outline"}
              size="sm"
              className={cn(
                "text-xs",
                selectedTimeframe === timeframe.days 
                  ? "bg-warning text-warning-foreground hover:bg-warning/90" 
                  : "border-warning/30 text-warning hover:bg-warning/10"
              )}
              onClick={() => setSelectedTimeframe(timeframe.days)}
            >
              {timeframe.label}
            </Button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 bg-muted/20 rounded animate-pulse" />
            <div className="h-4 bg-muted/20 rounded animate-pulse w-2/3" />
          </div>
        ) : expiryData.count > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {expiryData.count}
                </div>
                <p className="text-sm text-muted-foreground">
                  lease{expiryData.count !== 1 ? 's' : ''} expiring in {selectedTimeframe} days
                </p>
              </div>
            </div>
            
            {/* Quick preview of urgent leases */}
            {urgentCount > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-medium text-destructive">
                    {urgentCount} lease{urgentCount !== 1 ? 's' : ''} expiring within 30 days
                  </span>
                </div>
                {expiryData.leases
                  .filter(lease => lease.days_until_expiry <= 30)
                  .slice(0, 2)
                  .map((lease, idx) => (
                    <div key={idx} className="text-xs text-muted-foreground">
                      {lease.property_name} - Unit {lease.unit_number} ({lease.days_until_expiry} days)
                    </div>
                  ))}
              </div>
            )}

            <Button 
              variant="outline" 
              className="w-full border-warning text-warning hover:bg-warning hover:text-warning-foreground"
              onClick={onViewDetails}
            >
              <Eye className="h-4 w-4 mr-2" />
              View All Details
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <Calendar className="h-6 w-6 text-success" />
              </div>
              <div>
                <div className="text-lg font-semibold text-foreground">
                  No leases expiring soon
                </div>
                <p className="text-sm text-muted-foreground">
                  All clear for the next {selectedTimeframe} days
                </p>
              </div>
            </div>

            {/* Empty state suggestions */}
            <div className="space-y-3 p-4 bg-muted/20 rounded-lg">
              <p className="text-sm text-muted-foreground">Quick actions:</p>
              <div className="flex flex-wrap gap-2">
                {selectedTimeframe < 180 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setSelectedTimeframe(180)}
                  >
                    Try 180 days
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => navigate('/leases')}
                >
                  <Building2 className="h-3 w-3 mr-1" />
                  Go to Leases
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
