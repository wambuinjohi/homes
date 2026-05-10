import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Shield, Users, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface IntegrityReport {
  duplicate_emails: Array<{
    email: string;
    user_count: number;
    users: Array<{ id: string; name: string }>;
  }>;
  multiple_roles: Array<{
    user_id: string;
    email: string;
    name: string;
    roles: string[];
    role_count: number;
  }>;
  orphaned_roles: Array<{
    user_id: string;
    role: string;
  }>;
  recent_role_changes: Array<{
    user_id: string;
    user_email: string;
    user_name: string;
    old_role: string;
    new_role: string;
    changed_by: string;
    reason: string;
    created_at: string;
  }>;
  generated_at: string;
}

export function DataIntegrityMonitor() {
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchIntegrityReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.rpc('get_data_integrity_report');

      if (error) throw error;

      setReport(data as unknown as IntegrityReport);
    } catch (err) {
      console.error('Error fetching integrity report:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch integrity report');
      toast({
        title: "Error",
        description: "Failed to fetch data integrity report",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrityReport();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Data Integrity Monitor
          </CardTitle>
          <CardDescription>
            Checking system data integrity...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading integrity report...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Data Integrity Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const hasIssues = report && (
    report.duplicate_emails.length > 0 ||
    report.multiple_roles.length > 0 ||
    report.orphaned_roles.length > 0
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Data Integrity Monitor
              </CardTitle>
              <CardDescription>
                System integrity status and audit trail
              </CardDescription>
            </div>
            <Button onClick={fetchIntegrityReport} size="sm" variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasIssues ? (
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>All Clear</AlertTitle>
              <AlertDescription>
                No data integrity issues found. System is healthy.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Issues Detected</AlertTitle>
              <AlertDescription>
                Found {report.duplicate_emails.length + report.multiple_roles.length + report.orphaned_roles.length} data integrity issue(s) that need attention.
              </AlertDescription>
            </Alert>
          )}

          {/* Duplicate Emails */}
          {report && report.duplicate_emails.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-destructive">Duplicate Emails ({report.duplicate_emails.length})</h4>
              {report.duplicate_emails.map((dup, index) => (
                <div key={index} className="p-3 bg-destructive/10 rounded-md">
                  <div className="font-medium">{dup.email}</div>
                  <div className="text-sm text-muted-foreground">
                    {dup.user_count} users: {dup.users.map(u => u.name).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Multiple Roles */}
          {report && report.multiple_roles.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-warning">Users with Multiple Roles ({report.multiple_roles.length})</h4>
              {report.multiple_roles.map((user, index) => (
                <div key={index} className="p-3 bg-warning/10 rounded-md">
                  <div className="font-medium">{user.name} ({user.email})</div>
                  <div className="flex gap-1 mt-1">
                    {user.roles.map(role => (
                      <Badge key={role} variant="secondary">{role}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Orphaned Roles */}
          {report && report.orphaned_roles.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-destructive">Orphaned Roles ({report.orphaned_roles.length})</h4>
              <div className="text-sm text-muted-foreground">
                Roles assigned to non-existent users
              </div>
            </div>
          )}

          {/* Recent Role Changes */}
          {report && report.recent_role_changes.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                Recent Role Changes ({report.recent_role_changes.length})
              </h4>
              <div className="space-y-2">
                {report.recent_role_changes.slice(0, 5).map((change, index) => (
                  <div key={index} className="p-2 bg-muted rounded-md text-sm">
                    <div className="font-medium">{change.user_name} ({change.user_email})</div>
                    <div className="text-muted-foreground">
                      {change.old_role} → {change.new_role} • {new Date(change.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {report && (
            <div className="text-xs text-muted-foreground">
              Last updated: {new Date(report.generated_at).toLocaleString()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
