import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Edit, Building2, MapPin, Info, Calendar } from "lucide-react";
import { PropertyEditForm } from "@/components/forms/PropertyEditForm";
import { supabase } from "@/integrations/supabase/client";

interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  property_type: string;
  total_units: number;
  description?: string;
  amenities?: string[];
  created_at: string;
}

interface PropertyDetailsDialogProps {
  property: Property;
  mode: 'view' | 'edit';
  trigger?: React.ReactNode;
  onUpdated?: () => void;
}

export function PropertyDetailsDialog({ property, mode, trigger, onUpdated }: PropertyDetailsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(mode === 'edit');

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleSave = async (data: any) => {
    const updatePayload = {
      name: data.name,
      address: data.address,
      city: data.city,
      state: data.state,
      zip_code: data.zip_code,
      property_type: data.property_type,
      total_units: data.total_units,
      description: data.description || null,
      amenities: Array.isArray(data.amenities) ? data.amenities : null,
      updated_at: new Date().toISOString(),
    } as const;

    const { error } = await supabase
      .from('properties')
      .update(updatePayload)
      .eq('id', property.id);

    if (error) {
      throw error;
    }

    setIsEditing(false);
    setOpen(false);
    onUpdated?.();
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
              <Building2 className="h-5 w-5" />
            </div>
            {isEditing ? 'Edit Property' : 'Property Details'}
          </DialogTitle>
        </DialogHeader>

        {isEditing ? (
          <PropertyEditForm
            property={property}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        ) : (
          <>
            <div className="space-y-6">
            {/* Basic Information */}
            <div className="bg-modal-card border border-modal-view-accent/10 p-6 rounded-xl shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-modal-view-accent flex items-center gap-2 pb-2 border-b border-modal-view-accent/10">
                <Building2 className="h-4 w-4" />
                Basic Information
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">Property Name</label>
                  <p className="text-modal-value font-semibold text-lg">{property.name}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">Property Type</label>
                  <Badge variant="secondary" className="mt-2 bg-modal-view-accent/10 text-modal-view-accent border-modal-view-accent/20 font-medium">
                    {property.property_type}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Location Details */}
            <div className="bg-modal-card border border-modal-view-accent/10 p-6 rounded-xl shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-modal-view-accent flex items-center gap-2 pb-2 border-b border-modal-view-accent/10">
                <MapPin className="h-4 w-4" />
                Location
              </h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">Address</label>
                  <p className="text-modal-value font-medium">{property.address}</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">City</label>
                    <p className="text-modal-value font-medium">{property.city}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">County</label>
                    <p className="text-modal-value font-medium">{property.state}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">Postal Code</label>
                    <p className="text-modal-value font-medium">{property.zip_code}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Property Stats */}
            <div className="bg-modal-card border border-modal-view-accent/10 p-6 rounded-xl shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-modal-view-accent flex items-center gap-2 pb-2 border-b border-modal-view-accent/10">
                <Info className="h-4 w-4" />
                Property Statistics
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide">Total Units</label>
                  <p className="text-2xl font-bold text-modal-view-accent">{property.total_units}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-modal-muted-label uppercase tracking-wide flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Created Date
                  </label>
                  <p className="text-modal-value font-medium">{formatDate(property.created_at)}</p>
                </div>
              </div>
            </div>

            {/* Description */}
            {property.description && (
              <div className="bg-modal-card border border-modal-view-accent/10 p-6 rounded-xl shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-modal-view-accent pb-2 border-b border-modal-view-accent/10">Description</h3>
                <p className="text-modal-value leading-relaxed">{property.description}</p>
              </div>
            )}

            {/* Amenities */}
            {property.amenities && property.amenities.length > 0 && (
              <div className="bg-modal-card border border-modal-view-accent/10 p-6 rounded-xl shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-modal-view-accent pb-2 border-b border-modal-view-accent/10">Amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {property.amenities.map((amenity, index) => (
                    <Badge key={index} variant="outline" className="bg-modal-view-accent/5 text-modal-view-accent border-modal-view-accent/20 hover:bg-modal-view-accent/10">
                      {amenity}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-modal-view-accent/10">
            <Button variant="outline" onClick={() => setOpen(false)} className="border-modal-view-accent/20 text-modal-view-accent hover:bg-modal-view-accent/10">
              Close
            </Button>
            <Button onClick={() => setIsEditing(true)} className="bg-modal-view-accent hover:bg-modal-view-accent/90 text-white">
              <Edit className="h-4 w-4 mr-1" />
              Edit Property
            </Button>
          </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
