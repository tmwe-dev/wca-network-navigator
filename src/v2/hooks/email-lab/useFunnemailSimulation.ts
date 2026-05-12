/**
 * useFunnemailSimulation — Hook per il dry-run di smistamento Funnemail.
 *
 * Round B Email Lab. Invoca `simulate-funnemail-classify` via gateway invokeAi
 * (charter-compliant) e fa polling su `pipeline_traces` filtrando per il
 * `trace_id` restituito dall'edge.
 */
import * as React from "react";
import { invokeAi } from "@/lib/ai/invokeAi";
import { supabaseUntyped } from "@/lib/supabaseUntyped";

export interface SimulationInput {
  from: string;
  subject: string;
  body: string;
  channel?: "email" | "whatsapp" | "linkedin";
}

export interface PipelineStep {
  id: string;
  step_name: string;
  step_order: number;
  status: string;
  error_message: string | null;
  input_summary: unknown;
  output_summary: unknown;
  ai_model: string | null;
  ai_scope: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface SimulationVerdict {
  traceId: string;
  classification: Record<string, unknown>;
  proposedGroup: string;
  proposedAction: string;
  knownPartner: { id: string; name: string | null } | null;
  domain: string;
  injectionBlocked: boolean;
}

export interface UseFunnemailSimulationState {
  loading: boolean;
  error: string | null;
  traceId: string | null;
  steps: PipelineStep[];
  verdict: SimulationVerdict | null;
  run: (input: SimulationInput) => Promise<void>;
  reset: () => void;
}

export function useFunnemailSimulation(): UseFunnemailSimulationState {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [traceId, setTraceId] = React.useState<string | null>(null);
  const [steps, setSteps] = React.useState<PipelineStep[]>([]);
  const [verdict, setVerdict] = React.useState<SimulationVerdict | null>(null);
  const pollRef = React.useRef<number | null>(null);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  const fetchSteps = React.useCallback(async (tid: string) => {
    const { data } = await supabaseUntyped
      .from("pipeline_traces")
      .select("*")
      .eq("trace_id", tid)
      .order("step_order", { ascending: true });
    if (mountedRef.current && Array.isArray(data)) {
      setSteps(data as unknown as PipelineStep[]);
    }
  }, []);

  const reset = React.useCallback(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = null;
    setLoading(false);
    setError(null);
    setTraceId(null);
    setSteps([]);
    setVerdict(null);
  }, []);

  const run = React.useCallback(async (input: SimulationInput) => {
    reset();
    setLoading(true);
    try {
      const res = await invokeAi<Record<string, unknown>>({
        scope: "lab",
        context: { source: "EmailLab.FunnemailTab", route: "/v2/email-lab", mode: "simulate" },
        body: {
          edgeFunction: "simulate-funnemail-classify",
          from: input.from,
          subject: input.subject,
          body: input.body,
          channel: input.channel ?? "email",
        },
      });
      if (!mountedRef.current) return;
      const v = res as unknown as SimulationVerdict & { ok?: boolean; error?: string };
      if (v?.error) throw new Error(v.error);
      setTraceId(v.traceId);
      setVerdict({
        traceId: v.traceId,
        classification: v.classification,
        proposedGroup: v.proposedGroup,
        proposedAction: v.proposedAction,
        knownPartner: v.knownPartner,
        domain: v.domain,
        injectionBlocked: v.injectionBlocked,
      });
      await fetchSteps(v.traceId);
      // Polling breve (i log arrivano in ordine sparso): 800ms x 6 tentativi
      let attempts = 0;
      pollRef.current = window.setInterval(() => {
        attempts++;
        if (attempts > 6 || !mountedRef.current) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          pollRef.current = null;
          return;
        }
        void fetchSteps(v.traceId);
      }, 800);
    } catch (e) {
      if (mountedRef.current) setError((e as Error).message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [fetchSteps, reset]);

  return { loading, error, traceId, steps, verdict, run, reset };
}