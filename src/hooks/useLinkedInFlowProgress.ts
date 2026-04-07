import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LinkedInFlowPhase } from "./useLinkedInFlow";

export interface LinkedInFlowProgressState {
  activeJobId: string | null;
  setActiveJobId: React.Dispatch<React.SetStateAction<string | null>>;
  phase: LinkedInFlowPhase;
  setPhase: React.Dispatch<React.SetStateAction<LinkedInFlowPhase>>;
  progress: { total: number; processed: number; success: number; errors: number };
  setProgress: React.Dispatch<React.SetStateAction<{ total: number; processed: number; success: number; errors: number }>>;
  currentContact: string | null;
  setCurrentContact: React.Dispatch<React.SetStateAction<string | null>>;
  currentStep: string | null;
  setCurrentStep: React.Dispatch<React.SetStateAction<string | null>>;
  isRunning: boolean;
}

export function useLinkedInFlowProgress(): LinkedInFlowProgressState {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [phase, setPhase] = useState<LinkedInFlowPhase>("idle");
  const [progress, setProgress] = useState({ total: 0, processed: 0, success: 0, errors: 0 });
  const [currentContact, setCurrentContact] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string | null>(null);

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
      }, (payload: any) => {
        const row = payload.new;
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

  const isRunning = phase === "scraping" || phase === "enriching" || phase === "deep_search" || phase === "generating";

  return {
    activeJobId,
    setActiveJobId,
    phase,
    setPhase,
    progress,
    setProgress,
    currentContact,
    setCurrentContact,
    currentStep,
    setCurrentStep,
    isRunning,
  };
}
