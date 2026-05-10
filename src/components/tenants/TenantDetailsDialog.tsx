import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Edit, Phone, Mail, User, Shield, Calendar, DollarSign, Send } from "lucide-react";
import { TenantEditForm } from "@/components/forms/TenantEditForm";
import { ResendCredentialsDialog } from "./ResendCredentialsDialog";
import { usePermissions } from "@/hooks/usePermissions";

interface Tenant {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  national_id?: string;
  profession?: string;
  employment_status?: string;
  monthly_income?: number;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  previous_address?: string;
  created_at: string;
}

interface TenantDetailsDialogProps {
  tenant: Tenant;
  mode: 'view' | 'edit';
  trigger?: React.ReactNode;
}

export function TenantDetailsDialog({ tenant, mode, trigger }: TenantDetailsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(mode === 'edit');
  const { hasPermission } = usePermissions();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'Not specified';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  const getEmploymentColor = (status?: string) => {
    switch (status) {
      case 'employed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'self-employed':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'unemployed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'student':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const handleSave = async (data: any) => {
    // Data is already saved in TenantEditForm, just close the dialog
    setIsEditing(false);
    setOpen(false);
    // Trigger a page refresh or data refetch if needed
    window.location.reload();
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (mode === 'edit') {
      setOpen(false);
    }
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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-modal-background border-0 shadow-elevated">
        <DialogHeader className={`pb-6 border-b ${isEditing ? 'border-modal-edit-accent/20 bg-gradient-to-r from-modal-edit-accent/5 to-modal-edit-accent/10' : 'border-modal-view-accent/20 bg-gradient-to-r from-modal-view-accent/5 to-modal-view-accent/10'} -m-6 mb-6 px-6 pt-6`}>
          <DialogTitle className={`flex items-center gap-3 text-lg font-semibold ${isEditing ? 'text-modal-edit-accent' : 'text-modal-view-accent'}`}>
            <div className={`p-2 rounded-lg ${isEditing ? 'bg-modal-edit-accent/10' : 'bg-modal-view-accent/10'}`}>
              <User className="h-5 w-5" />
            </div>
            {isEditing ? 'Edit Tenant' : 'Tenant Details'}
          </DialogTitle>
        </DialogHeader>
        
        {isEditing ? (
          <TenantEditForm 
            tenant={tenant} 
            onSave={handleSave} 
            onCancel={handleCancel} 
          />
        ) : (
          <>
            <div className="space-y-6">
          {/* Personal Information */}
          <div className="bg-modal-card border border-modal-view-accent/10 p-6 rounded-xl shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-modal-view-accent flex items-center gap-2 pb-2 border-b border-modal-view-accent/10">
              <User className="h-4 w-4" />
              Personal Information
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">Full Name</label>
                <p className="text-modal-value font-semibold text-lg">{tenant.first_name} {tenant.last_name}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">Profession</label>
                <p className="text-modal-value font-medium">{tenant.profession || 'Not specified'}</p>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-modal-card border border-modal-view-accent/10 p-6 rounded-xl shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-modal-view-accent flex items-center gap-2 pb-2 border-b border-modal-view-accent/10">
              <Phone className="h-4 w-4" />
              Contact Information
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  Email
                </label>
                <p className="text-modal-value font-semibold">{tenant.email}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  Phone
                </label>
                <p className="text-modal-value font-medium">{tenant.phone || 'Not provided'}</p>
              </div>
            </div>
          </div>

          {/* Identification & Employment */}
          <div className="bg-modal-card border border-modal-view-accent/10 p-6 rounded-xl shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-modal-view-accent flex items-center gap-2 pb-2 border-b border-modal-view-accent/10">
              <Shield className="h-4 w-4" />
              Identification & Employment
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">National ID / Passport</label>
                <p className="text-modal-value font-medium">{tenant.national_id || 'Not provided'}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">Employment Status</label>
                {tenant.employment_status ? (
                  <Badge className={getEmploymentColor(tenant.employment_status)}>
                    {tenant.employment_status.charAt(0).toUpperCase() + tenant.employment_status.slice(1)}
                  </Badge>
                ) : (
                  <p className="text-modal-value font-medium">Not specified</p>
                )}
              </div>
            </div>
            {tenant.monthly_income && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Monthly Income
                </label>
                <p className="text-xl font-bold text-success">{formatCurrency(tenant.monthly_income)}</p>
              </div>
            )}
          </div>

          {/* Emergency Contact */}
          {(tenant.emergency_contact_name || tenant.emergency_contact_phone) && (
            <div className="bg-modal-card border border-modal-view-accent/10 p-6 rounded-xl shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-modal-view-accent pb-2 border-b border-modal-view-accent/10">Emergency Contact</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">Contact Name</label>
                  <p className="text-modal-value font-medium">{tenant.emergency_contact_name || 'Not provided'}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">Contact Phone</label>
                  <p className="text-modal-value font-medium">{tenant.emergency_contact_phone || 'Not provided'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Additional Information */}
          <div className="bg-modal-card border border-modal-view-accent/10 p-6 rounded-xl shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-modal-view-accent pb-2 border-b border-modal-view-accent/10">Additional Information</h3>
            <div className="space-y-4">
              {tenant.previous_address && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">Previous Address</label>
                  <p className="text-modal-value font-medium">{tenant.previous_address}</p>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Registration Date
                </label>
                <p className="text-modal-value font-medium">{formatDate(tenant.created_at)}</p>
              </div>
            </div>
          </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-modal-view-accent/10">
            <Button variant="outline" onClick={() => setOpen(false)} className="border-modal-view-accent/20 text-modal-view-accent hover:bg-modal-view-accent/10">
              Close
            </Button>
            {hasPermission('manage_tenants') && (
              <ResendCredentialsDialog 
                tenant={{
                  id: tenant.id,
                  email: tenant.email,
                  first_name: tenant.first_name,
                  last_name: tenant.last_name,
                  phone: tenant.phone || ''
                }}
              >
                <Button variant="outline" className="border-modal-view-accent/20 text-modal-view-accent hover:bg-modal-view-accent/10">
                  <Send className="h-4 w-4 mr-1" />
                  Resend Login
                </Button>
              </ResendCredentialsDialog>
            )}
            <Button onClick={() => setIsEditing(true)} className="bg-modal-view-accent hover:bg-modal-view-accent/90 text-white">
              <Edit className="h-4 w-4 mr-1" />
              Edit Tenant
            </Button>
          </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}