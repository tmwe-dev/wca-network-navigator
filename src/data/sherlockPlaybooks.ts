/**
 * DAL — Sherlock playbooks & investigations.
 * Tutte le query passano da qui (regola DAL: src/data/README.md).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type {
  SherlockPlaybook,
  SherlockInvestigation,
  SherlockStep,
  SherlockStepResult,
  SherlockLevel,
} from "@/v2/services/sherlock/sherlockTypes";

import { toRecordOrNull, toRecord } from "@/lib/records";
import { asJsonArray } from "@/lib/typedJson";
import { createLogger } from "@/lib/log";
const log = createLogger("sherlockPlaybooks");
export const sherlockKeys = {
  playbooks: ["sherlock", "playbooks"] as const,
  playbook: (id: string) => ["sherlock", "playbook", id] as const,
  investigations: ["sherlock", "investigations"] as const,
  investigation: (id: string) => ["sherlock", "investigation", id] as const,
};

type PlaybookRow = Database["public"]["Tables"]["sherlock_playbooks"]["Row"];
type InvestigationRow = Database["public"]["Tables"]["sherlock_investigations"]["Row"];

/** Validatore runtime degli step playbook (colonna Json). Righe non conformi scartate. */
export function parseSherlockSteps(value: unknown): SherlockStep[] {
  const out: SherlockStep[] = [];
  for (const item of asJsonArray<unknown>(value)) {
    const r = toRecordOrNull(item);
    if (!r) continue;
    if (typeof r.order !== "number" || typeof r.label !== "string") continue;
    if (typeof r.url_template !== "string") continue;
    out.push({
      order: r.order,
      label: r.label,
      url_template: r.url_template,
      required_vars: Array.isArray(r.required_vars)
        ? r.required_vars.filter((v): v is string => typeof v === "string")
        : [],
      settle_ms: typeof r.settle_ms === "number" ? r.settle_ms : undefined,
      channel: typeof r.channel === "string" ? (r.channel as SherlockStep["channel"]) : undefined,
      ai_extract_prompt: typeof r.ai_extract_prompt === "string" ? r.ai_extract_prompt : "",
      ai_decide_next: typeof r.ai_decide_next === "boolean" ? r.ai_decide_next : undefined,
      depends_on: Array.isArray(r.depends_on)
        ? r.depends_on.filter((v): v is number => typeof v === "number")
        : undefined,
    });
  }
  return out;
}

/** Validatore runtime del log step investigazione (colonna Json). */
export function parseSherlockStepResults(value: unknown): SherlockStepResult[] {
  const out: SherlockStepResult[] = [];
  for (const item of asJsonArray<unknown>(value)) {
    const r = toRecordOrNull(item);
    if (!r) continue;
    if (typeof r.order !== "number" || typeof r.label !== "string") continue;
    out.push({
      order: r.order,
      label: r.label,
      url: typeof r.url === "string" ? r.url : null,
      channel: (typeof r.channel === "string" ? r.channel : "web") as SherlockStepResult["channel"],
      status: (typeof r.status === "string" ? r.status : "pending") as SherlockStepResult["status"],
      markdown: typeof r.markdown === "string" ? r.markdown : "",
      findings: toRecord(r.findings),
      confidence: typeof r.confidence === "number" ? r.confidence : null,
      suggested_next_url: typeof r.suggested_next_url === "string" ? r.suggested_next_url : null,
      error: typeof r.error === "string" ? r.error : undefined,
      started_at: typeof r.started_at === "number" ? r.started_at : 0,
      duration_ms: typeof r.duration_ms === "number" ? r.duration_ms : undefined,
      ai_duration_ms: typeof r.ai_duration_ms === "number" ? r.ai_duration_ms : undefined,
      cache_hit: typeof r.cache_hit === "boolean" ? r.cache_hit : undefined,
    });
  }
  return out;
}

function mapPlaybookRow(row: PlaybookRow): SherlockPlaybook {
  return {
    id: row.id,
    level: row.level as SherlockLevel,
    name: row.name,
    description: row.description,
    is_active: row.is_active,
    sort_order: row.sort_order,
    steps: parseSherlockSteps(row.steps),
    target_fields: row.target_fields,
    estimated_seconds: row.estimated_seconds,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapInvestigationRow(row: InvestigationRow): SherlockInvestigation {
  return {
    id: row.id,
    user_id: row.user_id,
    operator_id: row.operator_id,
    playbook_id: row.playbook_id,
    level: row.level as SherlockLevel,
    partner_id: row.partner_id,
    contact_id: row.contact_id,
    target_label: row.target_label,
    status: row.status as SherlockInvestigation["status"],
    vars: (row.vars ?? {}) as Record<string, string>,
    findings: (row.findings ?? {}) as Record<string, unknown>,
    step_log: parseSherlockStepResults(row.step_log),
    summary: row.summary,
    duration_ms: row.duration_ms,
    started_at: row.started_at,
    completed_at: row.completed_at,
  };
}

// ───────────────────────── Playbooks ─────────────────────────

export async function listPlaybooks(): Promise<SherlockPlaybook[]> {
  const { data, error } = await supabase
    .from("sherlock_playbooks")
    .select("*")
    .eq("is_active", true)
    .order("level", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapPlaybookRow);
}

export async function getPlaybookByLevel(level: SherlockLevel): Promise<SherlockPlaybook | null> {
  const { data, error } = await supabase
    .from("sherlock_playbooks")
    .select("*")
    .eq("level", level)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapPlaybookRow(data) : null;
}

// ─────────────────────── Investigations ──────────────────────

interface CreateInvestigationInput {
  user_id: string;
  operator_id?: string | null;
  playbook_id: string | null;
  level: SherlockLevel;
  partner_id?: string | null;
  contact_id?: string | null;
  target_label?: string | null;
  vars: Record<string, string>;
}

export async function createInvestigation(input: CreateInvestigationInput): Promise<SherlockInvestigation> {
  const { data, error } = await supabase
    .from("sherlock_investigations")
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
  return mapInvestigationRow(data);
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
  const { error } = await supabase
    .from("sherlock_investigations")
    .update(patch as Database["public"]["Tables"]["sherlock_investigations"]["Update"])
    .eq("id", id);
  if (error) throw error;
}

/**
 * Persiste un sito web scoperto durante una indagine sul record partner,
 * solo se il campo è ancora vuoto (non sovrascrive dati inseriti dall'utente).
 */
export async function updatePartnerWebsiteIfMissing(partnerId: string, website: string): Promise<boolean> {
  if (!partnerId || !website) return false;
  try {
    const { data: current } = await supabase.from("partners").select("website").eq("id", partnerId).maybeSingle();
    const existing = current?.website;
    if (existing && existing.trim().length > 0) return false;
    const { error } = await supabase.from("partners").update({ website }).eq("id", partnerId);
    if (error) throw error;
    return true;
  } catch (e) {
    log.warn("[sherlock] updatePartnerWebsiteIfMissing failed", { error: e });
    return false;
  }
}

/**
 * Persiste l'URL LinkedIn aziendale scoperto durante una indagine,
 * solo se il campo è ancora vuoto.
 */
export async function updatePartnerLinkedinIfMissing(partnerId: string, linkedinUrl: string): Promise<boolean> {
  if (!partnerId || !linkedinUrl) return false;
  try {
    const { data: current } = await supabase.from("partners").select("linkedin_url").eq("id", partnerId).maybeSingle();
    const existing = current?.linkedin_url;
    if (existing && existing.trim().length > 0) return false;
    const { error } = await supabase.from("partners").update({ linkedin_url: linkedinUrl }).eq("id", partnerId);
    if (error) throw error;
    return true;
  } catch (e) {
    log.warn("[sherlock] updatePartnerLinkedinIfMissing failed", { error: e });
    return false;
  }
}
