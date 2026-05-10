
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, FileText, Loader2 } from "lucide-react";

interface PDFGenerationProgressProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isGenerating: boolean;
  progress: number;
  currentStep: string;
  isComplete: boolean;
  reportTitle: string;
}

export const PDFGenerationProgress = ({
  open,
  onOpenChange,
  isGenerating,
  progress,
  currentStep,
  isComplete,
  reportTitle
}: PDFGenerationProgressProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generating PDF Report
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="text-center">
            <h3 className="font-medium text-foreground">{reportTitle}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Please wait while we generate your report
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            
            <Progress value={progress} className="h-2" />
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isComplete ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              <span>{currentStep}</span>
            </div>
          </div>

          {isComplete && (
            <div className="bg-success/10 border border-success/20 rounded-lg p-3 text-center">
              <CheckCircle className="h-6 w-6 text-success mx-auto mb-2" />
              <p className="text-sm font-medium text-success">
                PDF generated successfully!
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Your download should begin automatically
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
