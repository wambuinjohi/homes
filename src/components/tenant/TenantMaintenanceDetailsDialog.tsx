import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Eye, Calendar, Clock, AlertTriangle, Wrench, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  submitted_date: string;
  scheduled_date?: string;
  completed_date?: string;
  cost?: number;
  notes?: string;
  images?: string[];
  landlord_images?: string[];
  tenants?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  properties?: {
    name: string;
  };
  units?: {
    unit_number: string;
  };
}

interface TenantMaintenanceDetailsDialogProps {
  request: MaintenanceRequest;
  trigger?: React.ReactNode;
}

export function TenantMaintenanceDetailsDialog({ request, trigger }: TenantMaintenanceDetailsDialogProps) {
  const [open, setOpen] = useState(false);

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "Not set";
    return format(new Date(dateString), "MMM dd, yyyy 'at' h:mm a");
  };

  const formatCurrency = (amount: number | undefined) => {
    if (!amount) return "Not specified";
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'resolved':
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertTriangle className="h-3 w-3" />;
      case 'medium': return <Clock className="h-3 w-3" />;
      case 'low': return <Wrench className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Maintenance Request Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header with title and badges */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">{request.title}</h3>
            <div className="flex gap-2">
              <Badge className={getStatusColor(request.status)}>
                {request.status.replace('_', ' ').toUpperCase()}
              </Badge>
              <Badge className={getPriorityColor(request.priority)}>
                {getPriorityIcon(request.priority)}
                {request.priority.toUpperCase()}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Request Information */}
          <div className="space-y-4">
            <h4 className="font-semibold text-base">Request Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">Category:</span>
                <p className="mt-1 capitalize">{request.category}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Status:</span>
                <p className="mt-1 capitalize">{request.status.replace('_', ' ')}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Priority:</span>
                <p className="mt-1 capitalize">{request.priority}</p>
              </div>
              {request.cost && (
                <div>
                  <span className="font-medium text-muted-foreground">Estimated Cost:</span>
                  <p className="mt-1">{formatCurrency(request.cost)}</p>
                </div>
              )}
            </div>
            
            <div>
              <span className="font-medium text-muted-foreground">Description:</span>
              <p className="mt-1 text-sm bg-muted p-3 rounded-md">{request.description}</p>
            </div>

            {request.notes && (
              <div>
                <span className="font-medium text-muted-foreground">Additional Notes:</span>
                <p className="mt-1 text-sm bg-muted p-3 rounded-md">{request.notes}</p>
              </div>
            )}

            {request.images && request.images.length > 0 && (
              <div>
                <span className="font-medium text-muted-foreground flex items-center gap-2 mb-2">
                  <ImageIcon className="h-4 w-4" />
                  Your Photos ({request.images.length})
                </span>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {request.images.map((imageUrl, index) => (
                    <a
                      key={index}
                      href={imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative block"
                    >
                      <img
                        src={imageUrl}
                        alt={`Maintenance issue ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border hover:border-primary transition-colors cursor-pointer"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center">
                        <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {request.landlord_images && request.landlord_images.length > 0 && (
              <div>
                <span className="font-medium text-success flex items-center gap-2 mb-2">
                  <ImageIcon className="h-4 w-4" />
                  Completion Photos from Landlord ({request.landlord_images.length})
                </span>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {request.landlord_images.map((imageUrl, index) => (
                    <a
                      key={index}
                      href={imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative block"
                    >
                      <img
                        src={imageUrl}
                        alt={`Completion photo ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border-2 border-success hover:border-success/70 transition-colors cursor-pointer"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg flex items-center justify-center">
                        <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Property Information */}
          <div className="space-y-4">
            <h4 className="font-semibold text-base">Property Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {request.properties && (
                <div>
                  <span className="font-medium text-muted-foreground">Property:</span>
                  <p className="mt-1">{request.properties.name}</p>
                </div>
              )}
              {request.units && (
                <div>
                  <span className="font-medium text-muted-foreground">Unit:</span>
                  <p className="mt-1">{request.units.unit_number}</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Timeline */}
          <div className="space-y-4">
            <h4 className="font-semibold text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Timeline
            </h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-start">
                <span className="font-medium text-muted-foreground">Submitted:</span>
                <span>{formatDate(request.submitted_date)}</span>
              </div>
              {request.scheduled_date && (
                <div className="flex justify-between items-start">
                  <span className="font-medium text-muted-foreground">Scheduled:</span>
                  <span>{formatDate(request.scheduled_date)}</span>
                </div>
              )}
              {request.completed_date && (
                <div className="flex justify-between items-start">
                  <span className="font-medium text-muted-foreground">Completed:</span>
                  <span>{formatDate(request.completed_date)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Status Message */}
          <div className="bg-muted p-4 rounded-md">
            <p className="text-sm text-muted-foreground">
              {request.status === 'pending' && "Your request has been received and is being reviewed."}
              {request.status === 'in_progress' && "Work has started on your maintenance request."}
              {request.status === 'resolved' && "Your maintenance request has been completed."}
              {request.status === 'completed' && "Your maintenance request has been completed."}
              {request.status === 'cancelled' && "This maintenance request has been cancelled."}
              {request.status !== 'pending' && request.status !== 'in_progress' && request.status !== 'resolved' && request.status !== 'completed' && request.status !== 'cancelled' && "Status update pending."}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}