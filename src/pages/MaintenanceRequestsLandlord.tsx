import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/context/RoleContext";
import { toast } from "sonner";
import { sendMaintenanceNotification } from "@/utils/notifications";
import { FeatureGate } from "@/components/ui/feature-gate";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";
import { TablePaginator } from "@/components/ui/table-paginator";
import { 
  Wrench, Search, Filter, Eye, Calendar, AlertTriangle, Clock, CheckCircle, 
  MessageSquare, Image as ImageIcon, User, Settings, Bell, Mail, 
  Phone, Calendar as CalendarIcon, MapPin, FileText, History,
  AlertCircle, CheckCheck, XCircle, Play, MoreHorizontal, 
  ArrowRight, Timer, Ban, RotateCcw
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ServiceProviderManagement } from "@/components/maintenance/ServiceProviderManagement";

interface ServiceProvider {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  specialties: string[];
  is_active: boolean;
}

interface MaintenanceNote {
  id: string;
  note: string;
  user_id: string;
  is_internal: boolean;
  created_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
  };
}

interface MaintenanceActionLog {
  id: string;
  action_type: string;
  old_value?: string;
  new_value?: string;
  details?: any;
  created_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
  };
}

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  category: string;
  submitted_date: string;
  scheduled_date?: string;
  completed_date?: string;
  cost?: number;
  tenant_id: string;
  property_id: string;
  unit_id?: string;
  assigned_to?: string;
  images: string[];
  internal_notes?: string;
  last_updated_by?: string;
  last_status_change: string;
  tenants?: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  properties?: {
    name: string;
  };
  units?: {
    unit_number: string;
  };
  service_providers?: ServiceProvider;
  notes?: MaintenanceNote[];
  action_logs?: MaintenanceActionLog[];
}

const MaintenanceRequestsLandlord = () => {
  const { user } = useAuth();
  const { isSubUser, landlordId } = useRole();
  const targetId = (isSubUser && landlordId) ? landlordId : user?.id;
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterProperty, setFilterProperty] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [properties, setProperties] = useState<any[]>([]);
  const [rejectReason, setRejectReason] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const { page, pageSize, offset, setPage, setPageSize } = useUrlPageParam({ pageSize: 10 });

  // API Keys placeholder notice
  const [showApiKeyNotice, setShowApiKeyNotice] = useState(true);

  const fetchMaintenanceRequests = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // First, get properties owned/managed by the current user
      const { data: userProperties, error: propertiesError } = await supabase
        .from("properties")
        .select("id, name")
        .or(`owner_id.eq.${targetId},manager_id.eq.${targetId}`);

      if (propertiesError) throw propertiesError;
      
      setProperties(userProperties || []);
      
      if (!userProperties || userProperties.length === 0) {
        setRequests([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      const propertyIds = userProperties.map(p => p.id);

      // Build maintenance requests query with filters and pagination
      let query = supabase
        .from("maintenance_requests")
        .select("*", { count: 'exact' })
        .in("property_id", propertyIds);

      // Apply search filter
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      // Apply status filter
      if (filterStatus !== "all") {
        query = query.eq('status', filterStatus);
      }

      // Apply priority filter
      if (filterPriority !== "all") {
        query = query.eq('priority', filterPriority);
      }

      // Apply property filter
      if (filterProperty !== "all") {
        query = query.eq('property_id', filterProperty);
      }

      // Apply category filter
      if (filterCategory !== "all") {
        query = query.eq('category', filterCategory);
      }

      // Apply date range filter
      if (dateRange.from && dateRange.to) {
        query = query.gte('submitted_date', dateRange.from).lte('submitted_date', dateRange.to);
      }

      // Apply pagination and ordering
      const { data: maintenanceRequests, error: requestsError, count } = await query
        .range(offset, offset + pageSize - 1)
        .order("submitted_date", { ascending: false });

      if (requestsError) throw requestsError;
      setTotalCount(count || 0);

      if (!maintenanceRequests || maintenanceRequests.length === 0) {
        setRequests([]);
        setLoading(false);
        return;
      }

      // Get related data
      const tenantIds = [...new Set(maintenanceRequests.map(req => req.tenant_id).filter(Boolean))];
      const unitIds = [...new Set(maintenanceRequests.map(req => req.unit_id).filter(Boolean))];
      const serviceProviderIds = [...new Set(maintenanceRequests.map(req => req.assigned_to).filter(Boolean))];

      const [tenantsData, unitsData, serviceProvidersData, notesData, actionLogsData] = await Promise.all([
        tenantIds.length > 0 ? supabase
          .from("tenants")
          .select("id, first_name, last_name, email, phone")
          .in("id", tenantIds) : Promise.resolve({ data: [] }),
        unitIds.length > 0 ? supabase
          .from("units")
          .select("id, unit_number")
          .in("id", unitIds) : Promise.resolve({ data: [] }),
        serviceProviderIds.length > 0 ? supabase
          .from("service_providers")
          .select("*")
          .in("id", serviceProviderIds) : Promise.resolve({ data: [] }),
        supabase
          .from("maintenance_notes")
          .select(`
            *,
            profiles:user_id (
              first_name,
              last_name
            )
          `)
          .in("maintenance_request_id", maintenanceRequests.map(r => r.id)),
        supabase
          .from("maintenance_action_logs")
          .select(`
            *,
            profiles:user_id (
              first_name,
              last_name
            )
          `)
          .in("maintenance_request_id", maintenanceRequests.map(r => r.id))
          .order("created_at", { ascending: false })
      ]);

      // Create lookup maps
      const tenantsMap = new Map((tenantsData.data || []).map(t => [t.id, t]));
      const propertiesMap = new Map((userProperties || []).map(p => [p.id, p]));
      const unitsMap = new Map((unitsData.data || []).map(u => [u.id, u]));
      const serviceProvidersMap = new Map((serviceProvidersData.data || []).map(sp => [sp.id, sp]));
      
      // Group notes and logs by maintenance request ID
      const notesMap = new Map();
      const logsMap = new Map();
      
      (notesData.data || []).forEach(note => {
        if (!notesMap.has(note.maintenance_request_id)) {
          notesMap.set(note.maintenance_request_id, []);
        }
        notesMap.get(note.maintenance_request_id).push(note);
      });
      
      (actionLogsData.data || []).forEach(log => {
        if (!logsMap.has(log.maintenance_request_id)) {
          logsMap.set(log.maintenance_request_id, []);
        }
        logsMap.get(log.maintenance_request_id).push(log);
      });

      // Transform the data
      const transformedRequests: MaintenanceRequest[] = maintenanceRequests.map(req => ({
        ...req,
        tenants: tenantsMap.get(req.tenant_id),
        properties: propertiesMap.get(req.property_id),
        units: req.unit_id ? unitsMap.get(req.unit_id) : undefined,
        service_providers: req.assigned_to ? serviceProvidersMap.get(req.assigned_to) : undefined,
        notes: notesMap.get(req.id) || [],
        action_logs: logsMap.get(req.id) || [],
      }));

      setRequests(transformedRequests);
    } catch (error: any) {
      console.error("Error fetching maintenance requests:", error);
      toast.error("Failed to fetch maintenance requests");
    } finally {
      setLoading(false);
    }
  };

  const fetchServiceProviders = async () => {
    try {
      const { data, error } = await supabase
        .from("service_providers")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setServiceProviders(data || []);
    } catch (error) {
      console.error("Error fetching service providers:", error);
    }
  };

  useEffect(() => {
    fetchMaintenanceRequests();
    fetchServiceProviders();
  }, [user, page, pageSize, searchTerm, filterStatus, filterPriority, filterProperty, filterCategory, dateRange]);

  const handleStatusChange = async (requestId: string, newStatus: string, oldStatus: string) => {
    try {
      const request = requests.find(r => r.id === requestId);
      if (!request) return;

      // Update in database
      const { error } = await supabase
        .from("maintenance_requests")
        .update({ 
          status: newStatus, 
          last_updated_by: user?.id,
          last_status_change: new Date().toISOString(),
          ...(newStatus === 'resolved' && { completed_date: new Date().toISOString() })
        })
        .eq("id", requestId);

      if (error) throw error;

      // Update local state immediately for better UX
      setRequests(prevRequests => 
        prevRequests.map(req => 
          req.id === requestId 
            ? { ...req, status: newStatus, last_status_change: new Date().toISOString() }
            : req
        )
      );

      // Log the action
      await supabase.rpc("log_maintenance_action", {
        _maintenance_request_id: requestId,
        _user_id: user?.id,
        _action_type: "status_change",
        _old_value: oldStatus,
        _new_value: newStatus
      });

      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
      
      // Refresh data from server
      await fetchMaintenanceRequests();

    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
      // Refresh on error to ensure consistency
      await fetchMaintenanceRequests();
    }
  };

  const handleAssignServiceProvider = async (requestId: string, serviceProviderId: string) => {
    try {
      const request = requests.find(r => r.id === requestId);
      if (!request) return;

      const { error } = await supabase
        .from("maintenance_requests")
        .update({ 
          assigned_to: serviceProviderId,
          last_updated_by: user?.id 
        })
        .eq("id", requestId);

      if (error) throw error;

      // Log the action
      const serviceProvider = serviceProviders.find(sp => sp.id === serviceProviderId);
      await supabase.rpc("log_maintenance_action", {
        _maintenance_request_id: requestId,
        _user_id: user?.id,
        _action_type: "assignment",
        _new_value: serviceProvider?.name || serviceProviderId
      });

      toast.success("Service provider assigned successfully");
      fetchMaintenanceRequests();

      // Send notification to tenant about assignment
      if (serviceProvider) {
        try {
          await sendMaintenanceNotification({
            maintenance_request_id: requestId,
            notification_type: "assignment",
            tenant_id: request.tenant_id,
            service_provider_name: serviceProvider.name
          });
          
          if (!showApiKeyNotice) {
            toast.success("Tenant notified about assignment");
          }
        } catch (notificationError) {
          console.error("Failed to send assignment notification:", notificationError);
          if (!showApiKeyNotice) {
            toast.error("Failed to notify tenant about assignment");
          }
        }
      }

    } catch (error: any) {
      console.error("Error assigning service provider:", error);
      toast.error("Failed to assign service provider");
    }
  };

  const handleAddNote = async (requestId: string, note: string, isInternal: boolean = true) => {
    if (!note.trim()) return;

    try {
      const { error } = await supabase
        .from("maintenance_notes")
        .insert({
          maintenance_request_id: requestId,
          user_id: user?.id,
          note: note.trim(),
          is_internal: isInternal
        });

      if (error) throw error;

      // Log the action
      await supabase.rpc("log_maintenance_action", {
        _maintenance_request_id: requestId,
        _user_id: user?.id,
        _action_type: "note_added",
        _new_value: isInternal ? "Internal note" : "Public note"
      });

      toast.success("Note added successfully");
      setNewNote("");
      fetchMaintenanceRequests();

    } catch (error: any) {
      console.error("Error adding note:", error);
      toast.error("Failed to add note");
    }
  };

  // No client-side filtering needed since we're doing server-side pagination
  const filteredRequests = requests;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-warning text-warning-foreground";
      case "in_review":
        return "bg-info text-info-foreground";
      case "assigned":
        return "bg-accent text-accent-foreground";
      case "in_progress":
        return "bg-primary text-primary-foreground";
      case "completed":
      case "resolved":
        return "bg-success text-success-foreground";
      case "rejected":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-destructive text-destructive-foreground";
      case "medium":
        return "bg-warning text-warning-foreground";
      case "low":
        return "bg-success text-success-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "in_progress":
        return <Play className="h-4 w-4" />;
      case "resolved":
      case "completed":
        return <CheckCircle className="h-4 w-4" />;
      case "rejected":
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  // Get next logical status options based on current status
  const getStatusWorkflow = (currentStatus: string) => {
    switch (currentStatus) {
      case "pending":
        return [
          { status: "in_review", label: "Review", icon: <Eye className="h-4 w-4" />, color: "bg-blue-500 hover:bg-blue-600" },
          { status: "rejected", label: "Reject", icon: <XCircle className="h-4 w-4" />, color: "bg-red-500 hover:bg-red-600" },
        ];
      case "in_review":
        return [
          { status: "assigned", label: "Assign", icon: <User className="h-4 w-4" />, color: "bg-purple-500 hover:bg-purple-600" },
          { status: "in_progress", label: "Start Work", icon: <Play className="h-4 w-4" />, color: "bg-blue-500 hover:bg-blue-600" },
          { status: "rejected", label: "Reject", icon: <XCircle className="h-4 w-4" />, color: "bg-red-500 hover:bg-red-600" },
        ];
      case "assigned":
        return [
          { status: "in_progress", label: "Start Work", icon: <Play className="h-4 w-4" />, color: "bg-blue-500 hover:bg-blue-600" },
          { status: "pending", label: "Back to Pending", icon: <RotateCcw className="h-4 w-4" />, color: "bg-yellow-500 hover:bg-yellow-600" },
        ];
      case "in_progress":
        return [
          { status: "resolved", label: "Resolve", icon: <CheckCircle className="h-4 w-4" />, color: "bg-green-500 hover:bg-green-600" },
          { status: "assigned", label: "Back to Assigned", icon: <RotateCcw className="h-4 w-4" />, color: "bg-purple-500 hover:bg-purple-600" },
        ];
      case "resolved":
        return [
          { status: "in_progress", label: "Reopen", icon: <RotateCcw className="h-4 w-4" />, color: "bg-blue-500 hover:bg-blue-600" },
        ];
      case "rejected":
        return [
          { status: "pending", label: "Reconsider", icon: <RotateCcw className="h-4 w-4" />, color: "bg-yellow-500 hover:bg-yellow-600" },
        ];
      default:
        return [];
    }
  };

  // Check if request is overdue
  const isOverdue = (request: MaintenanceRequest) => {
    const daysSinceSubmission = Math.floor((Date.now() - new Date(request.submitted_date).getTime()) / (1000 * 60 * 60 * 24));
    if (request.priority === "high" && daysSinceSubmission > 1) return true;
    if (request.priority === "medium" && daysSinceSubmission > 3) return true;
    if (request.priority === "low" && daysSinceSubmission > 7) return true;
    return false;
  };

  const toggleRowExpansion = (requestId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(requestId)) {
      newExpanded.delete(requestId);
    } else {
      newExpanded.add(requestId);
    }
    setExpandedRows(newExpanded);
  };

  // Quick Actions Component for table rows
  const QuickActions = ({ request }: { request: MaintenanceRequest }) => {
    const workflowOptions = getStatusWorkflow(request.status);
    
    return (
      <div className="flex items-center gap-2">
        {/* Quick status action buttons */}
        {workflowOptions.slice(0, 1).map((option) => (
          <AlertDialog key={option.status}>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                className={`text-white ${option.color} border-0`}
              >
                {option.icon}
                <span className="ml-1 hidden sm:inline">{option.label}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to change the status of "{request.title}" from{" "}
                  <strong>{request.status.replace('_', ' ')}</strong> to{" "}
                  <strong>{option.status.replace('_', ' ')}</strong>?
                  {option.status === 'completed' && " This will notify the tenant that the work is complete."}
                  {option.status === 'rejected' && " This will notify the tenant that the request has been rejected."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleStatusChange(request.id, option.status, request.status)}
                  className={option.color}
                >
                  {option.icon}
                  <span className="ml-2">Confirm {option.label}</span>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ))}
        
        {/* More actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onClick={() => {
                setSelectedRequest(request);
                setDetailsOpen(true);
              }}
            >
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Change Status To:
            </div>
            
            {workflowOptions.map((option) => (
              <AlertDialog key={option.status}>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    {option.icon}
                    <span className="ml-2">{option.label}</span>
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to change the status of "{request.title}" to{" "}
                      <strong>{option.status.replace('_', ' ')}</strong>?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleStatusChange(request.id, option.status, request.status)}
                      className={option.color}
                    >
                      Confirm
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ))}
            
            <DropdownMenuSeparator />
            
            {!request.assigned_to && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Quick Assign:
                </div>
                {serviceProviders.slice(0, 3).map((provider) => (
                  <DropdownMenuItem
                    key={provider.id}
                    onClick={() => handleAssignServiceProvider(request.id, provider.id)}
                  >
                    <User className="h-4 w-4 mr-2" />
                    {provider.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            )}
            
            <DropdownMenuItem
              onClick={() => {
                setSelectedRequest(request);
                setDetailsOpen(true);
              }}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Add Note
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const RequestDetailsDialog = ({ request }: { request: MaintenanceRequest }) => (
    <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            {request.title}
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="details" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="notes">Notes ({request.notes?.length || 0})</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Request Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Request Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Description</label>
                    <p className="mt-1">{request.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Priority</label>
                      <Badge className={`mt-1 ${getPriorityColor(request.priority)}`}>
                        {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
                      </Badge>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`${getStatusColor(request.status)}`}>
                          {getStatusIcon(request.status)}
                          <span className="ml-1">{request.status.replace('_', ' ').charAt(0).toUpperCase() + request.status.replace('_', ' ').slice(1)}</span>
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Category</label>
                    <p className="mt-1 capitalize">{request.category}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Submitted</label>
                    <p className="mt-1">{format(new Date(request.submitted_date), "PPP 'at' p")}</p>
                  </div>
                  {request.scheduled_date && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Scheduled</label>
                      <p className="mt-1">{format(new Date(request.scheduled_date), "PPP 'at' p")}</p>
                    </div>
                  )}
                  {request.completed_date && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Completed</label>
                      <p className="mt-1">{format(new Date(request.completed_date), "PPP 'at' p")}</p>
                    </div>
                  )}
                  {request.cost && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Cost</label>
                      <p className="mt-1 font-semibold">KES {request.cost.toLocaleString()}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tenant Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Tenant Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Name</label>
                    <p className="mt-1">{request.tenants?.first_name} {request.tenants?.last_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p className="mt-1">{request.tenants?.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <p className="mt-1">{request.tenants?.phone || "Not provided"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Property</label>
                    <p className="mt-1">{request.properties?.name}</p>
                  </div>
                  {request.units && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Unit</label>
                      <p className="mt-1">{request.units.unit_number}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Assignment and Images */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Service Provider Assignment */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Service Provider</CardTitle>
                </CardHeader>
                <CardContent>
                  {request.service_providers ? (
                    <div className="space-y-2">
                      <p className="font-medium">{request.service_providers.name}</p>
                      {request.service_providers.email && (
                        <p className="text-sm text-muted-foreground">📧 {request.service_providers.email}</p>
                      )}
                      {request.service_providers.phone && (
                        <p className="text-sm text-muted-foreground">📞 {request.service_providers.phone}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {request.service_providers.specialties.map((specialty, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {specialty}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Not assigned</p>
                  )}
                </CardContent>
              </Card>

              {/* Images */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Images
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {request.images && request.images.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {request.images.map((image, index) => (
                        <img
                          key={index}
                          src={image}
                          alt={`Request image ${index + 1}`}
                          className="w-full h-20 object-cover rounded-md border"
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No images uploaded</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="notes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Add New Note</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Add internal note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="min-h-[100px]"
                />
                <Button 
                  onClick={() => handleAddNote(request.id, newNote)}
                  disabled={!newNote.trim()}
                  className="w-full"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Add Internal Note
                </Button>
              </CardContent>
            </Card>
            
            <div className="space-y-3">
              {request.notes && request.notes.length > 0 ? (
                request.notes.map((note) => (
                  <Card key={note.id}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={note.is_internal ? "secondary" : "default"}>
                            {note.is_internal ? "Internal" : "Public"}
                          </Badge>
                          <span className="text-sm font-medium">
                            {note.profiles?.first_name} {note.profiles?.last_name}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(note.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>
                      <p className="text-sm">{note.note}</p>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">No notes yet</p>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="history" className="space-y-4">
            <div className="space-y-3">
              {request.action_logs && request.action_logs.length > 0 ? (
                request.action_logs.map((log) => (
                  <Card key={log.id}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <History className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium capitalize">{log.action_type.replace('_', ' ')}</span>
                            <span className="text-sm text-muted-foreground">
                              by {log.profiles?.first_name} {log.profiles?.last_name}
                            </span>
                          </div>
                          {log.old_value && log.new_value && (
                            <p className="text-sm text-muted-foreground ml-6">
                              Changed from "{log.old_value}" to "{log.new_value}"
                            </p>
                          )}
                          {!log.old_value && log.new_value && (
                            <p className="text-sm text-muted-foreground ml-6">
                              Set to "{log.new_value}"
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">No action history yet</p>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="actions" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Status Change */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Change Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select onValueChange={(value) => handleStatusChange(request.id, value, request.status)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select new status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Completed</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
              
              {/* Assign Service Provider */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Assign Service Provider</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select onValueChange={(value) => handleAssignServiceProvider(request.id, value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select service provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceProviders.map((provider) => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>
            
            {/* Notification Settings */}
            {showApiKeyNotice && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-yellow-800">
                    <Bell className="h-4 w-4" />
                    Notification System
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-yellow-800">
                    <p className="font-medium">⚠️ API Keys Required</p>
                    <p className="text-sm">
                      To enable automatic email and SMS notifications to tenants, please configure your API keys:
                    </p>
                    <ul className="text-sm space-y-1 ml-4">
                      <li>• Resend API key for email notifications</li>
                      <li>• Twilio credentials for SMS notifications (optional)</li>
                    </ul>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowApiKeyNotice(false)}
                      className="mt-2"
                    >
                      Remind me later
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );

  // Stats calculations
  const totalRequests = requests.length;
  const pendingRequests = requests.filter(r => r.status === "pending").length;
  const inProgressRequests = requests.filter(r => r.status === "in_progress").length;
  const completedRequests = requests.filter(r => r.status === "completed" || r.status === "resolved").length;

  return (
    <DashboardLayout>
      <FeatureGate 
        feature={FEATURES.MAINTENANCE_TRACKING}
        fallbackTitle="Maintenance Management"
        fallbackDescription="Track maintenance requests, manage service providers, and automate workflows."
      >
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Maintenance Dashboard</h1>
            <p className="text-muted-foreground">
              Manage property maintenance requests and service providers
            </p>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="requests" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="requests">Maintenance Requests</TabsTrigger>
            <TabsTrigger value="providers">Service Providers</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-6">

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRequests}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendingRequests}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Play className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{inProgressRequests}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{completedRequests}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search requests..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Completed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterProperty} onValueChange={setFilterProperty}>
                <SelectTrigger>
                  <SelectValue placeholder="Property" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                  className="text-sm"
                />
                <Input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                  className="text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Requests Table */}
        <Card>
          <CardHeader>
            <CardTitle>Maintenance Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : filteredRequests.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{request.title}</p>
                          <p className="text-sm text-muted-foreground capitalize">{request.category}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {request.tenants?.first_name} {request.tenants?.last_name}
                          </p>
                          {request.units && (
                            <p className="text-sm text-muted-foreground">
                              Unit {request.units.unit_number}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{request.properties?.name}</p>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(request.priority)}>
                          {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(request.status)}>
                          {getStatusIcon(request.status)}
                          <span className="ml-1">
                            {request.status.replace('_', ' ').charAt(0).toUpperCase() + request.status.replace('_', ' ').slice(1)}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {request.service_providers ? (
                          <p className="text-sm">{request.service_providers.name}</p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Unassigned</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">
                          {format(new Date(request.submitted_date), "MMM d, yyyy")}
                        </p>
                      </TableCell>
                      <TableCell>
                        <QuickActions request={request} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No maintenance requests found</h3>
                <p className="text-muted-foreground">
                  {searchTerm || filterStatus !== "all" || filterPriority !== "all" || filterProperty !== "all"
                    ? "Try adjusting your search or filters"
                    : "No maintenance requests have been submitted yet"}
                </p>
              </div>
            )}
            
            {/* Pagination for maintenance requests */}
            {filteredRequests.length > 0 && (
              <div className="px-6 pb-4">
                <TablePaginator
                  currentPage={page}
                  totalPages={Math.ceil(totalCount / pageSize)}
                  pageSize={pageSize}
                  totalItems={totalCount}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Request Details Dialog */}
        {selectedRequest && <RequestDetailsDialog request={selectedRequest} />}
          </TabsContent>

          <TabsContent value="providers" className="space-y-6">
            <ServiceProviderManagement />
          </TabsContent>
        </Tabs>
      </div>
      </FeatureGate>
    </DashboardLayout>
  );
};

export default MaintenanceRequestsLandlord;