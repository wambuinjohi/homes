import React from "react";
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

interface BillingPlan {
  id: string;
  name: string;
  price: number;
  billing_cycle: string;
  currency?: string;
}

interface DeleteBillingPlanDialogProps {
  plan: BillingPlan | null;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteBillingPlanDialog: React.FC<DeleteBillingPlanDialogProps> = ({
  plan,
  open,
  onClose,
  onConfirm,
}) => {
  if (!plan) return null;

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Billing Plan</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the billing plan "{plan.name}"? 
            This action cannot be undone and will affect any landlords currently subscribed to this plan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete Plan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};