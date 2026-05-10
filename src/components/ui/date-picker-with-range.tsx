import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface DateRange {
  from: Date;
  to: Date;
}

interface DatePickerWithRangeProps {
  date: DateRange;
  setDate: (date: DateRange) => void;
  className?: string;
}

export function DatePickerWithRange({ date, setDate, className }: DatePickerWithRangeProps) {
  return (
    <Button 
      variant="outline" 
      className={cn(
        "w-[200px] justify-start text-left font-normal bg-background border-border hover:bg-accent hover:text-accent-foreground",
        className
      )}
    >
      <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-foreground">
        {date.from.toLocaleDateString()} - {date.to.toLocaleDateString()}
      </span>
    </Button>
  );
}