import React, { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Clock, CheckCircle, AlertTriangle, Users, Settings } from "lucide-react";
import { useSupportData } from "@/hooks/useSupportData";
import { SupportTicketList } from "@/components/support/SupportTicketList";
import { SupportFilters } from "@/components/support/SupportFilters";
import { SupportTicketDetails } from "@/components/support/SupportTicketDetails";
import { SystemLogsView } from "@/components/support/SystemLogsView";
import { CreateSupportTicketDialog } from "@/components/support/CreateSupportTicketDialog";
import KnowledgeBaseManager from "@/components/admin/KnowledgeBaseManager";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";

const EnhancedSupportCenter = () => {
  const { hasPermission } = usePermissions();
  const { data, loading, error, updateTicketStatus, addMessage, assignTicket, refetch } = useSupportData();
  
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketDetailsOpen, setTicketDetailsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const isAdmin = hasPermission('admin_access');

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Error Loading Support Data</h3>
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button onClick={refetch}>Try Again</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const stats = data || {
    openTickets: 0,
    inProgressTickets: 0,
    resolvedToday: 0,
    avgResponseTime: "0h",
    totalTickets: 0,
    tickets: [],
    systemLogs: []
  };

  const handleTicketSelect = (ticket) => {
    setSelectedTicket(ticket);
    setTicketDetailsOpen(true);
  };

  const handleStatusChange = async (ticketId: string, status: string, resolutionNotes?: string) => {
    const result = await updateTicketStatus(ticketId, status as any, resolutionNotes);
    if (result.success) {
      toast.success("Ticket status updated successfully");
      setTicketDetailsOpen(false);
    } else {
      toast.error(result.error || "Failed to update ticket status");
    }
  };

  const handleAddMessage = async (ticketId: string, message: string) => {
    const result = await addMessage(ticketId, message, true);
    if (result.success) {
      toast.success("Message sent successfully");
    } else {
      toast.error(result.error || "Failed to send message");
    }
  };

  const handleAssignTicket = async (ticketId: string, assignedTo: string | null) => {
    const result = await assignTicket(ticketId, assignedTo);
    if (result.success) {
      toast.success("Ticket assigned successfully");
    } else {
      toast.error(result.error || "Failed to assign ticket");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Support Center</h1>
            <p className="text-muted-foreground">
              Manage support tickets, system logs, and knowledge base
            </p>
          </div>
          
          {!isAdmin && (
            <CreateSupportTicketDialog>
              <Button className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Create Ticket
              </Button>
            </CreateSupportTicketDialog>
          )}
        </div>

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
              <MessageSquare className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.openTickets}</div>
              <p className="text-xs text-muted-foreground">Requiring attention</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-yellow-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.inProgressTickets}</div>
              <p className="text-xs text-muted-foreground">Being worked on</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Resolved Today</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.resolvedToday}</div>
              <p className="text-xs text-muted-foreground">Completed today</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
              <Clock className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.avgResponseTime}</div>
              <p className="text-xs text-muted-foreground">Response time</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="tickets" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tickets" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Support Tickets
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="logs" className="gap-2">
                <Settings className="h-4 w-4" />
                System Logs
              </TabsTrigger>
            )}
            <TabsTrigger value="knowledge" className="gap-2">
              <Users className="h-4 w-4" />
              Knowledge Base
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Support Tickets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <SupportFilters
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  priorityFilter={priorityFilter}
                  onPriorityFilterChange={setPriorityFilter}
                  totalTickets={stats.totalTickets}
                  filteredCount={stats.tickets.filter(ticket => {
                    const matchesSearch = ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                         ticket.description.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
                    const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
                    return matchesSearch && matchesStatus && matchesPriority;
                  }).length}
                />
                
                <SupportTicketList
                  tickets={stats.tickets}
                  selectedTicket={selectedTicket}
                  onSelectTicket={handleTicketSelect}
                  searchQuery={searchQuery}
                  statusFilter={statusFilter}
                  priorityFilter={priorityFilter}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="logs" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>System Logs</CardTitle>
                </CardHeader>
                <CardContent>
                  <SystemLogsView logs={stats.systemLogs} />
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="knowledge" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Knowledge Base</CardTitle>
              </CardHeader>
              <CardContent>
                <KnowledgeBaseManager />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Ticket Details Modal */}
      <SupportTicketDetails
        ticket={selectedTicket}
        open={ticketDetailsOpen}
        onOpenChange={setTicketDetailsOpen}
        onUpdate={() => {
          refetch();
          setTicketDetailsOpen(false);
        }}
      />
    </DashboardLayout>
  );
};

export default EnhancedSupportCenter;