import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateSupportTicketDialog } from "@/components/support/CreateSupportTicketDialog";
import { ContactSupportButton } from "@/components/support/ContactSupportButton";
import { UserSupportTickets } from "@/components/support/UserSupportTickets";
import { DashboardLayout } from "@/components/DashboardLayout";
import { TenantLayout } from "@/components/TenantLayout";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  HelpCircle, 
  MessageSquare, 
  FileText, 
  Search,
  Phone,
  Mail,
  Clock,
  Ticket
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const supportCategories = [
  {
    title: "Getting Started",
    description: "Learn the basics of using the platform",
    icon: HelpCircle,
    color: "text-blue-500",
    topics: ["Account Setup", "First Steps", "Navigation Guide"]
  },
  {
    title: "Payments & Billing",
    description: "Payment methods, invoices, and billing questions",
    icon: FileText,
    color: "text-green-500",
    topics: ["Payment Issues", "Billing Questions", "Invoice Help"]
  },
  {
    title: "Technical Support",
    description: "Technical issues and troubleshooting",
    icon: MessageSquare,
    color: "text-orange-500",
    topics: ["Login Problems", "Bug Reports", "Performance Issues"]
  }
];

const quickLinks = [
  { title: "Browse Knowledge Base", url: "/knowledge-base", icon: Search },
  { title: "Contact Support", component: ContactSupportButton, icon: MessageSquare },
];

export default function Support() {
  const { user } = useAuth();
  
  // Check if we're in tenant context
  const isTenantRoute = window.location.pathname.startsWith('/tenant');
  
  const content = (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Help & Support</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Find answers to common questions, browse our knowledge base, or get in touch with our support team.
        </p>
      </div>

      <Tabs defaultValue="help" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="help" className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Get Help
          </TabsTrigger>
          <TabsTrigger value="tickets" className="flex items-center gap-2">
            <Ticket className="h-4 w-4" />
            My Tickets
          </TabsTrigger>
        </TabsList>

        <TabsContent value="help" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {supportCategories.map((category) => (
              <Card key={category.title} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <category.icon className={`h-8 w-8 ${category.color}`} />
                    <div>
                      <CardTitle className="text-lg">{category.title}</CardTitle>
                      <CardDescription>{category.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {category.topics.map((topic) => (
                      <li key={topic} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full" />
                        {topic}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link to={isTenantRoute ? "/tenant/knowledge-base" : "/knowledge-base"}>
                    <Search className="h-4 w-4 mr-2" />
                    Browse Knowledge Base
                  </Link>
                </Button>
                <CreateSupportTicketDialog>
                  <Button className="w-full justify-start">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Create Support Ticket
                  </Button>
                </CreateSupportTicketDialog>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Support Hours
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Monday - Friday</span>
                  <span className="text-sm font-medium">9:00 AM - 6:00 PM</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Saturday</span>
                  <span className="text-sm font-medium">10:00 AM - 4:00 PM</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Sunday</span>
                  <span className="text-sm font-medium">Closed</span>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    support@zirahomes.com
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Need Immediate Help?</CardTitle>
              <CardDescription>
                For urgent issues, create a support ticket and mark it as "High Priority" or "Urgent"
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <CreateSupportTicketDialog>
                  <Button size="lg">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Create Urgent Ticket
                  </Button>
                </CreateSupportTicketDialog>
                <Button asChild variant="outline" size="lg">
                  <Link to={isTenantRoute ? "/tenant/knowledge-base" : "/knowledge-base"}>
                    <FileText className="h-4 w-4 mr-2" />
                    Search Knowledge Base
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets">
          <UserSupportTickets />
        </TabsContent>
      </Tabs>
    </div>
  );

  // Wrap with appropriate layout based on route
  if (isTenantRoute) {
    return content;
  }

  return (
    <DashboardLayout>
      {content}
    </DashboardLayout>
  );
}