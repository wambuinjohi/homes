import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, HelpCircle } from "lucide-react";
import { CreateSupportTicketDialog } from "./CreateSupportTicketDialog";

interface ContactSupportButtonProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  showIcon?: boolean;
  className?: string;
  context?: string; // To provide context about where the button was clicked
}

export function ContactSupportButton({ 
  variant = "outline", 
  size = "sm",
  showIcon = true,
  className = "",
  context
}: ContactSupportButtonProps) {
  return (
    <CreateSupportTicketDialog>
      <Button
        variant={variant}
        size={size}
        className={`gap-2 ${className}`}
      >
        {showIcon && <HelpCircle className="h-4 w-4" />}
        Contact Support
      </Button>
    </CreateSupportTicketDialog>
  );
}