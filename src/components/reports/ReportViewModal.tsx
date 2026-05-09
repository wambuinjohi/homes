import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ReportViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData?: any;
  reportType?: string;
}

export function ReportViewModal({ isOpen, onClose }: ReportViewModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Reports</DialogTitle>
        </DialogHeader>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Reports feature temporarily under maintenance</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}