import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Upload, X, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useDropzone } from 'react-dropzone';

export const CreateMaintenanceDialog: React.FC<{ onCreated?: () => void }> = ({ onCreated }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('medium');
  const [leases, setLeases] = useState<any[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (open) {
      fetchLeases();
    }
  }, [open]);

  const fetchLeases = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc('get_tenant_leases', { p_user_id: user.id });
      if (error) throw error;
      const leasesData = (data as any)?.leases || [];
      setLeases(leasesData || []);
      if (leasesData && leasesData.length > 0) setSelectedLeaseId(leasesData[0].id);
    } catch (err) {
      console.error('Error fetching tenant leases:', err);
      toast.error('Unable to fetch your leases. Please try again.');
    }
  };

  const onDrop = (acceptedFiles: File[]) => {
    const imageFiles = acceptedFiles.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length !== acceptedFiles.length) {
      toast.error('Only image files are allowed');
    }

    if (uploadedFiles.length + imageFiles.length > 5) {
      toast.error('Maximum 5 images allowed');
      return;
    }

    setUploadedFiles(prev => [...prev, ...imageFiles]);
    
    // Create previews
    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.heic']
    },
    maxSize: 5242880, // 5MB
    multiple: true
  });

  const removeImage = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('general');
    setPriority('medium');
    setSelectedLeaseId(null);
    setUploadedFiles([]);
    setImagePreviews([]);
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('You must be signed in to submit a request');
      return;
    }
    if (!selectedLeaseId) {
      toast.error('Please select a lease');
      return;
    }
    if (!title.trim()) {
      toast.error('Please provide a short title for the request');
      return;
    }
    if (!description.trim()) {
      toast.error('Please provide a description of the issue');
      return;
    }

    setLoading(true);
    setUploading(true);
    try {
      // Find lease object to extract tenant_id, property_id, unit_id
      const lease = leases.find((l: any) => l.id === selectedLeaseId);
      if (!lease) {
        toast.error('Selected lease not found');
        setLoading(false);
        setUploading(false);
        return;
      }

      // Upload images to Supabase Storage
      const imageUrls: string[] = [];
      if (uploadedFiles.length > 0) {
        for (const file of uploadedFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${user!.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('maintenance-images')
            .upload(fileName, file);

          if (uploadError) {
            console.error('Upload error:', uploadError);
            throw new Error(`Failed to upload ${file.name}`);
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('maintenance-images')
            .getPublicUrl(fileName);
          
          imageUrls.push(publicUrl);
        }
      }

      const insertPayload: any = {
        title: title.trim(),
        description: description.trim(),
        category: category,
        priority: priority,
        status: 'pending',
        submitted_date: new Date().toISOString(),
        tenant_id: lease.tenant_id,
        property_id: lease.property_id ?? lease.unit?.property_id ?? null,
        unit_id: lease.unit_id ?? null,
        images: imageUrls.length > 0 ? imageUrls : null
      };

      const { error } = await supabase.from('maintenance_requests').insert(insertPayload);
      if (error) throw error;

      toast.success('Maintenance request submitted with photos');
      setOpen(false);
      resetForm();
      onCreated?.();
    } catch (err: any) {
      console.error('Error creating maintenance request:', err);
      // Friendly error message
      let message = 'Failed to submit maintenance request';
      try {
        if (err?.message) message = err.message;
        else if (typeof err === 'string') message = err;
      } catch (e) {}
      toast.error(message);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button className="bg-accent hover:bg-accent/90">
          <PlusIcon /> New Request
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit Maintenance Request</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Lease <span className="text-destructive ml-1">*</span></label>
            <Select value={selectedLeaseId || ''} onValueChange={(v) => setSelectedLeaseId(v || null)}>
              <SelectTrigger>
                <SelectValue placeholder="Select lease" />
              </SelectTrigger>
              <SelectContent>
                {leases.map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.unit_number ? `${l.unit_number} — ${l.property_name}` : l.property_name} ({l.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Title <span className="text-destructive ml-1">*</span></label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Leaking faucet in kitchen" />
          </div>

          <div>
            <label className="text-sm font-medium">Description <span className="text-destructive ml-1">*</span></label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue in detail" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-sm font-medium">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="plumbing">Plumbing</SelectItem>
                  <SelectItem value="electrical">Electrical</SelectItem>
                  <SelectItem value="hvac">HVAC</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Priority</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              <ImageIcon className="inline h-4 w-4 mr-1" />
              Photos (Optional)
            </label>
            
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              {isDragActive ? (
                <p className="text-sm text-primary">Drop photos here...</p>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm">Drag & drop photos or click to browse</p>
                  <p className="text-xs text-muted-foreground">Max 5 images, 5MB each (JPG, PNG, WEBP)</p>
                </div>
              )}
            </div>

            {/* Image Previews */}
            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative group">
                    <img 
                      src={preview} 
                      alt={`Preview ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={loading || uploading}>
              {uploading ? 'Uploading photos...' : loading ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateMaintenanceDialog;

function PlusIcon() {
  return (
    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
