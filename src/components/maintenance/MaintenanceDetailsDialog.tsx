import { useState } from "react";
import { formatAmount } from "@/utils/currency";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Edit, Wrench, User, Calendar, DollarSign, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { toast } from "sonner";

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

interface MaintenanceDetailsDialogProps {
  request: MaintenanceRequest;
  mode: 'view' | 'edit';
  trigger?: React.ReactNode;
}

export function MaintenanceDetailsDialog({ request, mode, trigger }: MaintenanceDetailsDialogProps) {
  const [open, setOpen] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'Not specified';
    return formatAmount(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-warning text-warning-foreground";
      case "in_progress":
        return "bg-accent text-accent-foreground";
      case "resolved":
      case "completed":
        return "bg-success text-success-foreground";
      case "cancelled":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
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
        return "bg-secondary text-secondary-foreground";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "high":
        return <AlertTriangle className="h-4 w-4" />;
      case "medium":
        return <Clock className="h-4 w-4" />;
      case "low":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const handleUpdateStatus = (newStatus: string) => {
    toast.success(`Request status updated to ${newStatus}`);
    // Here you would implement actual status update
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      {mode === 'view' ? (
        <>
          <Eye className="h-4 w-4 mr-1" />
          View
        </>
      ) : (
        <>
          <Edit className="h-4 w-4 mr-1" />
          Edit
        </>
      )}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            {mode === 'view' ? 'Maintenance Request Details' : 'Edit Maintenance Request'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Request Header */}
          <div className="bg-muted/30 p-4 rounded-lg space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Request Information
            </h3>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Title</label>
              <p className="text-lg font-semibold text-primary">{request.title}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <p className="text-sm">{request.description}</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Category</label>
                <p className="text-sm font-medium capitalize">{request.category}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Priority</label>
                <Badge className={getPriorityColor(request.priority)}>
                  {getPriorityIcon(request.priority)}
                  <span className="ml-1 capitalize">{request.priority}</span>
                </Badge>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <Badge className={getStatusColor(request.status)}>
                  {request.status.replace('_', ' ').charAt(0).toUpperCase() + request.status.replace('_', ' ').slice(1)}
                </Badge>
              </div>
            </div>
          </div>

          {/* Tenant Information */}
          <div className="bg-muted/30 p-4 rounded-lg space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              Tenant Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Tenant Name</label>
                <p className="text-sm font-medium">
                  {request.tenants?.first_name} {request.tenants?.last_name}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <p className="text-sm">{request.tenants?.email}</p>
              </div>
            </div>
          </div>

          {/* Property Information */}
          <div className="bg-muted/30 p-4 rounded-lg space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Property Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Property</label>
                <p className="text-sm font-medium">{request.properties?.name}</p>
              </div>
              {request.units?.unit_number && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Unit</label>
                  <p className="text-sm">{request.units.unit_number}</p>
                </div>
              )}
            </div>
          </div>

          {/* Timeline Information */}
          <div className="bg-muted/30 p-4 rounded-lg space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Timeline
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Submitted Date</label>
                <p className="text-sm">{formatDate(request.submitted_date)}</p>
              </div>
              {request.scheduled_date && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Scheduled Date</label>
                  <p className="text-sm">{formatDate(request.scheduled_date)}</p>
                </div>
              )}
              {request.completed_date && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Completed Date</label>
                  <p className="text-sm">{formatDate(request.completed_date)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Financial Information */}
          {request.cost && (
            <div className="bg-muted/30 p-4 rounded-lg space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Cost Information
              </h3>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Total Cost</label>
                <p className="text-xl font-bold text-green-600">{formatCurrency(request.cost)}</p>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {mode === 'view' && (
            <div className="bg-muted/30 p-4 rounded-lg space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Quick Actions</h3>
              <div className="flex gap-2 flex-wrap">
                {request.status === 'pending' && (
                  <Button 
                    onClick={() => handleUpdateStatus('in_progress')}
                    size="sm"
                    className="bg-accent hover:bg-accent/90"
                  >
                    Start Work
                  </Button>
                )}
                {request.status === 'in_progress' && (
                  <Button 
                    onClick={() => handleUpdateStatus('completed')}
                    size="sm"
                    className="bg-success hover:bg-success/90 text-success-foreground"
                  >
                    Mark Complete
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  Contact Tenant
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {mode === 'view' ? 'Close' : 'Cancel'}
          </Button>
          {mode === 'edit' && (
            <Button type="submit">
              Save Changes
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}