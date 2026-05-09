import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updateInvoiceStatuses } from "@/utils/invoiceStatusUpdater";
import { Loader2, FileEdit, CheckCircle } from "lucide-react";

export const InvoiceStatusUpdater: React.FC = () => {
  const [invoiceIds, setInvoiceIds] = useState<string>("");
  const [status, setStatus] = useState<string>("unpaid");
  const [updating, setUpdating] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleUpdate = async () => {
    const ids = invoiceIds.split(',').map(id => id.trim()).filter(Boolean);
    
    if (ids.length === 0) {
      return;
    }

    setUpdating(true);
    setSuccess(false);
    
    const result = await updateInvoiceStatuses(
      ids, 
      status as any
    );
    
    if (result) {
      setSuccess(true);
      setInvoiceIds("");
      setTimeout(() => setSuccess(false), 3000);
    }
    
    setUpdating(false);
  };

  const quickUpdatePendingInvoices = async () => {
    const pendingIds = [
      '60ce7ed5-ec8a-4886-a9f9-4c15366496d8',
      '24a30ec1-2943-4f03-9ee9-36efb8141828'
    ];
    
    setUpdating(true);
    setSuccess(false);
    
    const result = await updateInvoiceStatuses(pendingIds, 'unpaid');
    
    if (result) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
    
    setUpdating(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileEdit className="h-5 w-5" />
          Invoice Status Updater
        </CardTitle>
        <CardDescription>
          Update invoice statuses in bulk. Useful for fixing status inconsistencies.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
          <AlertDescription>
            <strong>Quick Fix:</strong> Click below to update the 2 pending Kamoni invoices to 'unpaid' status
          </AlertDescription>
        </Alert>

        <Button 
          onClick={quickUpdatePendingInvoices}
          disabled={updating}
          variant="default"
          className="w-full"
        >
          {updating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Updating...
            </>
          ) : success ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Updated Successfully!
            </>
          ) : (
            "Update Kamoni's 2 Pending Invoices to Unpaid"
          )}
        </Button>

        <div className="border-t pt-6 space-y-4">
          <div>
            <Label htmlFor="invoice-ids">Invoice IDs (comma-separated)</Label>
            <Input
              id="invoice-ids"
              value={invoiceIds}
              onChange={(e) => setInvoiceIds(e.target.value)}
              placeholder="e.g., abc123, def456, ghi789"
              disabled={updating}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Enter one or more invoice IDs separated by commas
            </p>
          </div>

          <div>
            <Label htmlFor="status">New Status</Label>
            <Select value={status} onValueChange={setStatus} disabled={updating}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={handleUpdate}
            disabled={updating || !invoiceIds.trim()}
            className="w-full"
            variant="secondary"
          >
            {updating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <FileEdit className="h-4 w-4 mr-2" />
                Update Invoice Status
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
