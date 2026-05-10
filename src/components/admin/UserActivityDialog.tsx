import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Activity, Clock, User, FileText } from "lucide-react";

interface UserActivityLog {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: any;
  performed_at: string;
}

interface UserActivityDialogProps {
  userId: string;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserActivityDialog({ userId, userName, open, onOpenChange }: UserActivityDialogProps) {
  const [activities, setActivities] = useState<UserActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (open && userId) {
      fetchUserActivity(true);
    }
  }, [open, userId]);

  const fetchUserActivity = async (reset = true) => {
    if (reset) {
      setLoading(true);
      setActivities([]);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const currentOffset = reset ? 0 : activities.length;
      const { data: result, error } = await supabase.functions.invoke('get-user-audit', {
        body: { userId, limit: 25, offset: currentOffset }
      });

      if (error) throw error;

      const response = result as any;
      if (!response?.success) {
        throw new Error(response?.error || "Failed to fetch activity");
      }

      const newLogs = response.logs || [];
      setHasMore(newLogs.length === 25);
      
      if (reset) {
        setActivities(newLogs);
      } else {
        setActivities(prev => [...prev, ...newLogs]);
      }
    } catch (error) {
      console.error('Error fetching user activity:', error);
      toast({
        title: "Error",
        description: "Failed to fetch user activity",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreActivities = () => {
    if (!loadingMore && hasMore) {
      fetchUserActivity(false);
    }
  };

  const getActionBadgeColor = (action: string) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('create') || actionLower.includes('add')) {
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    }
    if (actionLower.includes('update') || actionLower.includes('edit')) {
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    }
    if (actionLower.includes('delete') || actionLower.includes('remove')) {
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    }
    if (actionLower.includes('login') || actionLower.includes('logout')) {
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    }
    return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  };

  const getEntityIcon = (entityType: string | null) => {
    switch (entityType) {
      case 'property':
        return <FileText className="h-4 w-4" />;
      case 'tenant':
        return <User className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const formatActionDescription = (activity: UserActivityLog) => {
    const entityText = activity.entity_type ? ` ${activity.entity_type}` : '';
    return `${activity.action}${entityText}`;
  };

  // Group activities by date
  const groupedActivities = activities.reduce((groups, activity) => {
    const date = format(new Date(activity.performed_at), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {} as Record<string, UserActivityLog[]>);

  const todayActivities = activities.filter(a => {
    const activityDate = new Date(a.performed_at);
    const today = new Date();
    return activityDate.toDateString() === today.toDateString();
  });

  const thisWeekActivities = activities.filter(a => {
    const activityDate = new Date(a.performed_at);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return activityDate > oneWeekAgo;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle className="text-primary">
            Activity Log for {userName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="card-gradient-blue">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white">Total Activities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{activities.length}</div>
              </CardContent>
            </Card>
            <Card className="card-gradient-green">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white">Today</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{todayActivities.length}</div>
              </CardContent>
            </Card>
            <Card className="card-gradient-orange">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white">This Week</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{thisWeekActivities.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Activity Timeline */}
          <div>
            <h3 className="text-lg font-semibold text-primary mb-3">Activity Timeline</h3>
            
            {loading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading activity logs...</p>
              </div>
            ) : Object.keys(groupedActivities).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No activity logs found for this user.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedActivities)
                  .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                  .map(([date, dayActivities]) => (
                    <div key={date} className="space-y-3">
                      <h4 className="text-md font-medium text-primary border-b border-border pb-1">
                        {format(new Date(date), 'EEEE, MMMM dd, yyyy')}
                      </h4>
                      
                      <div className="space-y-2">
                        {dayActivities.map((activity) => (
                          <div key={activity.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                            <div className="mt-1">
                              {getEntityIcon(activity.entity_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={getActionBadgeColor(activity.action)}>
                                  {formatActionDescription(activity)}
                                </Badge>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(activity.performed_at), 'HH:mm:ss')}
                                </div>
                              </div>
                              
                              {activity.details && (
                                <div className="text-sm text-muted-foreground mt-1">
                                  <pre className="whitespace-pre-wrap font-mono text-xs bg-muted/50 p-2 rounded">
                                    {typeof activity.details === 'string' 
                                      ? activity.details 
                                      : JSON.stringify(activity.details, null, 2)
                                    }
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                }
                
                {/* Load More Button */}
                {hasMore && (
                  <div className="text-center pt-4">
                    <Button
                      variant="outline"
                      onClick={loadMoreActivities}
                      disabled={loadingMore}
                      className="w-full"
                    >
                      {loadingMore ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Loading more activities...
                        </>
                      ) : (
                        <>Load More Activities</>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}