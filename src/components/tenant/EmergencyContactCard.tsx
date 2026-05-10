import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, Mail, User, Calendar, AlertCircle } from "lucide-react";
import { useTenantContacts } from "@/hooks/useTenantContacts";
import { ContactSupportButton } from "@/components/support/ContactSupportButton";
import { useNavigate } from "react-router-dom";

export function EmergencyContactCard() {
  const { contacts, loading, error } = useTenantContacts();
  const navigate = useNavigate();

  // Get the primary emergency contact (first non-platform contact, or platform support as fallback)
  const emergencyContact = contacts.find(contact => !contact.isPlatformSupport) || contacts[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Emergency Contact
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-destructive p-4 rounded-lg border border-destructive/20 bg-destructive/5">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        ) : emergencyContact ? (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium flex items-center gap-2">
                  {emergencyContact.name}
                  <Badge variant={emergencyContact.isPlatformSupport ? "secondary" : "outline"} className="text-xs">
                    {emergencyContact.role}
                  </Badge>
                </p>
                <p className="text-sm text-muted-foreground">
                  {emergencyContact.isPlatformSupport ? "Support Team" : "Property Contact"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Emergency Line</p>
                <p className="text-sm text-muted-foreground">{emergencyContact.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{emergencyContact.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Office Hours</p>
                <p className="text-sm text-muted-foreground">
                  {emergencyContact.isPlatformSupport ? "24/7 Support" : "Mon-Fri: 8AM-6PM"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-muted-foreground">No emergency contact available</p>
            <div className="space-y-2 mt-2">
              <ContactSupportButton 
                variant="outline" 
                size="sm"
                context="emergency_contact_fallback"
              />
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => navigate("/tenant/messages")}
              >
                Send Message
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}