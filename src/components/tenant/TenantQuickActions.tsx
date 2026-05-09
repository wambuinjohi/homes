import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  CreditCard, 
  Wrench, 
  Phone, 
  MessageSquare,
  Download,
  AlertTriangle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, isAfter } from "date-fns";
import { useTenantContacts } from "@/hooks/useTenantContacts";

interface TenantQuickActionsProps {
  currentInvoice?: any;
}

export function TenantQuickActions({ currentInvoice }: TenantQuickActionsProps) {
  const navigate = useNavigate();
  const { contacts } = useTenantContacts();
  
  // Get emergency contact - prefer property manager, then landlord, then platform support
  const emergencyContact = contacts.find(contact => !contact.isPlatformSupport) || contacts[0];

  const quickActions = [
    {
      title: "Pay Rent",
      description: currentInvoice ? `KES ${currentInvoice.amount?.toLocaleString()} due` : "No pending payments",
      icon: CreditCard,
      color: "bg-green-500 hover:bg-green-600",
      action: () => navigate("/tenant/payments"),
      disabled: !currentInvoice,
      urgent: currentInvoice?.status === "overdue"
    },
    {
      title: "Request Maintenance",
      description: "Report an issue",
      icon: Wrench,
      color: "bg-blue-500 hover:bg-blue-600",
      action: () => navigate("/tenant/maintenance")
    },
    {
      title: "Emergency Contact",
      description: emergencyContact ? emergencyContact.phone : "Loading...",
      icon: Phone,
      color: "bg-red-500 hover:bg-red-600",
      action: () => {
        if (emergencyContact) {
          window.open(`tel:${emergencyContact.phone.replace(/\s/g, '')}`);
        }
      },
      disabled: !emergencyContact
    },
    {
      title: "Contact Manager",
      description: "Send a message",
      icon: MessageSquare,
      color: "bg-purple-500 hover:bg-purple-600",
      action: () => navigate("/tenant/messages")
    }
  ];

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              onClick={action.action}
              disabled={action.disabled}
              className={`${action.color} text-white h-auto p-4 flex flex-col items-center gap-2 relative`}
              variant="default"
            >
              {action.urgent && (
                <AlertTriangle className="absolute -top-1 -right-1 h-4 w-4 text-yellow-400" />
              )}
              <action.icon className="h-6 w-6" />
              <div className="text-center">
                <div className="font-medium text-sm">{action.title}</div>
                <div className="text-xs opacity-90">{action.description}</div>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}