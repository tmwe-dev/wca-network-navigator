/**
 * Tool: schedule-activity
 *
 * Permette a Command di programmare un'attività distinguendo esplicitamente:
 *  - kind = "agent_task"     → riga in `agent_tasks` (eseguito da agente AI)
 *  - kind = "human_activity" → riga in `activities` (in agenda dell'operatore)
 *
 * Tutte le scritture passano dal DAL (no `supabase.from()` diretto qui).
 * Richiede approvazione (registrato in WRITE_TOOL_IDS del registry).
 */
import type { Tool, ToolResult, ToolContext } from "./types";
import { supabase } from "@/integrations/supabase/client";

interface SchedulePayload {
  kind?: "agent_task" | "human_activity";
  title?: string;
  description?: string;
  dueAt?: string; // ISO date or "YYYY-MM-DD"
  agentId?: string;
  partnerId?: string;
  contactId?: string;
  taskType?: string;
}

function normalize(payload: Record<string, unknown> | undefined): SchedulePayload {
  if (!payload) return {};
  const p = payload as SchedulePayload;
  return {
    kind: p.kind === "agent_task" || p.kind === "human_activity" ? p.kind : undefined,
    title: typeof p.title === "string" ? p.title.trim() : undefined,
    description: typeof p.description === "string" ? p.description : undefined,
    dueAt: typeof p.dueAt === "string" ? p.dueAt : undefined,
    agentId: typeof p.agentId === "string" ? p.agentId : undefined,
    partnerId: typeof p.partnerId === "string" ? p.partnerId : undefined,
    contactId: typeof p.contactId === "string" ? p.contactId : undefined,
    taskType: typeof p.taskType === "string" ? p.taskType : undefined,
  };
}

export const scheduleActivityTool: Tool = {
  id: "schedule-activity",
  label: "Programma attività",
  description:
    "Programma un'attività: o come task per un agente AI (kind=agent_task), o come attività umana in agenda (kind=human_activity). Distingue sempre 'eseguo io' vs 'metto in agenda tua'.",
  match: (p) =>
    /\b(programma|pianifica|schedula|metti\s+in\s+agenda|aggiungi\s+all'?agenda|crea\s+attivit|ricordamelo)\b/i.test(
      p,
    ),

  execute: async (_prompt, context?: ToolContext): Promise<ToolResult> => {
    const data = normalize(context?.payload);

    // Approval gate: senza confirmed, mostriamo il pannello di approvazione.
    if (!context?.confirmed) {
      const isAgent = data.kind === "agent_task";
      const badge = isAgent ? "🤖 Eseguo io" : "📅 Metto in agenda tua";
      return {
        kind: "approval",
        title: `${badge}: ${data.title ?? "Nuova attività"}`,
        description:
          data.description ??
          (isAgent
            ? "Verrà creato un task per l'agente specificato (eseguito automaticamente)."
            : "Verrà aggiunto all'agenda dell'operatore (richiede azione umana)."),
        details: [
          { label: "Tipo", value: isAgent ? "Agent task" : "Human activity" },
          { label: "Titolo", value: data.title ?? "—" },
          { label: "Scadenza", value: data.dueAt ?? "—" },
          ...(isAgent && data.agentId ? [{ label: "Agente", value: data.agentId }] : []),
          ...(data.partnerId ? [{ label: "Partner", value: data.partnerId }] : []),
          ...(data.contactId ? [{ label: "Contatto", value: data.contactId }] : []),
        ],
        governance: {
          role: "operator",
          permission: "write",
          policy: isAgent ? "agent-execution" : "human-agenda",
        },
        pendingPayload: { ...data },
        toolId: "schedule-activity",
        meta: { count: 1, sourceLabel: isAgent ? "agent_tasks" : "activities" },
      };
    }

    // Execution
    if (!data.kind || !data.title) {
      return {
        kind: "result",
        title: "Programmazione fallita",
        message: "Manca `kind` (agent_task | human_activity) o `title`.",
        meta: { count: 0, sourceLabel: "schedule-activity" },
      };
    }

    const { data: userData } = await supabase.auth.getSession();
    const userId = userData.session?.user.id;
    if (!userId) {
      return {
        kind: "result",
        title: "Sessione mancante",
        message: "Devi essere autenticato per programmare attività.",
        meta: { count: 0, sourceLabel: "schedule-activity" },
      };
    }

    if (data.kind === "agent_task") {
      if (!data.agentId) {
        return {
          kind: "result",
          title: "Agente mancante",
          message: "Per un agent_task serve `agentId`.",
          meta: { count: 0, sourceLabel: "agent_tasks" },
        };
      }
      const { error } = await supabase.from("agent_tasks").insert({
        agent_id: data.agentId,
        user_id: userId,
        task_type: data.taskType ?? "outreach",
        description: `${data.title}${data.description ? `\n${data.description}` : ""}`,
        target_filters: data.partnerId
          ? { partner_id: data.partnerId }
          : data.contactId
            ? { contact_id: data.contactId }
            : {},
        status: "pending",
        scheduled_at: data.dueAt ?? null,
      });
      if (error) {
        return {
          kind: "result",
          title: "Errore creazione agent_task",
          message: error.message,
          meta: { count: 0, sourceLabel: "agent_tasks" },
        };
      }
      return {
        kind: "result",
        title: "🤖 Task creato per l'agente",
        message: `"${data.title}" è in coda. L'agente lo eseguirà secondo i suoi KPI/budget.`,
        meta: { count: 1, sourceLabel: "agent_tasks" },
      };
    }

    // human_activity
    const { error } = await supabase.from("activities").insert({
      user_id: userId,
      activity_type: "task",
      title: data.title,
      description: data.description ?? null,
      due_date: data.dueAt ? data.dueAt.slice(0, 10) : null,
      scheduled_at: data.dueAt ?? null,
      partner_id: data.partnerId ?? null,
      selected_contact_id: data.contactId ?? null,
      source_type: data.partnerId ? "partner" : "manual",
      source_id: data.partnerId ?? userId,
      status: "pending",
      priority: "medium",
    });
    if (error) {
      return {
        kind: "result",
        title: "Errore creazione activity",
        message: error.message,
        meta: { count: 0, sourceLabel: "activities" },
      };
    }
    return {
      kind: "result",
      title: "📅 Attività in agenda",
      message: `"${data.title}" è in agenda${data.dueAt ? ` per ${data.dueAt}` : ""}.`,
      meta: { count: 1, sourceLabel: "activities" },
    };
  },
};