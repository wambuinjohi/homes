import { useState, useEffect, useCallback } from 'react';
import { driver, DriveStep, Config as DriverConfig } from 'driver.js';
import 'driver.js/dist/driver.css';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TourStep extends DriveStep {
  element: string;
  popover: {
    title: string;
    description: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
    align?: 'start' | 'center' | 'end';
  };
}

export interface Tour {
  id: string;
  name: string;
  steps: TourStep[];
  onComplete?: () => void;
  onSkip?: () => void;
}

interface UseTourReturn {
  startTour: (tourId: string) => void;
  skipTour: (tourId: string) => void;
  getTourStatus: (tourId: string) => Promise<string | null>;
  loading: boolean;
}

export function useTour(): UseTourReturn {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const updateTourProgress = useCallback(async (
    tourId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'skipped',
    lastStepIndex?: number
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const updateData: any = {
      tour_name: tourId,
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'in_progress') {
      updateData.started_at = new Date().toISOString();
      updateData.last_step_index = lastStepIndex || 0;
    }

    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    // Direct upsert until types are regenerated
    await supabase
      .from('user_tour_progress' as any)
      .upsert({
        user_id: user.id,
        ...updateData
      }, {
        onConflict: 'user_id,tour_name'
      });
  }, []);

  const trackFeatureDiscovery = useCallback(async (featureName: string, used: boolean = false) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // For now, skip feature tracking until types are regenerated
      // This will be populated in a future update
      console.log('Feature discovery:', featureName, used);
    } catch (error) {
      console.error('Error tracking feature discovery:', error);
    }
  }, []);

  const getTourStatus = useCallback(async (tourId: string): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    try {
      // Direct query until types are regenerated
      const { data, error } = await supabase
        .from('user_tour_progress' as any)
        .select('status')
        .eq('user_id', user.id)
        .eq('tour_name', tourId)
        .maybeSingle();

      if (error) {
        console.error('Error querying tour status:', error);
        return null;
      }

      return (data as any)?.status || null;
    } catch (error) {
      console.error('Error getting tour status:', error);
      return null;
    }
  }, []);

  const startTour = useCallback(async (tourId: string) => {
    setLoading(true);

    try {
      // Check if tour was already completed
      const status = await getTourStatus(tourId);
      if (status === 'completed') {
        toast({
          title: "Tour Already Completed",
          description: "You've already completed this tour.",
        });
        setLoading(false);
        return;
      }

      // Fetch tour configuration from database
      const { data: tourData, error } = await supabase
        .from('feature_tours')
        .select('*')
        .eq('tour_name', tourId)
        .eq('is_active', true)
        .single();

      if (error || !tourData) {
        console.error('Tour not found:', error);
        setLoading(false);
        return;
      }

      const steps = (Array.isArray(tourData.steps) ? tourData.steps : []) as unknown as TourStep[];

      // Mark as in progress
      await updateTourProgress(tourId, 'in_progress', 0);

      // Configure driver
      const driverConfig: DriverConfig = {
        showProgress: true,
        showButtons: ['next', 'previous', 'close'],
        steps: steps.map((step, index) => ({
          element: step.element,
          popover: {
            title: step.popover.title,
            description: step.popover.description,
            side: step.popover.side || 'bottom',
            align: step.popover.align || 'start',
            onNextClick: async () => {
              await updateTourProgress(tourId, 'in_progress', index + 1);
              await trackFeatureDiscovery(step.element, false);
              driverObj.moveNext();
            },
            onPrevClick: () => {
              driverObj.movePrevious();
            }
          }
        })),
        onDestroyed: async () => {
          const currentStep = driverObj.getActiveIndex();
          if (currentStep === steps.length - 1) {
            await updateTourProgress(tourId, 'completed');
            toast({
              title: "Tour Completed! 🎉",
              description: "Great job! You're now familiar with this feature.",
            });
          }
        }
      };

      const driverObj = driver(driverConfig);
      driverObj.drive();
    } catch (error) {
      console.error('Error starting tour:', error);
      toast({
        title: "Error",
        description: "Failed to start tour. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [getTourStatus, updateTourProgress, trackFeatureDiscovery, toast]);

  const skipTour = useCallback(async (tourId: string) => {
    await updateTourProgress(tourId, 'skipped');
    toast({
      title: "Tour Skipped",
      description: "You can restart this tour anytime from the help menu.",
    });
  }, [updateTourProgress, toast]);

  return {
    startTour,
    skipTour,
    getTourStatus,
    loading
  };
}
