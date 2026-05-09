import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TablePaginator } from "@/components/ui/table-paginator";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Phone, Mail, Settings } from "lucide-react";

interface ServiceProvider {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  specialties: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const SPECIALTY_OPTIONS = [
  "plumbing",
  "electrical",
  "hvac",
  "appliance_repair",
  "general_maintenance",
  "carpentry",
  "painting",
  "roofing",
  "flooring",
  "cleaning",
  "landscaping",
  "pest_control",
  "security_systems",
  "water_heater",
  "pipe_repair",
  "air_conditioning",
  "heating",
  "wiring",
  "lighting",
  "refrigeration",
  "washing_machine",
  "other"
];

export function ServiceProviderManagement() {
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [totalProviders, setTotalProviders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ServiceProvider | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    specialties: [] as string[],
    is_active: true
  });
  const { page, pageSize, offset, setPage, setPageSize } = useUrlPageParam({ defaultPage: 1, pageSize: 10 });

  const fetchProviders = async () => {
    try {
      // Get total count
      const { count } = await supabase
        .from("service_providers")
        .select('*', { count: 'exact', head: true });

      setTotalProviders(count || 0);

      // Get paginated data
      const { data, error } = await supabase
        .from("service_providers")
        .select("*")
        .order("name")
        .range(offset, offset + pageSize - 1);

      if (error) throw error;
      setProviders(data || []);
    } catch (error) {
      console.error("Error fetching service providers:", error);
      toast.error("Failed to fetch service providers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, [page, pageSize]);

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      specialties: [],
      is_active: true
    });
    setEditingProvider(null);
  };

  const handleEdit = (provider: ServiceProvider) => {
    setEditingProvider(provider);
    setFormData({
      name: provider.name,
      email: provider.email || "",
      phone: provider.phone || "",
      specialties: provider.specialties,
      is_active: provider.is_active
    });
    setDialogOpen(true);
  };

  const handleAddNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Provider name is required");
      return;
    }

    try {
      const saveData = {
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        specialties: formData.specialties,
        is_active: formData.is_active
      };

      if (editingProvider) {
        const { error } = await supabase
          .from("service_providers")
          .update(saveData)
          .eq("id", editingProvider.id);

        if (error) throw error;
        toast.success("Service provider updated successfully");
      } else {
        const { error } = await supabase
          .from("service_providers")
          .insert([saveData]);

        if (error) throw error;
        toast.success("Service provider added successfully");
      }

      setDialogOpen(false);
      resetForm();
      fetchProviders();
    } catch (error) {
      console.error("Error saving service provider:", error);
      toast.error("Failed to save service provider");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this service provider?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("service_providers")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Service provider deleted successfully");
      fetchProviders();
    } catch (error) {
      console.error("Error deleting service provider:", error);
      toast.error("Failed to delete service provider");
    }
  };

  const handleSpecialtyToggle = (specialty: string) => {
    setFormData(prev => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter(s => s !== specialty)
        : [...prev.specialties, specialty]
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading service providers...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Service Provider Management
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddNew}>
                <Plus className="h-4 w-4 mr-2" />
                Add Provider
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingProvider ? "Edit Service Provider" : "Add New Service Provider"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Provider Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter provider name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="provider@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+254700123456"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Active Status</Label>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                      />
                      <span className="text-sm">
                        {formData.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Specialties</Label>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto border rounded p-3">
                    {SPECIALTY_OPTIONS.map((specialty) => (
                      <div key={specialty} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={specialty}
                          checked={formData.specialties.includes(specialty)}
                          onChange={() => handleSpecialtyToggle(specialty)}
                          className="rounded"
                        />
                        <label htmlFor={specialty} className="text-sm capitalize">
                          {specialty.replace('_', ' ')}
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Selected: {formData.specialties.length} specialties
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>
                    {editingProvider ? "Update" : "Add"} Provider
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {providers.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">No service providers found</p>
            <Button onClick={handleAddNew}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Provider
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Specialties</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((provider) => (
                <TableRow key={provider.id}>
                  <TableCell className="font-medium">{provider.name}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {provider.email && (
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3" />
                          {provider.email}
                        </div>
                      )}
                      {provider.phone && (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          {provider.phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {provider.specialties.slice(0, 3).map((specialty) => (
                        <Badge key={specialty} variant="secondary" className="text-xs">
                          {specialty.replace('_', ' ')}
                        </Badge>
                      ))}
                      {provider.specialties.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{provider.specialties.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={provider.is_active ? "default" : "secondary"}>
                      {provider.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(provider)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(provider.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        
        {/* Pagination */}
        <div className="mt-4">
          <TablePaginator
            currentPage={page}
            totalPages={Math.ceil(totalProviders / pageSize)}
            pageSize={pageSize}
            totalItems={totalProviders}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            showPageSizeSelector={true}
          />
        </div>
      </CardContent>
    </Card>
  );
}