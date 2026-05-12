/**
 * useEmailLabIterations — laboratorio "produzione email serial agents".
 *
 * Mantiene in memoria locale una serie di iterazioni della stessa bozza:
 *  - v1: chiamata a `generate-email` (via useEmailForge.run)
 *  - v2..vN: chiamata a `improve-email` passando l'output dell'iterazione precedente
 *
 * Niente persistenza DB: è una vista laboratorio. Gli edge function chiamati
 * applicano il loro normale `journalistReview` — non lo bypassiamo.
 */
import { useCallback, useState } from "react";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { isApiError } from "@/lib/api/apiError";
import { toast } from "sonner";
import { useEmailForge, type ForgeResult, type ForgeRunParams } from "@/v2/hooks/useEmailForge";

export type IterationKind = "generate" | "improve";

export interface LabIteration {
  id: string;
  kind: IterationKind;
  label: string;          // es. "v1 · genera", "v2 · migliora"
  result: ForgeResult;
  elapsedMs: number;
  createdAt: number;
}

interface ImprovePayload {
  subject?: string;
  body?: string;
  _context_summary?: Record<string, unknown>;
}

function uuid() {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
}

function lastDraft(iterations: LabIteration[]): { subject: string; body: string } | null {
  if (iterations.length === 0) return null;
  const last = iterations[iterations.length - 1].result;
  return { subject: last.subject || "", body: last.body || "" };
}

export function useEmailLabIterations() {
  const forge = useEmailForge();
  const [iterations, setIterations] = useState<LabIteration[]>([]);
  const [improving, setImproving] = useState(false);
  const [lastParams, setLastParams] = useState<ForgeRunParams | null>(null);

  const reset = useCallback(() => {
    setIterations([]);
    setLastParams(null);
    forge.reset();
  }, [forge]);

  const generate = useCallback(async (params: ForgeRunParams) => {
    setLastParams(params);
    const t0 = Date.now();
    const data = await forge.run(params);
    if (!data) return null;
    const it: LabIteration = {
      id: uuid(),
      kind: "generate",
      label: `v${iterations.length + 1} · genera`,
      result: data,
      elapsedMs: Date.now() - t0,
      createdAt: Date.now(),
    };
    setIterations((prev) => [...prev, it]);
    return it;
  }, [forge, iterations.length]);

  const improve = useCallback(async (extraGoal?: string) => {
    const draft = lastDraft(iterations);
    if (!draft) {
      toast.error("Genera prima una bozza, poi puoi migliorarla.");
      return null;
    }
    if (!lastParams) {
      toast.error("Parametri di generazione mancanti — rilancia 'Genera bozza'.");
      return null;
    }
    setImproving(true);
    const t0 = Date.now();
    try {
      const goalParts = [
        "OBIETTIVO COMMERCIALE FISSO: promuovere i nostri servizi e la piattaforma WCA, acquisire clienti, e costruire relazioni durature di amicizia e supporto operativo.",
        lastParams.goal || "",
        extraGoal || "",
      ].filter(Boolean).join("\n\n");
      const data = await invokeEdge<ImprovePayload>("improve-email", {
        body: {
          subject: draft.subject,
          html_body: draft.body,
          recipient_count: 1,
          recipient_countries: lastParams.recipient_countries || "",
          oracle_tone: lastParams.oracle_tone,
          use_kb: lastParams.use_kb ?? true,
          email_type_id: lastParams.oracle_type || null,
          email_type_prompt: lastParams.email_type_prompt || null,
          email_type_structure: lastParams.email_type_structure || null,
          email_type_kb_categories: lastParams.email_type_kb_categories || null,
          custom_goal: goalParts,
          partner_id: lastParams.partner_id || null,
          contact_id: lastParams.contact_id || null,
        },
        context: "EmailLab.improve_iteration",
      });
      // improve-email non restituisce _debug — lo simuliamo lato lab.
      const result: ForgeResult = {
        subject: data?.subject || draft.subject,
        body: data?.body || draft.body,
        full_content: `${data?.subject || draft.subject}\n\n${data?.body || draft.body}`,
        partner_name: iterations[iterations.length - 1].result.partner_name,
        contact_email: iterations[iterations.length - 1].result.contact_email,
        model: "improve-email",
        quality: lastParams.quality ?? "standard",
        _context_summary: data?._context_summary as ForgeResult["_context_summary"],
        _debug: undefined,
        journalist_review: null,
        contract_used: false,
        contract_warnings: [],
        type_resolution: null,
      };
      const it: LabIteration = {
        id: uuid(),
        kind: "improve",
        label: `v${iterations.length + 1} · migliora`,
        result,
        elapsedMs: Date.now() - t0,
        createdAt: Date.now(),
      };
      setIterations((prev) => [...prev, it]);
      return it;
    } catch (err) {
      const message = isApiError(err)
        ? (err.details?.body as { message?: string; error?: string } | undefined)?.message
            ?? (err.details?.body as { error?: string } | undefined)?.error
            ?? err.message
        : err instanceof Error ? err.message : String(err);
      toast.error("Errore miglioramento", { description: message });
      return null;
    } finally {
      setImproving(false);
    }
  }, [iterations, lastParams]);

  return {
    iterations,
    isGenerating: forge.isLoading,
    isImproving: improving,
    canImprove: iterations.length > 0 && !!lastParams,
    generate,
    improve,
    reset,
  };
}