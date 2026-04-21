/**
 * useEmailForge — calls generate-email with _debug_return_prompt=true and exposes
 * { systemPrompt, userPrompt, blocks } for the Email Forge inspector page.
 */
import { useState, useCallback } from "react";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { isApiError } from "@/lib/api/apiError";
import { toast } from "sonner";
import type { OracleContextSummary } from "@/components/email/OracleContextPanel";

export type JournalistVerdict = "pass" | "pass_with_edits" | "warn" | "block";
export interface JournalistReviewSummary {
  journalist: { role: string; label: string; reasoning: string; auto: boolean };
  verdict: JournalistVerdict;
  warnings: Array<{ type: string; description: string; severity: "info" | "warning" | "blocking"; upstream_fix?: string }>;
  edits: Array<{ type: string; original_fragment: string; edited_fragment: string; reason: string }>;
  quality_score: number;
  reasoning: string;
}

export interface PromptBlock {
  label: string;
  content: string;
}

export interface ForgeDebug {
  systemPrompt: string;
  userPrompt: string;
  systemBlocks: PromptBlock[];
  blocks: PromptBlock[];
  model: string;
  quality: string;
  ai_latency_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  prompt_overridden?: boolean;
}

export interface ForgeResult {
  subject: string;
  body: string;
  full_content: string;
  partner_name: string | null;
  contact_email: string | null;
  model: string;
  quality: string;
  _context_summary?: OracleContextSummary;
  _debug?: ForgeDebug;
  journalist_review?: JournalistReviewSummary | null;
}

export interface ForgeRunParams {
  partner_id?: string | null;
  contact_id?: string | null;
  recipient_name?: string;
  recipient_company?: string;
  recipient_countries?: string;
  oracle_type?: string;
  oracle_tone?: string;
  use_kb?: boolean;
  goal?: string;
  base_proposal?: string;
  quality?: "fast" | "standard" | "premium";
  email_type_prompt?: string | null;
  email_type_structure?: string | null;
  email_type_kb_categories?: string[];
  /** Prompt-Lab: override completi che bypassano l'assembler */
  system_prompt_override?: string;
  user_prompt_override?: string;
}

export function useEmailForge() {
  const [result, setResult] = useState<ForgeResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  const run = useCallback(async (params: ForgeRunParams) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    const t0 = Date.now();
    try {
      const data = await invokeEdge<ForgeResult>("generate-email", {
        body: {
          standalone: true,
          partner_id: params.partner_id ?? null,
          contact_id: params.contact_id ?? null,
          recipient_name: params.recipient_name,
          recipient_company: params.recipient_company,
          recipient_countries: params.recipient_countries,
          oracle_type: params.oracle_type,
          oracle_tone: params.oracle_tone,
          use_kb: params.use_kb ?? true,
          goal: params.goal,
          base_proposal: params.base_proposal,
          quality: params.quality ?? "standard",
          email_type_prompt: params.email_type_prompt,
          email_type_structure: params.email_type_structure,
          email_type_kb_categories: params.email_type_kb_categories,
          _debug_return_prompt: true,
          _system_prompt_override: params.system_prompt_override,
          _user_prompt_override: params.user_prompt_override,
        },
        context: "useEmailForge.run",
      });
      setResult(data);
      setElapsedMs(Date.now() - t0);
      return data;
    } catch (err) {
      const message = isApiError(err)
        ? (err.details?.body as { message?: string; error?: string } | undefined)?.message
            ?? (err.details?.body as { error?: string } | undefined)?.error
            ?? err.message
        : err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error("Errore generazione", { description: message });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setElapsedMs(null);
  }, []);

  return { run, reset, result, isLoading, error, elapsedMs };
}
