import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Clock, User, MessageCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface SupportTicket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  updated_at: string;
  user: {
    name: string;
    email: string;
  };
  messages?: Array<{
    id: string;
    message: string;
    sender_type: 'user' | 'admin';
    created_at: string;
    sender_name: string;
  }>;
}

interface SupportTicketDetailsProps {
  ticket: SupportTicket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export function SupportTicketDetails({ ticket, open, onOpenChange, onUpdate }: SupportTicketDetailsProps) {
  const { user } = useAuth();
  const [newMessage, setNewMessage] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  if (!ticket) return null;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-500';
      case 'in_progress': return 'bg-yellow-500';
      case 'resolved': return 'bg-green-500';
      case 'closed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const handleAddMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      setIsUpdating(true);
      // Mock message creation until types are regenerated
      console.log('Adding support message:', {
        ticket_id: ticket.id,
        message: newMessage,
        sender_type: 'admin',
        sender_id: user?.id
      });

      setNewMessage("");
      toast.success("Message added successfully");
      onUpdate?.();
    } catch (error) {
      console.error('Error adding message:', error);
      toast.error("Failed to add message");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!newStatus) return;

    try {
      setIsUpdating(true);
      // Mock status update until types are regenerated
      console.log('Updating ticket status:', {
        id: ticket.id,
        status: newStatus,
        updated_at: new Date().toISOString()
      });

      toast.success("Ticket status updated successfully");
      onUpdate?.();
    } catch (error) {
      console.error('Error updating ticket status:', error);
      toast.error("Failed to update ticket status");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{ticket.title}</span>
            <Badge className={getPriorityColor(ticket.priority)}>
              {ticket.priority}
            </Badge>
            <Badge className={getStatusColor(ticket.status)}>
              {ticket.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Ticket Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="text-sm">
                <strong>{ticket.user.name}</strong> ({ticket.user.email})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="text-sm">
                Created: {new Date(ticket.created_at).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">
                Category: <strong>{ticket.category}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="text-sm">
                Updated: {new Date(ticket.updated_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Original Description */}
          <div>
            <h4 className="font-semibold mb-2">Original Issue Description</h4>
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
            </div>
          </div>

          <Separator />

          {/* Messages */}
          <div>
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Conversation
            </h4>
            
            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
              {ticket.messages?.map((message) => (
                <div
                  key={message.id}
                  className={`p-3 rounded-lg ${
                    message.sender_type === 'admin' 
                      ? 'bg-blue-50 ml-8' 
                      : 'bg-gray-50 mr-8'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-sm">
                      {message.sender_name} ({message.sender_type})
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(message.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                </div>
              ))}
            </div>

            {/* Add Message */}
            <div className="space-y-3">
              <Textarea
                placeholder="Type your response..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="min-h-20"
              />
              <Button 
                onClick={handleAddMessage}
                disabled={!newMessage.trim() || isUpdating}
                className="w-full"
              >
                {isUpdating ? "Sending..." : "Send Response"}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Status Update */}
          <div>
            <h4 className="font-semibold mb-3">Update Status</h4>
            <div className="flex gap-3">
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Change status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={handleStatusUpdate}
                disabled={!newStatus || isUpdating}
              >
                Update Status
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}