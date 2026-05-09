import React from "react";
import { cn } from "@/lib/utils";

interface KpiGridProps {
  children: React.ReactNode;
  className?: string;
}

export function KpiGrid({ children, className }: KpiGridProps) {
  return (
    <div className={cn(
      "grid gap-3 sm:gap-4 lg:gap-6 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
      className
    )}>
      {children}
    </div>
  );
}

export default KpiGrid;
