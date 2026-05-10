import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  MessageCircle, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Send,
  Ticket,
  User,
  Calendar
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { TablePaginator } from "@/components/ui/table-paginator";

interface SupportTicket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  updated_at: string;
  resolution_notes?: string;
  messages?: SupportMessage[];
}

interface SupportMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_staff_reply: boolean;
  created_at: string;
  user?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
}

export function UserSupportTickets() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (user) {
      fetchUserTickets();
    }
  }, [user]);

  const fetchUserTickets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          messages:support_messages(
            *,
            user:profiles!support_messages_user_id_fkey(first_name, last_name, email)
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tickets:', error);
        toast({
          title: "Error",
          description: "Failed to load your support tickets.",
          variant: "destructive",
        });
      } else {
        setTickets(data || []);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast({
        title: "Error",
        description: "Failed to load your support tickets.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTicketClick = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setDialogOpen(true);
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim() || !user) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: selectedTicket.id,
          user_id: user.id,
          message: replyMessage.trim(),
          is_staff_reply: false
        });

      if (error) throw error;

      toast({
        title: "Reply Sent",
        description: "Your reply has been added to the ticket.",
      });

      setReplyMessage("");
      
      // Refresh the ticket data
      await fetchUserTickets();
      
      // Update the selected ticket with the new message
      const updatedTicket = tickets.find(t => t.id === selectedTicket.id);
      if (updatedTicket) {
        setSelectedTicket(updatedTicket);
      }
    } catch (error) {
      console.error('Error sending reply:', error);
      toast({
        title: "Error",
        description: "Failed to send reply. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'resolved': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'medium': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertCircle className="h-4 w-4" />;
      case 'in_progress': return <Clock className="h-4 w-4" />;
      case 'resolved': return <CheckCircle className="h-4 w-4" />;
      case 'closed': return <CheckCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-muted-foreground">Loading your support tickets...</div>
      </div>
    );
  }

  // Pagination logic
  const totalPages = Math.ceil(tickets.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedTickets = tickets.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Ticket className="h-6 w-6" />
        <h2 className="text-2xl font-bold">My Support Tickets</h2>
      </div>

      {tickets.length === 0 ? (
        <Card className="text-center py-8">
          <CardContent>
            <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Support Tickets</h3>
            <p className="text-muted-foreground">
              You haven't created any support tickets yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {paginatedTickets.map((ticket) => (
              <Card 
                key={ticket.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleTicketClick(ticket)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <CardTitle className="text-lg line-clamp-1">{ticket.title}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {ticket.description}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(ticket.status)}>
                          {getStatusIcon(ticket.status)}
                          <span className="ml-1 capitalize">{ticket.status.replace('_', ' ')}</span>
                        </Badge>
                        <Badge className={getPriorityColor(ticket.priority)}>
                          <span className="capitalize">{ticket.priority}</span>
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Category: {ticket.category}</span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {ticket.messages?.length || 0} messages
                      </span>
                    </div>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <TablePaginator
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={tickets.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            showPageSizeSelector={true}
          />
        </>
      )}

      {/* Ticket Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              {selectedTicket?.title}
            </DialogTitle>
          </DialogHeader>
          
          {selectedTicket && (
            <div className="space-y-6">
              {/* Ticket Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <div className="text-sm font-medium">Status</div>
                  <Badge className={getStatusColor(selectedTicket.status)}>
                    {getStatusIcon(selectedTicket.status)}
                    <span className="ml-1 capitalize">{selectedTicket.status.replace('_', ' ')}</span>
                  </Badge>
                </div>
                <div>
                  <div className="text-sm font-medium">Priority</div>
                  <Badge className={getPriorityColor(selectedTicket.priority)}>
                    <span className="capitalize">{selectedTicket.priority}</span>
                  </Badge>
                </div>
                <div>
                  <div className="text-sm font-medium">Category</div>
                  <div className="text-sm">{selectedTicket.category}</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Created</div>
                  <div className="text-sm flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDistanceToNow(new Date(selectedTicket.created_at), { addSuffix: true })}
                  </div>
                </div>
              </div>

              {/* Original Description */}
              <div>
                <h4 className="font-medium mb-2">Original Description</h4>
                <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded">
                  {selectedTicket.description}
                </p>
              </div>

              {/* Messages */}
              <div>
                <h4 className="font-medium mb-4">Conversation</h4>
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                    selectedTicket.messages
                      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                      .map((message) => (
                        <div
                          key={message.id}
                          className={`p-3 rounded-lg ${
                            message.is_staff_reply
                              ? 'bg-blue-50 border-l-4 border-blue-500 dark:bg-blue-950'
                              : 'bg-gray-50 border-l-4 border-gray-300 dark:bg-gray-900'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <User className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              {message.is_staff_reply ? 'Support Team' : 'You'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm">{message.message}</p>
                        </div>
                      ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No messages yet.</p>
                  )}
                </div>
              </div>

              {/* Add Reply */}
              {selectedTicket.status !== 'closed' && (
                <div className="space-y-3">
                  <h4 className="font-medium">Add Reply</h4>
                  <Textarea
                    placeholder="Type your reply here..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    rows={3}
                  />
                  <Button 
                    onClick={handleSendReply} 
                    disabled={sending || !replyMessage.trim()}
                    className="w-full"
                  >
                    {sending ? (
                      "Sending..."
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Reply
                      </>
                    )}
                  </Button>
                </div>
              )}

              {selectedTicket.status === 'closed' && (
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">
                    This ticket has been closed. No further replies can be added.
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}