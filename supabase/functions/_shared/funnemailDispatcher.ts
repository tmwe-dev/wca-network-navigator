/**
 * Funnemail Dispatcher — modulo condiviso (NON edge function).
 *
 * Responsabilità: dato un'email inbound già classificata da
 * `classify-inbound-message`, applica la POLICY del gruppo del mittente
 * (`email_sender_groups.funnemail_policy`) delegando ai flussi esistenti.
 *
 * VINCOLI INVALICABILI:
 *  - SOLO email (no WhatsApp, no LinkedIn).
 *  - MAI invio diretto: bozze in `email_drafts` via flusso esistente.
 *  - MAI bypass `journalistReview` (è dentro generate-email).
 *  - MAI tocca `check-inbox`, `email-imap-proxy`, `process-email-queue`.
 *  - Idempotenza per (message_id, action) tramite `funnemail_actions_log`
 *    con UNIQUE INDEX: l'INSERT con onConflict="do nothing" garantisce
 *    che la stessa azione non venga eseguita due volte.
 *  - Non rompe MAI il caller: try/catch totale, log e prosegui.
 *
 * Persona: agent "Funnemail" in `agents` (id usato come metadato bozze).
 */

// deno-lint-ignore no-explicit-any
type AnySupabase = any;

export interface FunnemailDispatchInput {
  supabase: AnySupabase;
  messageId: string;
  userId: string | null;
  channel: string;
  fromAddress: string;
  subject: string;
  bodyText: string;
  partnerId: string | null;
  classification: string;
  confidence: number;
  intent?: string;
  sentiment?: string;
  urgency?: string;
}

export interface FunnemailPolicy {
  enabled?: boolean;
  actions?: string[];
  min_confidence?: number;
  deep_search?: { trigger?: string; stale_days?: number; level?: string };
  draft_reply?: { tone?: string; agent_id?: string | null };
  crm_update?: { set_lead_status?: string | null; create_task?: boolean };
  imap_action?: { type?: string; params?: Record<string, unknown> };
}

const VALID_ACTIONS = new Set([
  "tag_only",
  "deep_search",
  "draft_reply",
  "crm_update",
  "imap_action",
]);

function lc(s: string | null | undefined): string {
  return (s || "").trim().toLowerCase();
}

function domainOf(addr: string): string {
  const a = lc(addr);
  const i = a.lastIndexOf("@");
  return i >= 0 ? a.slice(i + 1) : "";
}

/**
 * Logga un'azione in modo idempotente. Se `(message_id, action)` esiste già,
 * l'INSERT viene scartato dal vincolo UNIQUE → ritorna `false` (skip).
 */
async function tryClaimAction(
  supabase: AnySupabase,
  row: {
    message_id: string;
    user_id: string | null;
    group_id: string | null;
    from_address: string;
    partner_id: string | null;
    action: string;
    status: string;
    payload: Record<string, unknown>;
    error?: string | null;
  },
): Promise<boolean> {
  const { error } = await supabase
    .from("funnemail_actions_log")
    .insert(row);
  if (error) {
    // Codice 23505 = unique violation → già eseguita: non è un errore.
    if ((error as { code?: string }).code === "23505") return false;
    console.warn("[funnemail] log insert failed:", error.message ?? String(error));
    return false;
  }
  return true;
}

async function loadGroupPolicyForSender(
  supabase: AnySupabase,
  fromAddress: string,
): Promise<{ groupId: string | null; policy: FunnemailPolicy | null; enabled: boolean }>
{
  const addr = lc(fromAddress);
  const dom = domainOf(addr);
  if (!addr) return { groupId: null, policy: null, enabled: false };

  // 1) Match esatto sull'indirizzo
  const { data: byAddr } = await supabase
    .from("email_address_rules")
    .select("group_id")
    .or(`email_address.eq.${addr},address.eq.${addr}`)
    .not("group_id", "is", null)
    .limit(1)
    .maybeSingle();

  let groupId: string | null = byAddr?.group_id ?? null;

  // 2) Match sul dominio se nessun match esatto
  if (!groupId && dom) {
    const { data: byDom } = await supabase
      .from("email_address_rules")
      .select("group_id")
      .or(`domain.eq.${dom},domain_pattern.eq.${dom}`)
      .not("group_id", "is", null)
      .limit(1)
      .maybeSingle();
    groupId = byDom?.group_id ?? null;
  }

  if (!groupId) return { groupId: null, policy: null, enabled: false };

  const { data: grp } = await supabase
    .from("email_sender_groups")
    .select("id, funnemail_enabled, funnemail_policy")
    .eq("id", groupId)
    .maybeSingle();

  const policy = (grp?.funnemail_policy ?? {}) as FunnemailPolicy;
  return {
    groupId,
    policy,
    enabled: Boolean(grp?.funnemail_enabled) && policy?.enabled !== false,
  };
}

async function shouldRunDeepSearch(
  supabase: AnySupabase,
  partnerId: string | null,
  policy: FunnemailPolicy,
): Promise<{ run: boolean; reason: string }>
{
  const cfg = policy.deep_search ?? {};
  const trigger = cfg.trigger ?? "if_unknown_or_stale";
  if (trigger === "always") return { run: true, reason: "always" };
  if (trigger === "never") return { run: false, reason: "never" };

  // if_unknown_or_stale: nessun partner OR enrichment_data più vecchio di N giorni
  if (!partnerId) return { run: true, reason: "no_partner" };
  const staleDays = Number(cfg.stale_days ?? 30);
  const { data: p } = await supabase
    .from("partners")
    .select("enrichment_data, last_enriched_at, updated_at")
    .eq("id", partnerId)
    .maybeSingle();
  const last = p?.last_enriched_at ?? p?.updated_at ?? null;
  if (!last) return { run: true, reason: "never_enriched" };
  const ageMs = Date.now() - new Date(last).getTime();
  if (ageMs > staleDays * 86400_000) return { run: true, reason: "stale" };
  return { run: false, reason: "fresh" };
}

async function invokeEdgeIfPresent(
  supabase: AnySupabase,
  fnName: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; data?: unknown; error?: string }>
{
  try {
    const { data, error } = await supabase.functions.invoke(fnName, { body });
    if (error) return { ok: false, error: error.message ?? String(error) };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Entry point: applica policy del gruppo del mittente all'email inbound.
 * NON throwa mai. Restituisce un riassunto.
 */
export async function dispatchFunnemail(
  input: FunnemailDispatchInput,
): Promise<{
  ran: boolean;
  reason: string;
  groupId: string | null;
  actions: Array<{ name: string; status: string; reason?: string }>;
}> {
  const actions: Array<{ name: string; status: string; reason?: string }> = [];

  // 1) Solo email
  if (input.channel !== "email") {
    return { ran: false, reason: "channel_not_email", groupId: null, actions };
  }

  try {
    const { groupId, policy, enabled } = await loadGroupPolicyForSender(
      input.supabase,
      input.fromAddress,
    );

    if (!groupId || !policy || !enabled) {
      return {
        ran: false,
        reason: !groupId ? "no_group_match" : "policy_disabled",
        groupId,
        actions,
      };
    }

    const minConf = Number(policy.min_confidence ?? 0);
    const requested = Array.isArray(policy.actions) ? policy.actions : [];
    const enabledActions = requested.filter((a) => VALID_ACTIONS.has(a));

    // tag_only è sempre concesso anche sotto soglia
    const aboveThreshold = (input.confidence ?? 0) >= minConf;

    const baseLog = {
      message_id: input.messageId,
      user_id: input.userId,
      group_id: groupId,
      from_address: input.fromAddress,
      partner_id: input.partnerId,
    };

    // ── tag_only ──
    if (enabledActions.includes("tag_only")) {
      const claimed = await tryClaimAction(input.supabase, {
        ...baseLog,
        action: "tag_only",
        status: "ok",
        payload: {
          classification: input.classification,
          confidence: input.confidence,
          intent: input.intent,
        },
      });
      actions.push({ name: "tag_only", status: claimed ? "ok" : "skip_dup" });
    }

    if (!aboveThreshold) {
      return {
        ran: true,
        reason: "below_min_confidence",
        groupId,
        actions,
      };
    }

    // ── imap_action (delega ad apply-email-rules) ──
    if (enabledActions.includes("imap_action")) {
      const claimed = await tryClaimAction(input.supabase, {
        ...baseLog,
        action: "imap_action",
        status: "queued",
        payload: {
          imap_action: policy.imap_action ?? null,
          note: "delegated to apply-email-rules pipeline",
        },
      });
      // L'effettiva esecuzione IMAP avviene già via apply-email-rules sui
      // gruppi con auto_action ≠ 'none'. Qui logghiamo l'intento per audit.
      if (claimed) actions.push({ name: "imap_action", status: "queued" });
      else actions.push({ name: "imap_action", status: "skip_dup" });
    }

    // ── deep_search ──
    if (enabledActions.includes("deep_search")) {
      const verdict = await shouldRunDeepSearch(
        input.supabase,
        input.partnerId,
        policy,
      );
      if (verdict.run) {
        const claimed = await tryClaimAction(input.supabase, {
          ...baseLog,
          action: "deep_search",
          status: "queued",
          payload: {
            level: policy.deep_search?.level ?? "scout",
            reason: verdict.reason,
          },
        });
        if (claimed) {
          // Fire-and-forget: non blocca il dispatcher
          invokeEdgeIfPresent(input.supabase, "sherlock-extract", {
            level: policy.deep_search?.level ?? "scout",
            partner_id: input.partnerId,
            email: input.fromAddress,
            domain: domainOf(input.fromAddress),
            origin: "funnemail",
          }).catch(() => {});
          actions.push({ name: "deep_search", status: "queued", reason: verdict.reason });
        } else {
          actions.push({ name: "deep_search", status: "skip_dup" });
        }
      } else {
        actions.push({ name: "deep_search", status: "skipped", reason: verdict.reason });
      }
    }

    // ── draft_reply (solo se c'è partner; usa generate-email che include journalistReview) ──
    if (enabledActions.includes("draft_reply") && input.partnerId) {
      const claimed = await tryClaimAction(input.supabase, {
        ...baseLog,
        action: "draft_reply",
        status: "queued",
        payload: {
          tone: policy.draft_reply?.tone ?? "neutral_b2b",
          agent_id: policy.draft_reply?.agent_id ?? null,
          replying_to_message_id: input.messageId,
          subject: input.subject,
        },
      });
      if (claimed) {
        // Non chiamiamo generate-email direttamente da qui: l'orchestratore
        // outreach esistente raccoglie le bozze suggerite. Logghiamo l'intento
        // così l'UI Funnemail può proporlo e l'operatore approva.
        actions.push({ name: "draft_reply", status: "queued" });
      } else {
        actions.push({ name: "draft_reply", status: "skip_dup" });
      }
    } else if (enabledActions.includes("draft_reply") && !input.partnerId) {
      actions.push({ name: "draft_reply", status: "skipped", reason: "no_partner" });
    }

    // ── crm_update (solo log audit; l'aggiornamento lead_status passa già da
    //               LeadProcessManager invocato dal caller) ──
    if (enabledActions.includes("crm_update")) {
      const claimed = await tryClaimAction(input.supabase, {
        ...baseLog,
        action: "crm_update",
        status: "ok",
        payload: {
          set_lead_status: policy.crm_update?.set_lead_status ?? null,
          create_task: Boolean(policy.crm_update?.create_task),
          note: "delegated to LeadProcessManager event flow",
        },
      });
      actions.push({ name: "crm_update", status: claimed ? "ok" : "skip_dup" });
    }

    return {
      ran: true,
      reason: "policy_applied",
      groupId,
      actions,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[funnemail] dispatcher error (non-fatal):", msg);
    return {
      ran: false,
      reason: `error:${msg.slice(0, 120)}`,
      groupId: null,
      actions,
    };
  }
}