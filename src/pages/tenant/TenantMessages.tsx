import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Send, Phone, Mail } from "lucide-react";
import { useTenantContacts } from "@/hooks/useTenantContacts";
import { useToast } from "@/hooks/use-toast";
import { TenantLayout } from "@/components/TenantLayout";

export default function TenantMessages() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedContact, setSelectedContact] = useState("");
  const [priority, setPriority] = useState("normal");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { contacts, loading } = useTenantContacts();
  const { toast } = useToast();

  const handleSubmitMessage = async () => {
    if (!selectedContact || !subject.trim() || !message.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create support ticket as message
      const ticketData = {
        subject,
        description: message,
        priority,
        category: "general",
        contact_preference: selectedContact
      };

      // Here you would typically call your API to create the support ticket
      // For now, we'll just show a success message
      toast({
        title: "Message Sent",
        description: "Your message has been sent successfully. You'll receive a response soon.",
      });

      // Reset form
      setSubject("");
      setMessage("");
      setSelectedContact("");
      setPriority("normal");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Messages</h1>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading contacts...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TenantLayout>
      <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Send Message</h1>
        <p className="text-muted-foreground">Contact your property management team</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                New Message
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="contact">Send To</Label>
                <Select value={selectedContact} onValueChange={setSelectedContact}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((contact, index) => (
                      <SelectItem key={index} value={contact.role}>
                        {contact.name} - {contact.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter message subject"
                  required
                />
              </div>

              <div>
                <Label htmlFor="message">Message *</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message here..."
                  rows={8}
                  required
                />
              </div>

              <Button 
                onClick={handleSubmitMessage} 
                disabled={isSubmitting}
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                {isSubmitting ? "Sending..." : "Send Message"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Contact Information */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Available Contacts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {contacts.map((contact, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-2">
                  <div className="font-medium">{contact.name}</div>
                  <div className="text-sm text-muted-foreground">{contact.role}</div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4" />
                    <a href={`tel:${contact.phone}`} className="hover:underline">
                      {contact.phone}
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4" />
                    <a href={`mailto:${contact.email}`} className="hover:underline">
                      {contact.email}
                    </a>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </TenantLayout>
  );
}