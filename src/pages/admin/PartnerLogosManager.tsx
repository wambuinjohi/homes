import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, ExternalLink, GripVertical, Image as ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PartnerLogo {
  id: string;
  company_name: string;
  logo_url: string;
  website_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export default function PartnerLogosManager() {
  const { toast } = useToast();
  const [logos, setLogos] = useState<PartnerLogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSection, setShowSection] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [logoToDelete, setLogoToDelete] = useState<string | null>(null);
  const [editingLogo, setEditingLogo] = useState<PartnerLogo | null>(null);
  const [formData, setFormData] = useState({
    company_name: "",
    logo_url: "",
    website_url: "",
  });

  useEffect(() => {
    fetchLogos();
    fetchSectionSetting();
  }, []);

  const fetchLogos = async () => {
    try {
      const { data, error } = await supabase
        .from("partner_logos")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      setLogos(data || []);
    } catch (error) {
      console.error("Error fetching logos:", error);
      toast({
        title: "Error",
        description: "Failed to load partner logos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSectionSetting = async () => {
    try {
      const { data, error } = await supabase
        .from("billing_settings")
        .select("setting_value")
        .eq("setting_key", "show_partner_logos")
        .single();

      if (error && error.code !== "PGRST116") throw error;
      setShowSection(data?.setting_value === "true" || data?.setting_value === true);
    } catch (error) {
      console.error("Error fetching section setting:", error);
    }
  };

  const toggleSectionVisibility = async (enabled: boolean) => {
    try {
      const { error } = await supabase
        .from("billing_settings")
        .upsert({
          setting_key: "show_partner_logos",
          setting_value: enabled,
          description: "Toggle to show/hide partner logos section on landing page",
        });

      if (error) throw error;
      setShowSection(enabled);
      toast({
        title: enabled ? "Section Enabled" : "Section Disabled",
        description: enabled
          ? "Partner logos section will now be visible on the landing page"
          : "Partner logos section is now hidden from the landing page",
      });
    } catch (error) {
      console.error("Error updating section setting:", error);
      toast({
        title: "Error",
        description: "Failed to update section visibility",
        variant: "destructive",
      });
    }
  };

  const toggleLogoActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("partner_logos")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
      setLogos((prev) =>
        prev.map((logo) => (logo.id === id ? { ...logo, is_active: isActive } : logo))
      );
      toast({
        title: isActive ? "Logo Activated" : "Logo Deactivated",
        description: `Logo is now ${isActive ? "visible" : "hidden"} on the landing page`,
      });
    } catch (error) {
      console.error("Error toggling logo:", error);
      toast({
        title: "Error",
        description: "Failed to update logo status",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingLogo) {
        const { error } = await supabase
          .from("partner_logos")
          .update({
            company_name: formData.company_name,
            logo_url: formData.logo_url,
            website_url: formData.website_url || null,
          })
          .eq("id", editingLogo.id);

        if (error) throw error;
        toast({ title: "Success", description: "Partner logo updated" });
      } else {
        const maxOrder = logos.length > 0 ? Math.max(...logos.map((l) => l.display_order)) : 0;
        const { error } = await supabase.from("partner_logos").insert({
          company_name: formData.company_name,
          logo_url: formData.logo_url,
          website_url: formData.website_url || null,
          display_order: maxOrder + 1,
          is_active: false,
        });

        if (error) throw error;
        toast({ title: "Success", description: "Partner logo added" });
      }

      setDialogOpen(false);
      setEditingLogo(null);
      setFormData({ company_name: "", logo_url: "", website_url: "" });
      fetchLogos();
    } catch (error) {
      console.error("Error saving logo:", error);
      toast({
        title: "Error",
        description: "Failed to save partner logo",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!logoToDelete) return;
    try {
      const { error } = await supabase.from("partner_logos").delete().eq("id", logoToDelete);
      if (error) throw error;
      toast({ title: "Deleted", description: "Partner logo removed" });
      setLogos((prev) => prev.filter((l) => l.id !== logoToDelete));
    } catch (error) {
      console.error("Error deleting logo:", error);
      toast({
        title: "Error",
        description: "Failed to delete partner logo",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setLogoToDelete(null);
    }
  };

  const openEditDialog = (logo: PartnerLogo) => {
    setEditingLogo(logo);
    setFormData({
      company_name: logo.company_name,
      logo_url: logo.logo_url,
      website_url: logo.website_url || "",
    });
    setDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingLogo(null);
    setFormData({ company_name: "", logo_url: "", website_url: "" });
    setDialogOpen(true);
  };

  const activeCount = logos.filter((l) => l.is_active).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Partner Logos</h1>
            <p className="text-muted-foreground">
              Manage company logos displayed on the landing page
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Logo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingLogo ? "Edit Partner Logo" : "Add Partner Logo"}</DialogTitle>
                <DialogDescription>
                  {editingLogo
                    ? "Update the partner logo details"
                    : "Add a new company logo to display on the landing page"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name *</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, company_name: e.target.value }))}
                    placeholder="Acme Properties"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logo_url">Logo URL *</Label>
                  <Input
                    id="logo_url"
                    type="url"
                    value={formData.logo_url}
                    onChange={(e) => setFormData((prev) => ({ ...prev, logo_url: e.target.value }))}
                    placeholder="https://example.com/logo.png"
                    required
                  />
                  {formData.logo_url && (
                    <div className="mt-2 p-4 bg-muted rounded-lg flex items-center justify-center">
                      <img
                        src={formData.logo_url}
                        alt="Preview"
                        className="max-h-16 max-w-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website_url">Website URL (optional)</Label>
                  <Input
                    id="website_url"
                    type="url"
                    value={formData.website_url}
                    onChange={(e) => setFormData((prev) => ({ ...prev, website_url: e.target.value }))}
                    placeholder="https://example.com"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">{editingLogo ? "Save Changes" : "Add Logo"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Global Section Toggle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Section Visibility</span>
              <Switch checked={showSection} onCheckedChange={toggleSectionVisibility} />
            </CardTitle>
            <CardDescription>
              {showSection
                ? `Partner logos section is VISIBLE on the landing page (${activeCount} active logos)`
                : "Partner logos section is HIDDEN from the landing page"}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Logos Table */}
        <Card>
          <CardHeader>
            <CardTitle>Partner Logos ({logos.length})</CardTitle>
            <CardDescription>
              Toggle individual logos on/off and manage their display order
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : logos.length === 0 ? (
              <div className="text-center py-8">
                <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2 text-muted-foreground">No partner logos added yet</p>
                <Button variant="outline" className="mt-4" onClick={openAddDialog}>
                  Add Your First Logo
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Logo</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead className="text-center">Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logos.map((logo) => (
                    <TableRow key={logo.id}>
                      <TableCell>
                        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      </TableCell>
                      <TableCell>
                        <div className="h-10 w-24 bg-muted rounded flex items-center justify-center p-1">
                          <img
                            src={logo.logo_url}
                            alt={logo.company_name}
                            className="max-h-full max-w-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/placeholder.svg";
                            }}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{logo.company_name}</TableCell>
                      <TableCell>
                        {logo.website_url ? (
                          <a
                            href={logo.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            Visit <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={logo.is_active}
                          onCheckedChange={(checked) => toggleLogoActive(logo.id, checked)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(logo)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setLogoToDelete(logo.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Partner Logo?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The logo will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
