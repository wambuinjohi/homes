import { useState } from "react";
import { formatAmount, getGlobalCurrencySync } from "@/utils/currency";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Wrench, User, Calendar, DollarSign, AlertTriangle, Clock, CheckCircle, 
  MessageSquare, History, Image as ImageIcon, Phone, Mail, MapPin,
  Edit, Save, X, FileText, Upload, Trash2
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDropzone } from "react-dropzone";

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
  assigned_to?: string;
  images: string[];
  landlord_images?: string[];
  internal_notes?: string;
  last_updated_by?: string;
  last_status_change: string;
  tenants?: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  properties?: {
    name: string;
  };
  units?: {
    unit_number: string;
  };
  service_providers?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  notes?: Array<{
    id: string;
    note: string;
    user_id: string;
    is_internal: boolean;
    created_at: string;
    profiles?: {
      first_name: string;
      last_name: string;
    };
  }>;
  action_logs?: Array<{
    id: string;
    action_type: string;
    old_value?: string;
    new_value?: string;
    details?: any;
    created_at: string;
    profiles?: {
      first_name: string;
      last_name: string;
    };
  }>;
}

interface ServiceProvider {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  specialties: string[];
  is_active: boolean;
}

interface MaintenanceDetailsModalProps {
  request: MaintenanceRequest;
  serviceProviders: ServiceProvider[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (requestId: string, newStatus: string, oldStatus: string) => void;
  onAssignServiceProvider: (requestId: string, serviceProviderId: string) => void;
  onAddNote: (requestId: string, note: string, isInternal: boolean) => void;
}

export function MaintenanceDetailsModal({
  request,
  serviceProviders,
  open,
  onOpenChange,
  onStatusChange,
  onAssignServiceProvider,
  onAddNote
}: MaintenanceDetailsModalProps) {
  const [newNote, setNewNote] = useState("");
  const [isInternal, setIsInternal] = useState(true);
  const [rejectReason, setRejectReason] = useState("");
  const [estimatedCost, setEstimatedCost] = useState(request.cost?.toString() || "");
  const [scheduledDate, setScheduledDate] = useState(
    request.scheduled_date ? format(new Date(request.scheduled_date), "yyyy-MM-dd'T'HH:mm") : ""
  );
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [landlordImages, setLandlordImages] = useState<string[]>(request.landlord_images || []);
  const [uploadingImages, setUploadingImages] = useState(false);

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    },
    maxSize: 5242880, // 5MB
    onDrop: handleImageDrop
  });

  async function handleImageDrop(acceptedFiles: File[]) {
    if (acceptedFiles.length === 0) return;
    
    setUploadingImages(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of acceptedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${request.id}/landlord_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('maintenance-images')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('maintenance-images')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      const newLandlordImages = [...landlordImages, ...uploadedUrls];
      setLandlordImages(newLandlordImages);

      // Update database
      const { error: updateError } = await supabase
        .from('maintenance_requests')
        .update({ landlord_images: newLandlordImages })
        .eq('id', request.id);

      if (updateError) throw updateError;

      toast.success(`${acceptedFiles.length} photo(s) uploaded successfully`);
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error('Failed to upload photos. Please try again.');
    } finally {
      setUploadingImages(false);
    }
  }

  const handleRemoveLandlordImage = async (imageUrl: string) => {
    try {
      const newLandlordImages = landlordImages.filter(url => url !== imageUrl);
      setLandlordImages(newLandlordImages);

      const { error } = await supabase
        .from('maintenance_requests')
        .update({ landlord_images: newLandlordImages })
        .eq('id', request.id);

      if (error) throw error;

      toast.success('Photo removed');
    } catch (error) {
      console.error('Error removing image:', error);
      toast.error('Failed to remove photo');
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'Not specified';
    return formatAmount(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-warning text-warning-foreground";
      case "in_review":
        return "bg-info text-info-foreground";
      case "assigned":
        return "bg-accent text-accent-foreground";
      case "in_progress":
        return "bg-primary text-primary-foreground";
      case "resolved":
      case "completed":
        return "bg-success text-success-foreground";
      case "rejected":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
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
        return "bg-muted text-muted-foreground";
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

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "rejected") {
      if (!showRejectReason) {
        setShowRejectReason(true);
        return;
      }
      if (!rejectReason.trim()) {
        toast.error("Please provide a reason for rejection");
        return;
      }
    }
    
    onStatusChange(request.id, newStatus, request.status);
    
    if (newStatus === "rejected") {
      onAddNote(request.id, `Request rejected: ${rejectReason}`, false);
      setRejectReason("");
      setShowRejectReason(false);
    }
  };

  const handleSaveScheduleAndCost = async () => {
    try {
      const updateData: any = {};
      
      if (scheduledDate) {
        updateData.scheduled_date = new Date(scheduledDate).toISOString();
      }
      
      if (estimatedCost && !isNaN(Number(estimatedCost))) {
        updateData.cost = Number(estimatedCost);
      }

      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from("maintenance_requests")
          .update(updateData)
          .eq("id", request.id);

        if (error) throw error;
        
        toast.success("Schedule and cost updated successfully");
        // Force refresh parent component
        window.location.reload();
      }
    } catch (error) {
      console.error("Error updating schedule/cost:", error);
      toast.error("Failed to update schedule and cost");
    }
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    onAddNote(request.id, newNote, isInternal);
    setNewNote("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Maintenance Request Details
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="communication">Communication</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            {/* Request Header */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{request.title}</span>
                  <div className="flex gap-2">
                    <Badge className={getPriorityColor(request.priority)}>
                      {getPriorityIcon(request.priority)}
                      <span className="ml-1 capitalize">{request.priority}</span>
                    </Badge>
                    <Badge className={getStatusColor(request.status)}>
                      {request.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{request.description}</p>
                
                {/* Images */}
                {request.images && request.images.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Tenant Photos
                    </h4>
                    <div className="flex gap-2">
                      {request.images.map((image, index) => (
                        <img
                          key={index}
                          src={image}
                          alt={`Attachment ${index + 1}`}
                          className="w-20 h-20 object-cover rounded border"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Landlord Response Images */}
                {landlordImages && landlordImages.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2 text-success">
                      <ImageIcon className="h-4 w-4" />
                      Completion Photos
                    </h4>
                    <div className="flex gap-2">
                      {landlordImages.map((image, index) => (
                        <img
                          key={index}
                          src={image}
                          alt={`Completion ${index + 1}`}
                          className="w-20 h-20 object-cover rounded border-2 border-success"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Property & Tenant Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Property & Unit
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Property</label>
                    <p className="font-medium">{request.properties?.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Unit</label>
                    <p>{request.units?.unit_number || "Not specified"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Category</label>
                    <p className="capitalize">{request.category}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Tenant Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Name</label>
                    <p className="font-medium">
                      {request.tenants?.first_name} {request.tenants?.last_name}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {request.tenants?.email}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <p className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {request.tenants?.phone || "Not provided"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Timeline & Assignment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Submitted</label>
                    <p>{format(new Date(request.submitted_date), 'PPP')}</p>
                  </div>
                  {request.scheduled_date && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Scheduled</label>
                      <p>{format(new Date(request.scheduled_date), 'PPP')}</p>
                    </div>
                  )}
                  {request.completed_date && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Completed</label>
                      <p>{format(new Date(request.completed_date), 'PPP')}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                    <p>{format(new Date(request.last_status_change), 'PPP')}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Assignment & Cost
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Assigned To</label>
                    <p className="font-medium">
                      {request.service_providers?.name || "Not assigned"}
                    </p>
                  </div>
                  {request.cost && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Cost</label>
                      <p className="text-lg font-bold text-green-600">{formatCurrency(request.cost)}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="communication" className="space-y-4">
            {/* Add Note */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add Note</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Add a note about this request..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="min-h-[100px]"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="internal"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                    />
                    <label htmlFor="internal" className="text-sm">
                      Internal note (not visible to tenant)
                    </label>
                  </div>
                  <Button onClick={handleAddNote} disabled={!newNote.trim()}>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Add Note
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Notes History */}
            {request.notes && request.notes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notes & Communication</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {request.notes.map((note) => (
                      <div
                        key={note.id}
                        className={`p-3 rounded-lg border-l-4 ${
                          note.is_internal 
                            ? 'bg-muted/50 border-l-orange-500' 
                            : 'bg-blue-50 border-l-blue-500'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {note.profiles?.first_name} {note.profiles?.last_name}
                            </span>
                            <Badge variant={note.is_internal ? "secondary" : "default"} className="text-xs">
                              {note.is_internal ? "Internal" : "Public"}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(note.created_at), 'MMM dd, yyyy HH:mm')}
                          </span>
                        </div>
                        <p className="text-sm">{note.note}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {request.action_logs && request.action_logs.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Activity History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {request.action_logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm capitalize">
                              {log.action_type.replace('_', ' ')}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm')}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            By: {log.profiles?.first_name} {log.profiles?.last_name}
                          </p>
                          {log.old_value && log.new_value && (
                            <p className="text-sm mt-1">
                              <span className="line-through text-red-600">{log.old_value}</span>
                              {" → "}
                              <span className="text-green-600">{log.new_value}</span>
                            </p>
                          )}
                          {log.new_value && !log.old_value && (
                            <p className="text-sm mt-1 text-green-600">{log.new_value}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No activity history available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            {/* Status Update */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Update Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {["pending", "in_review", "assigned", "in_progress", "resolved", "rejected"].map((status) => (
                    <Button
                      key={status}
                      variant={request.status === status ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleStatusChange(status)}
                      disabled={request.status === status}
                      className="capitalize"
                    >
                      {status.replace('_', ' ')}
                    </Button>
                  ))}
                </div>
                
                {showRejectReason && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Reason for Rejection</label>
                    <Textarea
                      placeholder="Please provide a reason for rejecting this request..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="min-h-[80px]"
                    />
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => handleStatusChange("rejected")}
                        disabled={!rejectReason.trim()}
                      >
                        Confirm Rejection
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          setShowRejectReason(false);
                          setRejectReason("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Service Provider Assignment */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Assign Service Provider</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={request.assigned_to || ""}
                  onValueChange={(value) => onAssignServiceProvider(request.id, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select service provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {serviceProviders.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        <div>
                          <div className="font-medium">{provider.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {provider.specialties.join(", ")}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Schedule & Cost */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Schedule & Cost Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Schedule Work</label>
                    <Input
                      type="datetime-local"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Estimated Cost ({getGlobalCurrencySync()})</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={estimatedCost}
                      onChange={(e) => setEstimatedCost(e.target.value)}
                    />
                  </div>
                </div>
                <Button onClick={handleSaveScheduleAndCost} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  Save Schedule & Cost
                </Button>
              </CardContent>
            </Card>

            {/* Upload Response Photos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Upload Completion Photos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    uploadingImages 
                      ? 'border-primary/50 bg-primary/5' 
                      : 'border-border hover:border-primary/50 hover:bg-accent/50'
                  }`}
                >
                  <input {...getInputProps()} disabled={uploadingImages} />
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">
                    {uploadingImages ? 'Uploading...' : 'Drop photos here or click to browse'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, JPEG or WEBP up to 5MB
                  </p>
                </div>

                {landlordImages.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Uploaded Photos ({landlordImages.length})</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {landlordImages.map((imageUrl, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={imageUrl}
                            alt={`Completion ${index + 1}`}
                            className="w-full h-24 object-cover rounded border"
                          />
                          <Button
                            size="icon"
                            variant="destructive"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveLandlordImage(imageUrl)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}