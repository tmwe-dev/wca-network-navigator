/**
 * DAL — Sherlock playbooks & investigations.
 * Tutte le query passano da qui (regola DAL: src/data/README.md).
 */
import { untypedFrom } from "@/lib/supabaseUntyped";
import type {
  SherlockPlaybook,
  SherlockInvestigation,
  SherlockStepResult,
  SherlockLevel,
} from "@/v2/services/sherlock/sherlockTypes";

export const sherlockKeys = {
  playbooks: ["sherlock", "playbooks"] as const,
  playbook: (id: string) => ["sherlock", "playbook", id] as const,
  investigations: ["sherlock", "investigations"] as const,
  investigation: (id: string) => ["sherlock", "investigation", id] as const,
};

// ───────────────────────── Playbooks ─────────────────────────

export async function listPlaybooks(): Promise<SherlockPlaybook[]> {
  const { data, error } = await untypedFrom("sherlock_playbooks")
    .select("*")
    .eq("is_active", true)
    .order("level", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SherlockPlaybook[];
}

export async function listAllPlaybooks(): Promise<SherlockPlaybook[]> {
  const { data, error } = await untypedFrom("sherlock_playbooks")
    .select("*")
    .order("level", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SherlockPlaybook[];
}

export async function getPlaybookByLevel(level: SherlockLevel): Promise<SherlockPlaybook | null> {
  const { data, error } = await untypedFrom("sherlock_playbooks")
    .select("*")
    .eq("level", level)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as SherlockPlaybook | null) ?? null;
}

export async function updatePlaybook(
  id: string,
  patch: Partial<Pick<SherlockPlaybook, "name" | "description" | "steps" | "target_fields" | "is_active" | "estimated_seconds" | "sort_order">>,
): Promise<void> {
  const { error } = await untypedFrom("sherlock_playbooks")
    .update(patch as Record<string, unknown>)
    .eq("id", id);
  if (error) throw error;
}

// ─────────────────────── Investigations ──────────────────────

export interface CreateInvestigationInput {
  user_id: string;
  operator_id?: string | null;
  playbook_id: string | null;
  level: SherlockLevel;
  partner_id?: string | null;
  contact_id?: string | null;
  target_label?: string | null;
  vars: Record<string, string>;
}

export async function createInvestigation(
  input: CreateInvestigationInput,
): Promise<SherlockInvestigation> {
  const { data, error } = await untypedFrom("sherlock_investigations")
    .insert({
      user_id: input.user_id,
      operator_id: input.operator_id ?? null,
      playbook_id: input.playbook_id,
      level: input.level,
      partner_id: input.partner_id ?? null,
      contact_id: input.contact_id ?? null,
      target_label: input.target_label ?? null,
      vars: input.vars,
      status: "running",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as SherlockInvestigation;
}

export async function updateInvestigation(
  id: string,
  patch: {
    status?: "running" | "completed" | "aborted" | "failed";
    findings?: Record<string, unknown>;
    step_log?: SherlockStepResult[];
    summary?: string | null;
    duration_ms?: number;
    completed_at?: string;
  },
): Promise<void> {
  const { error } = await untypedFrom("sherlock_investigations")
    .update(patch as Record<string, unknown>)
    .eq("id", id);
  if (error) throw error;
}

export async function listInvestigationsForTarget(
  partnerId: string | null,
  contactId: string | null,
  limit = 20,
): Promise<SherlockInvestigation[]> {
  let q = untypedFrom("sherlock_investigations")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (partnerId) q = q.eq("partner_id", partnerId);
  if (contactId) q = q.eq("contact_id", contactId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SherlockInvestigation[];
}

/**
 * Persiste un sito web scoperto durante una indagine sul record partner,
 * solo se il campo è ancora vuoto (non sovrascrive dati inseriti dall'utente).
 */
export async function updatePartnerWebsiteIfMissing(
  partnerId: string,
  website: string,
): Promise<boolean> {
  if (!partnerId || !website) return false;
  try {
    const { data: current } = await untypedFrom("partners")
      .select("website")
      .eq("id", partnerId)
      .maybeSingle();
    const existing = (current as { website?: string | null } | null)?.website;
    if (existing && existing.trim().length > 0) return false;
    const { error } = await untypedFrom("partners")
      .update({ website } as Record<string, unknown>)
      .eq("id", partnerId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("[sherlock] updatePartnerWebsiteIfMissing failed", e);
    return false;
  }
}

/**
 * Persiste l'URL LinkedIn aziendale scoperto durante una indagine,
 * solo se il campo è ancora vuoto.
 */
export async function updatePartnerLinkedinIfMissing(
  partnerId: string,
  linkedinUrl: string,
): Promise<boolean> {
  if (!partnerId || !linkedinUrl) return false;
  try {
    const { data: current } = await untypedFrom("partners")
      .select("linkedin_url")
      .eq("id", partnerId)
      .maybeSingle();
    const existing = (current as { linkedin_url?: string | null } | null)?.linkedin_url;
    if (existing && existing.trim().length > 0) return false;
    const { error } = await untypedFrom("partners")
      .update({ linkedin_url: linkedinUrl } as Record<string, unknown>)
      .eq("id", partnerId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("[sherlock] updatePartnerLinkedinIfMissing failed", e);
    return false;
  }
}
