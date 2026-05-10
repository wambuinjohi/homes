import React, { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  HelpCircle, 
  MessageCircle, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Search,
  Filter,
  Eye,
  MessageSquare,
  User,
  Calendar,
  Activity,
  RefreshCw
} from "lucide-react";
import { useSupportData } from "@/hooks/useSupportData";

const SupportCenter = () => {
  const { toast } = useToast();
  const { data: supportData, loading, refetch, updateTicketStatus, addMessage } = useSupportData();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyMessage, setReplyMessage] = useState("");

  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    
    const result = await addMessage(selectedTicket.id, replyMessage, true);
    if (result.success) {
      setReplyMessage("");
      toast({
        title: "Reply sent",
        description: "Your reply has been added to the ticket.",
      });
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to send reply",
        variant: "destructive",
      });
    }
  };

  const handleMarkResolved = async () => {
    if (!selectedTicket) return;
    
    const result = await updateTicketStatus(selectedTicket.id, 'resolved');
    if (result.success) {
      setSelectedTicket(null);
      toast({
        title: "Ticket resolved",
        description: "The ticket has been marked as resolved.",
      });
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to update ticket status",
        variant: "destructive",
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "destructive";
      case "in-progress": return "default";
      case "resolved": return "secondary";
      default: return "outline";
    }
  };

  const getLogTypeColor = (type: string) => {
    switch (type) {
      case "error": return "text-red-500";
      case "warning": return "text-yellow-500";
      case "info": return "text-blue-500";
      default: return "text-gray-500";
    }
  };

  return (
    <DashboardLayout>
      <div className="bg-tint-gray p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">Support Center</h1>
            <p className="text-muted-foreground">
              Manage user support tickets and monitor system health
            </p>
          </div>
          <Button onClick={refetch} variant="outline" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>

        {/* Support Overview Cards */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card className="card-gradient-red hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white">Open Tickets</CardTitle>
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <HelpCircle className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">
                {loading ? "..." : supportData?.openTickets || 0}
              </div>
              <p className="text-sm text-white/90 font-medium">Awaiting response</p>
            </CardContent>
          </Card>

          <Card className="card-gradient-orange hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white">In Progress</CardTitle>
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <Clock className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">
                {loading ? "..." : supportData?.inProgressTickets || 0}
              </div>
              <p className="text-sm text-white/90 font-medium">Being resolved</p>
            </CardContent>
          </Card>

          <Card className="card-gradient-green hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white">Resolved Today</CardTitle>
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">
                {loading ? "..." : supportData?.resolvedToday || 0}
              </div>
              <p className="text-sm text-white/90 font-medium">Completed tickets</p>
            </CardContent>
          </Card>

          <Card className="card-gradient-navy hover:shadow-elevated transition-all duration-500 transform hover:scale-105 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-semibold text-white">Avg Response Time</CardTitle>
              <div className="p-3 rounded-full bg-white/20 backdrop-blur-sm">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-1">
                {loading ? "..." : supportData?.avgResponseTime || "2.3h"}
              </div>
              <p className="text-sm text-white/90 font-medium">Response time</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="tickets" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tickets" className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Support Tickets
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              System Logs
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Knowledge Base
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tickets">
            <div className="space-y-6">
              {/* Search and Filter */}
              <Card className="bg-card">
                <CardContent className="pt-6">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input 
                          placeholder="Search tickets..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <Button variant="outline">
                      <Filter className="mr-2 h-4 w-4" />
                      Filter
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Tickets List */}
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="bg-card">
                  <CardHeader>
                    <CardTitle className="text-primary">Support Tickets</CardTitle>
                  </CardHeader>
                  <CardContent>
                     <div className="space-y-4">
                       {(supportData?.tickets || []).map((ticket) => (
                         <div 
                           key={ticket.id}
                           className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                           onClick={() => setSelectedTicket(ticket)}
                         >
                           <div className="flex items-start justify-between mb-2">
                             <h3 className="font-semibold text-sm">{ticket.title}</h3>
                             <div className="flex items-center gap-2">
                               <div className={`w-2 h-2 rounded-full ${getPriorityColor(ticket.priority)}`}></div>
                               <Badge variant={getStatusColor(ticket.status)}>{ticket.status.replace('_', ' ')}</Badge>
                             </div>
                           </div>
                           <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {ticket.user ? `${ticket.user.first_name} ${ticket.user.last_name}` : 'Unknown User'}
                              </div>
                             <div className="flex items-center gap-1">
                               <Calendar className="h-3 w-3" />
                               {new Date(ticket.created_at).toLocaleDateString()}
                             </div>
                             <Badge variant="outline">{ticket.category}</Badge>
                           </div>
                         </div>
                       ))}
                     </div>
                  </CardContent>
                </Card>

                {/* Ticket Details */}
                {selectedTicket && (
                  <Card className="bg-card">
                    <CardHeader>
                      <CardTitle className="text-primary">Ticket Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-semibold">{selectedTicket.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={getStatusColor(selectedTicket.status)}>{selectedTicket.status}</Badge>
                            <Badge variant="outline">{selectedTicket.priority}</Badge>
                            <Badge variant="secondary">{selectedTicket.category}</Badge>
                          </div>
                        </div>

                         <div>
                           <p className="text-sm text-muted-foreground">
                             From: {selectedTicket.user ? `${selectedTicket.user.first_name} ${selectedTicket.user.last_name}` : 'Unknown User'} 
                             ({selectedTicket.user?.email || 'No email'})
                           </p>
                           <p className="text-sm text-muted-foreground">Created: {new Date(selectedTicket.created_at).toLocaleDateString()}</p>
                         </div>

                        <div>
                          <h4 className="font-medium mb-2">Description</h4>
                          <p className="text-sm text-muted-foreground">{selectedTicket.description}</p>
                        </div>

                         <div>
                           <h4 className="font-medium mb-2">Conversation</h4>
                           <div className="space-y-3 max-h-48 overflow-y-auto">
                             {(selectedTicket.messages || []).map((msg, index) => (
                               <div key={index} className={`p-3 rounded-lg ${msg.is_staff_reply ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-muted'}`}>
                                 <div className="flex justify-between items-start mb-1">
                                   <span className="font-medium text-sm">
                                     {msg.is_staff_reply ? 'Support' : (msg.user ? `${msg.user.first_name} ${msg.user.last_name}` : 'User')}
                                   </span>
                                   <span className="text-xs text-muted-foreground">
                                     {new Date(msg.created_at).toLocaleTimeString()}
                                   </span>
                                 </div>
                                 <p className="text-sm">{msg.message}</p>
                               </div>
                             ))}
                           </div>
                         </div>

                         <div>
                           <Textarea 
                             placeholder="Type your response..." 
                             className="mb-3"
                             value={replyMessage}
                             onChange={(e) => setReplyMessage(e.target.value)}
                           />
                           <div className="flex gap-2">
                             <Button 
                               size="sm" 
                               className="bg-primary hover:bg-primary/90"
                               onClick={handleSendReply}
                               disabled={!replyMessage.trim()}
                             >
                               Send Reply
                             </Button>
                             <Button 
                               size="sm" 
                               variant="outline"
                               onClick={handleMarkResolved}
                             >
                               Mark Resolved
                             </Button>
                           </div>
                         </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="text-primary">System Logs</CardTitle>
                <p className="text-muted-foreground">Real-time system monitoring and error tracking</p>
              </CardHeader>
              <CardContent>
                 <div className="space-y-3">
                   {(supportData?.systemLogs || []).map((log) => (
                     <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                       <div className="flex items-center gap-3">
                         <AlertTriangle className={`h-4 w-4 ${getLogTypeColor(log.type)}`} />
                         <div>
                           <p className="font-medium text-sm">{log.message}</p>
                            <p className="text-xs text-muted-foreground">
                              {log.service} • {new Date(log.created_at).toLocaleString()}
                            </p>
                         </div>
                       </div>
                       <Badge variant="outline" className={getLogTypeColor(log.type)}>
                         {log.type}
                       </Badge>
                     </div>
                   ))}
                 </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="knowledge">
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="text-primary">Knowledge Base Management</CardTitle>
                <p className="text-muted-foreground">Manage help articles and documentation</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-2 mb-4">
                    <Button 
                      className="bg-primary hover:bg-primary/90"
                      onClick={() => {
                        toast({
                          title: "Article Creation",
                          description: "New article creation dialog would open here.",
                        });
                      }}
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Create New Article
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        toast({
                          title: "Publishing",
                          description: "Articles published to help center successfully.",
                        });
                      }}
                    >
                      Publish to Help Center
                    </Button>
                  </div>
                  
                  <div className="p-4 bg-muted rounded-lg mb-4">
                    <p className="text-sm text-muted-foreground">
                      <strong>Note:</strong> Published articles will be available in the tenant portal help section and 
                      on your public help center at: <code>yourdomain.com/help</code>
                    </p>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold mb-2">Getting Started Guide</h3>
                      <p className="text-sm text-muted-foreground mb-3">Basic platform navigation and setup</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Eye className="mr-1 h-3 w-3" />
                          View
                        </Button>
                        <Button size="sm" variant="outline">Edit</Button>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold mb-2">Payment & Billing FAQ</h3>
                      <p className="text-sm text-muted-foreground mb-3">Common billing questions and solutions</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Eye className="mr-1 h-3 w-3" />
                          View
                        </Button>
                        <Button size="sm" variant="outline">Edit</Button>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold mb-2">Property Management Tips</h3>
                      <p className="text-sm text-muted-foreground mb-3">Best practices for property managers</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Eye className="mr-1 h-3 w-3" />
                          View
                        </Button>
                        <Button size="sm" variant="outline">Edit</Button>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h3 className="font-semibold mb-2">Troubleshooting Guide</h3>
                      <p className="text-sm text-muted-foreground mb-3">Technical issues and solutions</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Eye className="mr-1 h-3 w-3" />
                          View
                        </Button>
                        <Button size="sm" variant="outline">Edit</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default SupportCenter;