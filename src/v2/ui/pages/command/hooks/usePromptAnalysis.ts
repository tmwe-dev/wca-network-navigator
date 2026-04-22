/**
 * usePromptAnalysis — Analyze user prompts to determine execution strategy
 */
import { useCallback } from "react";
import { aiQueryTool } from "../tools/aiQueryTool";

/** Heuristic: does this prompt look like a simple read query that ai-query handles? */
function looksLikeSimpleQuery(prompt: string): boolean {
  const lower = prompt.toLowerCase().trim();
  if (!lower) return false;
  // Action verbs → not simple read
  const actionPatterns = [
    /\bcrea\b/, /\baggiungi\b/, /\baggiorna\b/, /\bmodifica\b/, /\belimina\b/,
    /\bscrap/, /\benrich/, /\barricch/, /\bdedup/, /\bcalcola lead/, /\binvia\b/,
    /\bcomponi\b/, /\bnaviga\b/, /\bcompila form/, /\bprogramma\b/, /\bschedul/,
    /\bapprov/,
  ];
  if (actionPatterns.some((re) => re.test(lower))) return false;
  // Multi-step indicators → use planner
  if (/\b(poi|quindi|dopo|infine|e poi|successivamente)\b/.test(lower)) return false;

  // Aggressive read-verb + domain-noun detector
  const readVerb = /\b(quant|mostr|elenc|trov|lista|cerca|visualiz|dammi|fammi vedere|recenti|ultim)/i;
  const domainNoun = /\b(partner|contatt|attivit|email|messagg|agente|biglietti|campagn|prospect|outreach|job|kb)\b/i;
  if (readVerb.test(lower) && domainNoun.test(lower)) return true;

  return aiQueryTool.match(lower);
}

export function usePromptAnalysis() {
  const analyzePrompt = useCallback(
    (prompt: string): { isSimpleQuery: boolean } => {
      return {
        isSimpleQuery: looksLikeSimpleQuery(prompt),
      };
    },
    []
  );

  return { analyzePrompt, looksLikeSimpleQuery };
}
