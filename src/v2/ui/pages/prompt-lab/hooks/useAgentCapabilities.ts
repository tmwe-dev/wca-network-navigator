/**
 * useAgentCapabilities — load + edit capabilities for a single agent.
 *
 * Logic isolated from the UI tab (Prompt Lab pure-UI rule).
 */
import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getAgentCapabilities,
  updateAgentCapabilities,
  type AgentCapabilities,
} from "@/data/agentCapabilities";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";

export function useAgentCapabilities(agentId: string) {
  const qc = useQueryClient();
  const [capabilities, setCapabilities] = useState<AgentCapabilities | null>(null);
  const [draft, setDraft] = useState<AgentCapabilities | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!agentId) {
      setCapabilities(null);
      setDraft(null);
      return;
    }
    setLoading(true);
    getAgentCapabilities(agentId)
      .then((row) => {
        if (cancelled) return;
        setCapabilities(row);
        setDraft(row);
      })
      .catch((e) => {
        if (cancelled) return;
        toast.error(`Impossibile caricare capacità: ${(e as Error).message}`);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [agentId]);

  const dirty = Boolean(
    capabilities && draft && JSON.stringify(capabilities) !== JSON.stringify(draft),
  );

  const save = useCallback(async () => {
    if (!draft || !capabilities) return;
    setSaving(true);
    try {
      await updateAgentCapabilities(capabilities.id, {
        allowed_tools: draft.allowed_tools,
        blocked_tools: draft.blocked_tools,
        approval_required_tools: draft.approval_required_tools,
        max_concurrent_tools: draft.max_concurrent_tools,
        step_timeout_ms: draft.step_timeout_ms,
        max_iterations: draft.max_iterations,
        max_tokens_per_call: draft.max_tokens_per_call,
        temperature: draft.temperature,
        preferred_model: draft.preferred_model,
        execution_mode: draft.execution_mode,
        notes: draft.notes,
      });
      const fresh = await getAgentCapabilities(agentId);
      setCapabilities(fresh);
      setDraft(fresh);
      qc.invalidateQueries({ queryKey: queryKeys.agents.capabilities(agentId) });
      toast.success("Capacità aggiornate");
    } catch (e) {
      toast.error(`Salvataggio fallito: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }, [draft, capabilities, agentId, qc]);

  return { capabilities, draft, setDraft, loading, saving, dirty, save };
}