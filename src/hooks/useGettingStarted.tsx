import { useState, useEffect } from "react";
import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export type GettingStartedStep = 
  | "add_property"
  | "add_units"
  | "add_tenants";

interface StepProgress {
  step_name: string;
  status: "pending" | "in_progress" | "completed" | "dismissed";
  completed_at: string | null;
  dismissed_at: string | null;
}

interface UseGettingStartedReturn {
  currentStep: GettingStartedStep | null;
  progress: number;
  isLoading: boolean;
  isStepComplete: (stepId: GettingStartedStep) => boolean;
  isStepDismissed: (stepId: GettingStartedStep) => boolean;
  completeStep: (stepId: GettingStartedStep) => Promise<void>;
  dismissStep: (stepId: GettingStartedStep) => Promise<void>;
  refetch: () => Promise<void>;
}

const STEPS_ORDER: GettingStartedStep[] = [
  "add_property",
  "add_units",
  "add_tenants",
];

export function useGettingStarted(): UseGettingStartedReturn {
  const [stepProgress, setStepProgress] = useState<StepProgress[]>([]);
  const [counts, setCounts] = useState({
    properties: 0,
    units: 0,
    tenants: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch user progress and entity counts
  const fetchProgress = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);

      // Fetch progress from database
      const { data: progressData, error: progressError } = await supabase
        .from("user_getting_started_progress")
        .select("*")
        .eq("user_id", user.id);

      if (progressError) throw progressError;

      setStepProgress((progressData || []) as StepProgress[]);

      // Fetch entity counts
      const [propertiesRes, unitsRes, tenantsRes] = await Promise.all([
        supabase.from("properties").select("id", { count: "exact", head: true }),
        supabase.from("units").select("id", { count: "exact", head: true }),
        supabase.from("tenants").select("id", { count: "exact", head: true }),
      ]);

      setCounts({
        properties: propertiesRes.count || 0,
        units: unitsRes.count || 0,
        tenants: tenantsRes.count || 0,
      });
    } catch (error) {
      let serialized: any;
      try { serialized = JSON.stringify(error, Object.getOwnPropertyNames(error as any)); } catch { serialized = String(error); }
      console.error("Error fetching getting started progress:", serialized);

      // Network/CORS fallback via server proxy
      try {
        const { data: session } = await supabase.auth.getSession();
        const access = session?.session?.access_token;
        const base = SUPABASE_URL.replace(/\/$/, '');

        // 1) Progress rows
        {
          const url = `${base}/rest/v1/user_getting_started_progress?select=*&user_id=eq.${encodeURIComponent(user.id)}`;
          const res = await fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(access ? { Authorization: `Bearer ${access}` } : {}) },
            body: JSON.stringify({ url, method: 'GET' })
          });
          const data = await res.json();
          if (res.ok && Array.isArray(data)) setStepProgress(data as StepProgress[]);
        }

        // 2) Counts (fallback by fetching ids and counting length client-side)
        const fetchCount = async (table: string) => {
          const url = `${base}/rest/v1/${table}?select=id`; // light select
          const res = await fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(access ? { Authorization: `Bearer ${access}` } : {}) },
            body: JSON.stringify({ url, method: 'GET' })
          });
          const data = await res.json();
          return Array.isArray(data) ? data.length : 0;
        };

        const [p, u, t] = await Promise.all([
          fetchCount('properties'),
          fetchCount('units'),
          fetchCount('tenants'),
        ]);
        setCounts({ properties: p, units: u, tenants: t });
      } catch (proxyErr) {
        console.error('Getting started proxy fallback failed:', proxyErr);
        // Leave defaults
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [user?.id]);

  // Determine current step based on data
  const getCurrentStep = (): GettingStartedStep | null => {
    // Check dismissed steps
    const dismissedSteps = stepProgress
      .filter((s) => s.status === "dismissed")
      .map((s) => s.step_name as GettingStartedStep);

    // If no properties, suggest adding one
    if (counts.properties === 0 && !dismissedSteps.includes("add_property")) {
      return "add_property";
    }

    // If properties but no units
    if (counts.properties > 0 && counts.units === 0 && !dismissedSteps.includes("add_units")) {
      return "add_units";
    }

    // If units but no tenants
    if (counts.units > 0 && counts.tenants === 0 && !dismissedSteps.includes("add_tenants")) {
      return "add_tenants";
    }

    return null; // All done!
  };

  const currentStep = getCurrentStep();

  // Calculate overall progress
  const calculateProgress = (): number => {
    const completedSteps = STEPS_ORDER.filter((step) => {
      switch (step) {
        case "add_property":
          return counts.properties > 0;
        case "add_units":
          return counts.units > 0;
        case "add_tenants":
          return counts.tenants > 0;
        default:
          return false;
      }
    }).length;

    return Math.round((completedSteps / STEPS_ORDER.length) * 100);
  };

  const progress = calculateProgress();

  // Check if step is complete
  const isStepComplete = (stepId: GettingStartedStep): boolean => {
    switch (stepId) {
      case "add_property":
        return counts.properties > 0;
      case "add_units":
        return counts.units > 0;
      case "add_tenants":
        return counts.tenants > 0;
      default:
        return false;
    }
  };

  // Check if step is dismissed
  const isStepDismissed = (stepId: GettingStartedStep): boolean => {
    return stepProgress.some((s) => s.step_name === stepId && s.status === "dismissed");
  };

  // Complete a step
  const completeStep = async (stepId: GettingStartedStep) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase.from("user_getting_started_progress").upsert(
        {
          user_id: user.id,
          step_name: stepId,
          status: "completed",
          completed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,step_name" }
      );

      if (error) throw error;

      await fetchProgress();
    } catch (error) {
      console.error("Error completing step:", error);
      toast({
        title: "Error",
        description: "Failed to update progress",
        variant: "destructive",
      });
    }
  };

  // Dismiss a step
  const dismissStep = async (stepId: GettingStartedStep) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase.from("user_getting_started_progress").upsert(
        {
          user_id: user.id,
          step_name: stepId,
          status: "dismissed",
          dismissed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,step_name" }
      );

      if (error) throw error;

      await fetchProgress();

      toast({
        title: "Step dismissed",
        description: "You can always access help from the support section",
      });
    } catch (error) {
      console.error("Error dismissing step:", error);
      toast({
        title: "Error",
        description: "Failed to dismiss step",
        variant: "destructive",
      });
    }
  };

  return {
    currentStep,
    progress,
    isLoading,
    isStepComplete,
    isStepDismissed,
    completeStep,
    dismissStep,
    refetch: fetchProgress,
  };
}
