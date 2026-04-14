/**
 * LinkedIn Flow — State management (extracted from useLinkedInFlow)
 */
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LinkedInFlowPhase = "idle" | "scraping" | "deep_search" | "enriching" | "generating" | "paused" | "completed" | "error";

export interface LinkedInFlowProgress {
  total: number;
  processed: number;
  success: number;
  errors: number;
}

export function useLinkedInFlowState() {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [phase, setPhase] = useState<LinkedInFlowPhase>("idle");
  const [progress, setProgress] = useState<LinkedInFlowProgress>({ total: 0, processed: 0, success: 0, errors: 0 });
  const [currentContact, setCurrentContact] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const abortRef = useRef(false);
  const runningRef = useRef(false);

  // Listen for realtime updates on the job
  useEffect(() => {
    if (!activeJobId) return;
    const channel = supabase
      .channel(`li-flow-${activeJobId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "linkedin_flow_jobs",
        filter: `id=eq.${activeJobId}`,
      }, (payload: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any -- realtime payload
        const row = payload.new as never;
        setProgress({
          total: row.total_count,
          processed: row.processed_count,
          success: row.success_count,
          errors: row.error_count,
        });
        if (row.status === "completed" || row.status === "cancelled") {
          setPhase(row.status === "completed" ? "completed" : "idle");
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeJobId]);

  return {
    activeJobId, setActiveJobId,
    phase, setPhase,
    progress, setProgress,
    currentContact, setCurrentContact,
    currentStep, setCurrentStep,
    abortRef, runningRef,
    isRunning: phase === "scraping" || phase === "enriching" || phase === "deep_search" || phase === "generating",
  };
}
