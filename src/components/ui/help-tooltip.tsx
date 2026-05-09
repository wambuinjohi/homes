import * as React from "react";
import { Info, HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HelpTooltipProps {
  content: string;
  title?: string;
  side?: "top" | "right" | "bottom" | "left";
  icon?: "info" | "help";
  className?: string;
  children?: React.ReactNode;
}

export function HelpTooltip({
  content,
  title,
  side = "top",
  icon = "help",
  className,
  children
}: HelpTooltipProps) {
  const IconComponent = icon === "info" ? Info : HelpCircle;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children || (
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center rounded-full",
                "text-muted-foreground hover:text-foreground",
                "transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                "h-4 w-4",
                className
              )}
              aria-label="Help information"
            >
              <IconComponent className="h-4 w-4" />
            </button>
          )}
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          {title && (
            <div className="font-semibold mb-1">{title}</div>
          )}
          <div className="text-sm">{content}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
