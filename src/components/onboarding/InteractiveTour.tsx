import React, { useEffect } from 'react';
import { useTour } from '@/hooks/useTour';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PlayCircle, XCircle } from 'lucide-react';

interface InteractiveTourProps {
  tourId: string;
  autoStart?: boolean;
  showPrompt?: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
}

export function InteractiveTour({ 
  tourId, 
  autoStart = false, 
  showPrompt = true,
  onComplete,
  onSkip 
}: InteractiveTourProps) {
  const { startTour, skipTour, getTourStatus, loading } = useTour();
  const [showPromptCard, setShowPromptCard] = React.useState(showPrompt);
  const [tourStatus, setTourStatus] = React.useState<string | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      const status = await getTourStatus(tourId);
      setTourStatus(status);

      if (autoStart && status !== 'completed' && status !== 'skipped') {
        // Small delay to ensure DOM elements are rendered
        setTimeout(() => {
          startTour(tourId);
        }, 500);
      }
    };

    checkStatus();
  }, [tourId, autoStart, getTourStatus]);

  const handleStartTour = () => {
    setShowPromptCard(false);
    startTour(tourId);
    onComplete?.();
  };

  const handleSkipTour = () => {
    setShowPromptCard(false);
    skipTour(tourId);
    onSkip?.();
  };

  // Don't show prompt if tour is already completed or skipped
  if (tourStatus === 'completed' || tourStatus === 'skipped') {
    return null;
  }

  // If autoStart is enabled or showPrompt is false, don't render the card
  if (!showPromptCard || autoStart) {
    return null;
  }

  return (
    <Card className="p-6 mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-full bg-primary/10">
          <PlayCircle className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-2">Take a Quick Tour</h3>
          <p className="text-muted-foreground mb-4">
            Let us show you around! This interactive tour will help you understand the key features and how to use them effectively.
          </p>
          <div className="flex gap-3">
            <Button 
              onClick={handleStartTour} 
              disabled={loading}
              className="gap-2"
            >
              <PlayCircle className="h-4 w-4" />
              Start Tour
            </Button>
            <Button 
              onClick={handleSkipTour} 
              variant="outline"
              disabled={loading}
              className="gap-2"
            >
              <XCircle className="h-4 w-4" />
              Skip for Now
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
