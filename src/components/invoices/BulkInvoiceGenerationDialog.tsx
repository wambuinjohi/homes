import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, FileText, Users, Building, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatAmount } from "@/utils/currency";

interface BulkInvoiceGenerationDialogProps {
  onInvoicesGenerated?: () => void;
}

interface InvoicePreview {
  lease_id: string;
  invoice_id?: string;
  invoice_number: string;
  tenant_name: string;
  unit: string;
  property: string;
  amount: number;
  status: 'created' | 'skipped';
  reason?: string;
}

export function BulkInvoiceGenerationDialog({ onInvoicesGenerated }: BulkInvoiceGenerationDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<{
    invoices: InvoicePreview[];
    created_count: number;
    skipped_count: number;
    total_processed: number;
    invoice_month: string;
    due_date: string;
  } | null>(null);
  const { user } = useAuth();

  const handlePreview = async () => {
    if (!user?.id) return;
    
    try {
      setPreviewing(true);
      
      // Get current month as default
      const currentMonth = new Date();
      currentMonth.setDate(1); // First day of month
      
      const { data, error } = await supabase.rpc('generate_monthly_invoices_for_landlord', {
        p_landlord_id: user.id,
        p_invoice_month: currentMonth.toISOString().split('T')[0],
        p_dry_run: true
      }) as { data: any, error: any };

      if (error) throw error;
      
      if (data?.success) {
        setPreview({
          invoices: data.invoices || [],
          created_count: data.created_count || 0,
          skipped_count: data.skipped_count || 0,
          total_processed: data.total_processed || 0,
          invoice_month: data.invoice_month,
          due_date: data.due_date
        });
      } else {
        throw new Error(data?.error || 'Failed to generate preview');
      }
    } catch (error) {
      console.error('Preview error:', error);
      toast.error('Failed to generate preview');
    } finally {
      setPreviewing(false);
    }
  };

  const handleGenerate = async () => {
    if (!user?.id || !preview) return;
    
    try {
      setLoading(true);
      
      const currentMonth = new Date();
      currentMonth.setDate(1);
      
      const { data, error } = await supabase.rpc('generate_monthly_invoices_for_landlord', {
        p_landlord_id: user.id,
        p_invoice_month: currentMonth.toISOString().split('T')[0],
        p_dry_run: false
      }) as { data: any, error: any };

      if (error) throw error;
      
      if (data?.success) {
        toast.success(`Successfully generated ${data.created_count} invoices! ${data.skipped_count} were skipped (already exist).`);
        setOpen(false);
        setPreview(null);
        onInvoicesGenerated?.();
      } else {
        throw new Error(data?.error || 'Failed to generate invoices');
      }
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPreview(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
          onClick={handlePreview}
        >
          <Plus className="h-4 w-4 mr-2" />
          Generate Monthly Invoices
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-card">
        <DialogHeader>
          <DialogTitle className="text-primary">Generate Monthly Invoices</DialogTitle>
          <DialogDescription>
            Generate invoices for all active leases for the current month
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto space-y-6">
          {!preview ? (
            <div className="text-center py-8">
              <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                Preview will show you exactly which invoices will be generated
              </p>
              <Button onClick={handlePreview} disabled={previewing}>
                {previewing ? "Loading..." : "Generate Preview"}
              </Button>
            </div>
          ) : (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="card-gradient-blue">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-white flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      To Create
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">{preview.created_count}</div>
                  </CardContent>
                </Card>
                
                <Card className="card-gradient-orange">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-white flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      To Skip
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-white">{preview.skipped_count}</div>
                  </CardContent>
                </Card>
                
                <Card className="card-gradient-green">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-white flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      Month
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-white">
                      {new Date(preview.invoice_month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="card-gradient-purple">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-white flex items-center">
                      <Calendar className="h-4 w-4 mr-2" />
                      Due Date
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold text-white">
                      {new Date(preview.due_date).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Invoice List */}
              <Card className="bg-card">
                <CardHeader>
                  <CardTitle className="text-primary">Invoice Preview ({preview.total_processed})</CardTitle>
                </CardHeader>
                <CardContent className="max-h-96 overflow-auto">
                  <div className="space-y-2">
                    {preview.invoices.map((invoice, index) => (
                      <div 
                        key={`${invoice.lease_id}-${index}`}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-accent/10 rounded-lg">
                            <FileText className="h-4 w-4 text-accent" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-primary">{invoice.tenant_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {invoice.property} • Unit {invoice.unit}
                            </p>
                            {invoice.reason && (
                              <p className="text-xs text-muted-foreground">{invoice.reason}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-semibold text-primary">{formatAmount(invoice.amount)}</p>
                            <p className="text-xs text-muted-foreground">{invoice.invoice_number}</p>
                          </div>
                          <Badge 
                            variant={invoice.status === 'created' ? 'default' : 'secondary'}
                            className={invoice.status === 'created' ? 'bg-success text-success-foreground' : 'bg-warning text-warning-foreground'}
                          >
                            {invoice.status === 'created' ? 'New' : 'Skip'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-border">
                <Button variant="outline" onClick={handleReset}>
                  Generate New Preview
                </Button>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleGenerate} 
                    disabled={loading || preview.created_count === 0}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    {loading ? "Generating..." : `Generate ${preview.created_count} Invoices`}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}