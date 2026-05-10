import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Edit, Home, DollarSign, Info, Calendar } from "lucide-react";
import { UnitEditForm } from "@/components/forms/UnitEditForm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Unit {
  id: string;
  unit_number: string;
  unit_type: string;
  bedrooms: number;
  bathrooms: number;
  square_feet?: number;
  rent_amount: number;
  security_deposit?: number;
  status: string;
  description?: string;
  property?: {
    name: string;
    address: string;
  };
  created_at: string;
}

interface UnitDetailsDialogProps {
  unit: Unit;
  mode: 'view' | 'edit';
  trigger?: React.ReactNode;
}

export function UnitDetailsDialog({ unit, mode, trigger }: UnitDetailsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(mode === 'edit');

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'vacant':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'occupied':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const handleSave = async (data: any) => {
    try {
      // Prepare update data, only include status if it's maintenance
      const updateData: any = {
        unit_number: data.unit_number,
        unit_type: data.unit_type,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        square_feet: data.square_feet,
        rent_amount: data.rent_amount,
        security_deposit: data.security_deposit,
        description: data.description,
        floor_area: data.floor_area,
        office_spaces: data.office_spaces,
        conference_rooms: data.conference_rooms,
        parking_spaces: data.parking_spaces,
        loading_docks: data.loading_docks
      };

      // Handle status updates:
      // - Set to 'maintenance' when explicitly requested  
      // - Set to 'vacant' when returning from maintenance (DB will update to 'occupied' if active lease exists)
      updateData.status = data.status === 'maintenance' ? 'maintenance' : 'vacant';

      const { error } = await supabase
        .from('units')
        .update(updateData)
        .eq('id', unit.id);

      if (error) throw error;
      
      toast.success('Unit updated successfully');
      setIsEditing(false);
      setOpen(false);
      
      // Trigger a refresh by calling the parent's refresh function
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error('Error updating unit:', error);
      toast.error('Failed to update unit');
    }
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
              <Home className="h-5 w-5" />
            </div>
            {isEditing ? 'Edit Unit' : 'Unit Details'}
          </DialogTitle>
        </DialogHeader>
        
        {isEditing ? (
          <UnitEditForm 
            unit={unit} 
            onSave={handleSave} 
            onCancel={handleCancel} 
          />
        ) : (
          <>
            <div className="space-y-6">
          {/* Basic Information */}
          <div className="bg-modal-card border border-modal-view-accent/10 p-6 rounded-xl shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-modal-view-accent flex items-center gap-2 pb-2 border-b border-modal-view-accent/10">
              <Home className="h-4 w-4" />
              Basic Information
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">Unit Number</label>
                <p className="text-2xl font-bold text-modal-view-accent">{unit.unit_number}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">Unit Type</label>
                <Badge variant="secondary" className="mt-2 bg-modal-view-accent/10 text-modal-view-accent border-modal-view-accent/20 font-medium">
                  {unit.unit_type}
                </Badge>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">Status</label>
              <Badge className={getStatusColor(unit.status)}>
                {unit.status.charAt(0).toUpperCase() + unit.status.slice(1)}
              </Badge>
            </div>
          </div>

          {/* Property Information */}
          {unit.property && (
            <div className="bg-modal-card border border-modal-view-accent/10 p-6 rounded-xl shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-modal-view-accent pb-2 border-b border-modal-view-accent/10">Property</h3>
              <div className="space-y-1">
                <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">Property Name</label>
                <p className="text-modal-value font-semibold">{unit.property.name}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">Address</label>
                <p className="text-modal-value font-medium">{unit.property.address}</p>
              </div>
            </div>
          )}

          {/* Unit Specifications */}
          <div className="bg-modal-card border border-modal-view-accent/10 p-6 rounded-xl shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-modal-view-accent flex items-center gap-2 pb-2 border-b border-modal-view-accent/10">
              <Info className="h-4 w-4" />
              Specifications
            </h3>
            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">Bedrooms</label>
                <p className="text-2xl font-bold text-modal-view-accent">{unit.bedrooms}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">Bathrooms</label>
                <p className="text-2xl font-bold text-modal-view-accent">{unit.bathrooms}</p>
              </div>
              {unit.square_feet && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">Square Feet</label>
                  <p className="text-2xl font-bold text-modal-view-accent">{unit.square_feet}</p>
                </div>
              )}
            </div>
          </div>

          {/* Financial Information */}
          <div className="bg-modal-card border border-modal-view-accent/10 p-6 rounded-xl shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-modal-view-accent flex items-center gap-2 pb-2 border-b border-modal-view-accent/10">
              <DollarSign className="h-4 w-4" />
              Financial Information
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">Monthly Rent</label>
                <p className="text-2xl font-bold text-success">{formatCurrency(unit.rent_amount)}</p>
              </div>
              {unit.security_deposit && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">Security Deposit</label>
                  <p className="text-xl font-semibold text-modal-view-accent">{formatCurrency(unit.security_deposit)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {unit.description && (
            <div className="bg-modal-card border border-modal-view-accent/10 p-6 rounded-xl shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-modal-view-accent pb-2 border-b border-modal-view-accent/10">Description</h3>
              <p className="text-modal-value leading-relaxed">{unit.description}</p>
            </div>
          )}

          {/* Additional Information */}
          <div className="bg-modal-card border border-modal-view-accent/10 p-6 rounded-xl shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-modal-view-accent pb-2 border-b border-modal-view-accent/10">Additional Information</h3>
            <div className="space-y-1">
              <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Created Date
              </label>
              <p className="text-modal-value font-medium">{formatDate(unit.created_at)}</p>
            </div>
          </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-modal-view-accent/10">
            <Button variant="outline" onClick={() => setOpen(false)} className="border-modal-view-accent/20 text-modal-view-accent hover:bg-modal-view-accent/10">
              Close
            </Button>
            <Button onClick={() => setIsEditing(true)} className="bg-modal-view-accent hover:bg-modal-view-accent/90 text-white">
              <Edit className="h-4 w-4 mr-1" />
              Edit Unit
            </Button>
          </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}