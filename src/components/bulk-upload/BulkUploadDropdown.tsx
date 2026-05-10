import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, FileText, Download, ChevronDown } from "lucide-react";
import { BulkUploadTenants } from "./BulkUploadTenants";
import { BulkUploadUnits } from "./BulkUploadUnits";
import { BulkUploadProperties } from "./BulkUploadProperties";
import { BulkUploadHistory } from "./BulkUploadHistory";
import { TrialFeatureBadge } from "@/components/trial/TrialFeatureBadge";
import { FEATURES } from "@/hooks/usePlanFeatureAccess";

interface BulkUploadDropdownProps {
  type: "tenants" | "units" | "properties";
  onSuccess?: () => void;
}

export function BulkUploadDropdown({ type, onSuccess }: BulkUploadDropdownProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeDialog, setActiveDialog] = useState<"upload" | "history" | null>(null);

  const typeConfig = {
    tenants: {
      label: "Tenants",
      icon: Upload,
      component: BulkUploadTenants
    },
    units: {
      label: "Units", 
      icon: Upload,
      component: BulkUploadUnits
    },
    properties: {
      label: "Properties",
      icon: Upload,
      component: BulkUploadProperties
    }
  };

  const config = typeConfig[type];
  const UploadComponent = config.component;

  const handleUploadClick = () => {
    setActiveDialog("upload");
    setDialogOpen(true);
  };

  const handleHistoryClick = () => {
    setActiveDialog("history");
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setActiveDialog(null);
    if (onSuccess) onSuccess();
  };

  return (
    <>
      <TrialFeatureBadge feature={FEATURES.BULK_OPERATIONS}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Upload className="h-4 w-4" />
              Bulk Actions
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
            <DropdownMenuItem onClick={handleUploadClick} className="gap-2">
              <Upload className="h-4 w-4" />
              Bulk Upload {config.label}
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <Download className="h-4 w-4" />
              Download Template
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleHistoryClick} className="gap-2">
              <FileText className="h-4 w-4" />
              Upload History
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TrialFeatureBadge>

      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activeDialog === "upload" ? (
                <>
                  <Upload className="h-5 w-5" />
                  Bulk Upload {config.label}
                </>
              ) : (
                <>
                  <FileText className="h-5 w-5" />
                  Upload History
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {activeDialog === "upload" && <UploadComponent />}
            {activeDialog === "history" && <BulkUploadHistory />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}