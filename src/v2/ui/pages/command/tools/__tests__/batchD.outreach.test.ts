/**
 * Batch D — test di esecuzione reale per i tool outreach/campagne/missioni/attività/canali.
 * Mocka solo il confine I/O (invokeEdge, supabase client, DAL @/data/*, mutations v2/io).
 * Nessuna rete reale. Nessun invio reale email/WhatsApp/LinkedIn (invokeEdge è mockato).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ToolContext } from "../types";

// ---- Mocks dei confini I/O ----
vi.mock("@/lib/api/invokeEdge", () => ({
  invokeEdge: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-1" } } } }),
    },
    from: vi.fn(),
  },
}));

vi.mock("@/v2/io/supabase/mutations/outreach-queue", () => ({
  enqueueOutreach: vi.fn(),
}));
vi.mock("@/v2/io/supabase/mutations/campaigns", () => ({
  createCampaignJob: vi.fn(),
}));
vi.mock("@/data/outreachQueue", () => ({
  updateOutreachItem: vi.fn(),
}));
vi.mock("@/data/agentMissions", () => ({
  findAgentMissionByTitleLike: vi.fn(),
  findAgentMissionTitleById: vi.fn(),
  updateAgentMissionFields: vi.fn(),
}));
vi.mock("@/data/agentTasks", () => ({
  insertAgentTask: vi.fn(),
}));
vi.mock("@/data/activities", () => ({
  insertHumanActivity: vi.fn(),
  findActivityRef: vi.fn(),
  patchActivity: vi.fn(),
}));
vi.mock("@/data/channelMessages", () => ({
  patchChannelMessage: vi.fn(),
}));
vi.mock("@/data/aiPendingActions", () => ({
  insertPendingActionReturningId: vi.fn(),
}));

import { invokeEdge } from "@/lib/api/invokeEdge";
import { supabase } from "@/integrations/supabase/client";
import { enqueueOutreach } from "@/v2/io/supabase/mutations/outreach-queue";
import { createCampaignJob } from "@/v2/io/supabase/mutations/campaigns";
import { updateOutreachItem } from "@/data/outreachQueue";
import {
  findAgentMissionByTitleLike,
  findAgentMissionTitleById,
  updateAgentMissionFields,
} from "@/data/agentMissions";
import { insertAgentTask } from "@/data/agentTasks";
import { insertHumanActivity, findActivityRef, patchActivity } from "@/data/activities";
import { patchChannelMessage } from "@/data/channelMessages";
import { insertPendingActionReturningId } from "@/data/aiPendingActions";

import { enqueueOutreachTool } from "../enqueueOutreach";
import { cancelOutreachItemTool } from "../cancelOutreach";
import { createCampaignTool } from "../createCampaign";
import { launchMissionTool } from "../launchMission";
import { missionControlTool } from "../missionControl";
import { scheduleActivityTool } from "../scheduleActivity";
import { closeActivityTool } from "../closeActivity";
import { rescheduleActivityTool } from "../rescheduleActivity";
import { pendingActionExecutorTool } from "../pendingActionExecutor";
import { sendWhatsappTool } from "../sendWhatsapp";
import { sendLinkedinTool } from "../sendLinkedin";
import { sendEmailDirectTool } from "../sendEmailDirect";
import { markMessageTool } from "../markMessage";
import { applyEmailRulesTool } from "../applyEmailRules";
import { manageEmailFoldersTool } from "../manageEmailFolders";

const UUID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
});

// ============= enqueue-outreach =============
describe("enqueueOutreachTool", () => {
  it("match positivi/negativi", () => {
    expect(enqueueOutreachTool.match("programma outreach per i partner")).toBe(true);
    expect(enqueueOutreachTool.match("invia outreach ai lead")).toBe(true);
    expect(enqueueOutreachTool.match("che tempo fa oggi")).toBe(false);
  });

  it("senza confirmed ritorna approval (mai invio diretto)", async () => {
    const res = await enqueueOutreachTool.execute("programma outreach", {});
    expect(res.kind).toBe("approval");
    expect(enqueueOutreach).not.toHaveBeenCalled();
  });

  it("con confirmed e items validi esegue enqueue", async () => {
    (enqueueOutreach as any).mockResolvedValue({ _tag: "Ok", value: undefined });
    const ctx: ToolContext = { confirmed: true, payload: { items: [{ id: "a" }] } };
    const res = await enqueueOutreachTool.execute("programma outreach", ctx);
    expect(res.kind).toBe("result");
    expect(enqueueOutreach).toHaveBeenCalledTimes(1);
  });

  it("con confirmed ma items vuoti lancia errore gestito (non throw non gestito)", async () => {
    const ctx: ToolContext = { confirmed: true, payload: { items: [] } };
    await expect(enqueueOutreachTool.execute("programma outreach", ctx)).rejects.toThrow(/Nessun item/);
  });

  it("propaga errore DAL come Error", async () => {
    (enqueueOutreach as any).mockResolvedValue({ _tag: "Err", error: { message: "boom" } });
    const ctx: ToolContext = { confirmed: true, payload: { items: [{ id: "a" }] } };
    await expect(enqueueOutreachTool.execute("programma outreach", ctx)).rejects.toThrow(/boom/);
  });
});

// ============= cancel-outreach-item =============
describe("cancelOutreachItemTool", () => {
  it("match positivi/negativi", () => {
    expect(cancelOutreachItemTool.match("cancella outreach per Mario")).toBe(true);
    expect(cancelOutreachItemTool.match("posticipa outreach di 2 giorni")).toBe(true);
    expect(cancelOutreachItemTool.match("crea un nuovo contatto")).toBe(false);
  });

  it("senza confirmed ritorna approval", async () => {
    const res = await cancelOutreachItemTool.execute(`cancella outreach ${UUID}`, {});
    expect(res.kind).toBe("approval");
    expect(updateOutreachItem).not.toHaveBeenCalled();
  });

  it("con confirmed e id valido cancella", async () => {
    (updateOutreachItem as any).mockResolvedValue(undefined);
    const ctx: ToolContext = { confirmed: true, payload: { item_id: UUID, action: "cancel" } };
    const res = await cancelOutreachItemTool.execute("cancella outreach", ctx);
    expect(res.kind).toBe("result");
    expect(updateOutreachItem).toHaveBeenCalledWith(UUID, { status: "cancelled" });
  });

  it("id mancante/invalido → throw gestito", async () => {
    const ctx: ToolContext = { confirmed: true, payload: { item_id: "not-a-uuid" } };
    await expect(cancelOutreachItemTool.execute("cancella outreach", ctx)).rejects.toThrow();
  });
});

// ============= create-campaign =============
describe("createCampaignTool", () => {
  it("match positivi/negativi", () => {
    expect(createCampaignTool.match("crea campagna Malta Q1")).toBe(true);
    expect(createCampaignTool.match("lancia campagna nuova")).toBe(true);
    expect(createCampaignTool.match("mostrami i partner")).toBe(false);
  });

  it("senza confirmed ritorna approval", async () => {
    const res = await createCampaignTool.execute('crea campagna "Malta Q1"', {});
    expect(res.kind).toBe("approval");
    expect(createCampaignJob).not.toHaveBeenCalled();
  });

  it("con confirmed crea il job", async () => {
    (createCampaignJob as any).mockResolvedValue({ _tag: "Ok", value: {} });
    const ctx: ToolContext = { confirmed: true, payload: { company_name: "ACME" } };
    const res = await createCampaignTool.execute("crea campagna", ctx);
    expect(res.kind).toBe("result");
    expect(createCampaignJob).toHaveBeenCalledTimes(1);
  });

  it("propaga errore DAL", async () => {
    (createCampaignJob as any).mockResolvedValue({ _tag: "Err", error: { message: "db down" } });
    const ctx: ToolContext = { confirmed: true, payload: {} };
    await expect(createCampaignTool.execute("crea campagna", ctx)).rejects.toThrow(/db down/);
  });
});

// ============= launch-mission =============
describe("launchMissionTool", () => {
  it("match positivi/negativi", () => {
    expect(launchMissionTool.match("avvia la missione Malta")).toBe(true);
    expect(launchMissionTool.match("esegui missione autopilot X")).toBe(true);
    expect(launchMissionTool.match("crea un partner")).toBe(false);
  });

  it("senza confirmed ritorna approval e risolve missione", async () => {
    (findAgentMissionByTitleLike as any).mockResolvedValue({ id: UUID, title: "Missione Malta" });
    const res = await launchMissionTool.execute("avvia missione Malta", {});
    expect(res.kind).toBe("approval");
    expect(invokeEdge).not.toHaveBeenCalled();
  });

  it("con confirmed e mission_id invoca edge function", async () => {
    (invokeEdge as any).mockResolvedValue({ status: "ok", message: "done" });
    const ctx: ToolContext = { confirmed: true, payload: { mission_id: UUID } };
    const res = await launchMissionTool.execute("avvia missione", ctx);
    expect(res.kind).toBe("result");
    expect(invokeEdge).toHaveBeenCalledWith("mission-executor", expect.objectContaining({ body: { mission_id: UUID, user_id: "user-1" } }));
  });

  it("senza mission_id non chiama edge e ritorna risultato informativo", async () => {
    const ctx: ToolContext = { confirmed: true, payload: {} };
    const res = await launchMissionTool.execute("avvia missione", ctx);
    expect(res.kind).toBe("result");
    expect(invokeEdge).not.toHaveBeenCalled();
  });

  it("sessione non valida → messaggio gestito, nessun throw", async () => {
    (supabase.auth.getUser as any).mockResolvedValueOnce({ data: { user: null } });
    const ctx: ToolContext = { confirmed: true, payload: { mission_id: UUID } };
    const res = await launchMissionTool.execute("avvia missione", ctx);
    expect(res.kind).toBe("result");
    expect(res.title).toMatch(/Sessione non valida/);
  });
});

// ============= mission-control =============
describe("missionControlTool", () => {
  it("match positivi/negativi", () => {
    expect(missionControlTool.match("metti in pausa la missione Malta")).toBe(true);
    expect(missionControlTool.match("ferma la missione X")).toBe(true);
    expect(missionControlTool.match("mostrami le missioni")).toBe(false);
  });

  it("senza confirmed ritorna approval", async () => {
    const res = await missionControlTool.execute("metti in pausa la missione Malta", {});
    expect(res.kind).toBe("approval");
    expect(updateAgentMissionFields).not.toHaveBeenCalled();
  });

  it("con confirmed aggiorna stato missione", async () => {
    (updateAgentMissionFields as any).mockResolvedValue(undefined);
    const ctx: ToolContext = { confirmed: true, payload: { mission_id: UUID, action: "paused" } };
    const res = await missionControlTool.execute("pausa missione", ctx);
    expect(res.kind).toBe("result");
    expect(updateAgentMissionFields).toHaveBeenCalledWith(UUID, { status: "paused" });
  });

  it("errore DAL gestito senza throw", async () => {
    (updateAgentMissionFields as any).mockRejectedValue(new Error("update failed"));
    const ctx: ToolContext = { confirmed: true, payload: { mission_id: UUID, action: "paused" } };
    const res = await missionControlTool.execute("pausa missione", ctx);
    expect(res.kind).toBe("result");
    expect((res as any).status).toBe("error");
  });

  it("mission_id mancante → result status error senza throw", async () => {
    const ctx: ToolContext = { confirmed: true, payload: {} };
    const res = await missionControlTool.execute("pausa missione", ctx);
    expect(res.kind).toBe("result");
    expect((res as any).status).toBe("error");
  });
});

// ============= schedule-activity =============
describe("scheduleActivityTool", () => {
  it("match positivi/negativi", () => {
    expect(scheduleActivityTool.match("programma un'attività per domani")).toBe(true);
    expect(scheduleActivityTool.match("metti in agenda una chiamata")).toBe(true);
    expect(scheduleActivityTool.match("elimina il contatto")).toBe(false);
  });

  it("senza confirmed ritorna approval", async () => {
    const ctx: ToolContext = { payload: { kind: "human_activity", title: "Chiamata" } };
    const res = await scheduleActivityTool.execute("programma attività", ctx);
    expect(res.kind).toBe("approval");
    expect(insertHumanActivity).not.toHaveBeenCalled();
  });

  it("con confirmed crea human_activity", async () => {
    (insertHumanActivity as any).mockResolvedValue(undefined);
    const ctx: ToolContext = { confirmed: true, payload: { kind: "human_activity", title: "Chiamata" } };
    const res = await scheduleActivityTool.execute("programma attività", ctx);
    expect(res.kind).toBe("result");
    expect(insertHumanActivity).toHaveBeenCalledTimes(1);
  });

  it("con confirmed crea agent_task se agentId presente", async () => {
    (insertAgentTask as any).mockResolvedValue(undefined);
    const ctx: ToolContext = {
      confirmed: true,
      payload: { kind: "agent_task", title: "Follow up", agentId: "agent-1" },
    };
    const res = await scheduleActivityTool.execute("programma attività", ctx);
    expect(res.kind).toBe("result");
    expect(insertAgentTask).toHaveBeenCalledTimes(1);
  });

  it("agent_task senza agentId → risultato gestito senza throw", async () => {
    const ctx: ToolContext = { confirmed: true, payload: { kind: "agent_task", title: "Follow up" } };
    const res = await scheduleActivityTool.execute("programma attività", ctx);
    if (res.kind !== "result") throw new Error(`kind inatteso: ${res.kind}`);
    expect(res.message).toMatch(/agentId/);
  });

  it("errore inserimento gestito senza throw", async () => {
    (insertHumanActivity as any).mockRejectedValue(new Error("insert failed"));
    const ctx: ToolContext = { confirmed: true, payload: { kind: "human_activity", title: "Chiamata" } };
    const res = await scheduleActivityTool.execute("programma attività", ctx);
    if (res.kind !== "result") throw new Error(`kind inatteso: ${res.kind}`);
    expect(res.message).toMatch(/insert failed/);
  });
});

// ============= close-activity =============
describe("closeActivityTool", () => {
  it("match positivi/negativi", () => {
    expect(closeActivityTool.match("completa l'attività di follow up")).toBe(true);
    expect(closeActivityTool.match("chiudi attività riunione")).toBe(true);
    expect(closeActivityTool.match("invia una mail")).toBe(false);
  });

  it("senza confirmed ritorna approval", async () => {
    const res = await closeActivityTool.execute(`completa attività ${UUID}`, {});
    expect(res.kind).toBe("approval");
    expect(patchActivity).not.toHaveBeenCalled();
  });

  it("con confirmed chiude attività risolta", async () => {
    (findActivityRef as any).mockResolvedValue({ id: UUID, title: "Follow up" });
    (patchActivity as any).mockResolvedValue(undefined);
    const ctx: ToolContext = { confirmed: true, payload: { activity_id: UUID, status: "completed" } };
    const res = await closeActivityTool.execute("completa attività", ctx);
    expect(res.kind).toBe("result");
    expect(patchActivity).toHaveBeenCalledTimes(1);
  });

  it("attività non trovata → throw gestito", async () => {
    (findActivityRef as any).mockResolvedValue(null);
    const ctx: ToolContext = { confirmed: true, payload: { activity_id: UUID } };
    await expect(closeActivityTool.execute("completa attività", ctx)).rejects.toThrow(/non trovata/);
  });

  it("riferimento mancante → throw gestito", async () => {
    const ctx: ToolContext = { confirmed: true, payload: {} };
    await expect(closeActivityTool.execute("completa attività", ctx)).rejects.toThrow(/mancante/);
  });
});

// ============= reschedule-activity =============
describe("rescheduleActivityTool", () => {
  it("match positivi/negativi", () => {
    expect(rescheduleActivityTool.match("sposta l'attività al 2024-05-01")).toBe(true);
    expect(rescheduleActivityTool.match("crea una campagna")).toBe(false);
  });

  it("senza confirmed ritorna approval", async () => {
    const res = await rescheduleActivityTool.execute(`sposta attività ${UUID} 2024-05-01`, {});
    expect(res.kind).toBe("approval");
    expect(patchActivity).not.toHaveBeenCalled();
  });

  it("con confirmed riprogramma", async () => {
    (findActivityRef as any).mockResolvedValue({ id: UUID, title: "Follow up" });
    (patchActivity as any).mockResolvedValue(undefined);
    const ctx: ToolContext = { confirmed: true, payload: { activity_id: UUID, dueAt: "2024-05-01" } };
    const res = await rescheduleActivityTool.execute("sposta attività", ctx);
    expect(res.kind).toBe("result");
    expect(patchActivity).toHaveBeenCalledTimes(1);
  });

  it("data mancante → throw gestito", async () => {
    const ctx: ToolContext = { confirmed: true, payload: { activity_id: UUID } };
    await expect(rescheduleActivityTool.execute("sposta attività", ctx)).rejects.toThrow(/data mancante/i);
  });
});

// ============= pending-action-executor =============
describe("pendingActionExecutorTool", () => {
  it("match positivi/negativi", () => {
    expect(pendingActionExecutorTool.match("esegui pending action")).toBe(true);
    expect(pendingActionExecutorTool.match("crea attività")).toBe(false);
  });

  it("senza confirmed ritorna approval", async () => {
    const res = await pendingActionExecutorTool.execute(`esegui pending action ${UUID}`, {});
    expect(res.kind).toBe("approval");
    expect(invokeEdge).not.toHaveBeenCalled();
  });

  it("con confirmed invoca edge", async () => {
    (invokeEdge as any).mockResolvedValue({ status: "ok" });
    const ctx: ToolContext = { confirmed: true, payload: { action_id: UUID } };
    const res = await pendingActionExecutorTool.execute("esegui pending action", ctx);
    expect(res.kind).toBe("result");
    expect(invokeEdge).toHaveBeenCalledWith("pending-action-executor", expect.objectContaining({ body: { action_id: UUID } }));
  });

  it("action_id mancante → nessuna chiamata edge, risultato gestito", async () => {
    const ctx: ToolContext = { confirmed: true, payload: {} };
    const res = await pendingActionExecutorTool.execute("esegui pending action", ctx);
    expect(res.kind).toBe("result");
    expect(invokeEdge).not.toHaveBeenCalled();
  });
});

// ============= send-whatsapp =============
describe("sendWhatsappTool", () => {
  it("match positivi/negativi", () => {
    expect(sendWhatsappTool.match('invia whatsapp a +391234567890 "ciao"')).toBe(true);
    expect(sendWhatsappTool.match("invia una mail")).toBe(false);
  });

  it("senza confirmed ritorna approval, mai invio diretto", async () => {
    const res = await sendWhatsappTool.execute('invia whatsapp a +391234567890 "ciao"', {});
    expect(res.kind).toBe("approval");
    expect(invokeEdge).not.toHaveBeenCalled();
  });

  it("con confirmed invoca edge (nessun invio reale, mockato)", async () => {
    (invokeEdge as any).mockResolvedValue({ queued: true, message: "ok" });
    const ctx: ToolContext = { confirmed: true, payload: { recipient: "+391234567890", message_text: "ciao" } };
    const res = await sendWhatsappTool.execute("invia whatsapp", ctx);
    expect(res.kind).toBe("result");
    expect(invokeEdge).toHaveBeenCalledWith("send-whatsapp", expect.any(Object));
  });

  it("payload incompleto → risultato gestito senza chiamare edge", async () => {
    const ctx: ToolContext = { confirmed: true, payload: {} };
    const res = await sendWhatsappTool.execute("invia whatsapp", ctx);
    expect(res.kind).toBe("result");
    expect(invokeEdge).not.toHaveBeenCalled();
  });
});

// ============= send-linkedin =============
describe("sendLinkedinTool", () => {
  it("match positivi/negativi", () => {
    expect(sendLinkedinTool.match('scrivi su linkedin a mario "ciao"')).toBe(true);
    expect(sendLinkedinTool.match("invia whatsapp")).toBe(false);
  });

  it("senza confirmed ritorna approval", async () => {
    const res = await sendLinkedinTool.execute('scrivi su linkedin.com/in/mario "ciao"', {});
    expect(res.kind).toBe("approval");
    expect(invokeEdge).not.toHaveBeenCalled();
  });

  it("con confirmed invoca edge (mockato, nessun invio reale)", async () => {
    (invokeEdge as any).mockResolvedValue({ queued: true });
    const ctx: ToolContext = {
      confirmed: true,
      payload: { recipient: "https://linkedin.com/in/mario", message_text: "ciao" },
    };
    const res = await sendLinkedinTool.execute("invia linkedin", ctx);
    expect(res.kind).toBe("result");
    expect(invokeEdge).toHaveBeenCalledWith("send-linkedin", expect.any(Object));
  });

  it("payload incompleto → risultato gestito senza chiamare edge", async () => {
    const ctx: ToolContext = { confirmed: true, payload: {} };
    const res = await sendLinkedinTool.execute("invia linkedin", ctx);
    expect(res.kind).toBe("result");
    expect(invokeEdge).not.toHaveBeenCalled();
  });
});

// ============= send-email-direct =============
describe("sendEmailDirectTool", () => {
  it("match positivi/negativi", () => {
    expect(sendEmailDirectTool.match("invia email a mario@test.com oggetto: Ciao testo: prova")).toBe(true);
    expect(sendEmailDirectTool.match("componi una mail per Mario")).toBe(false);
  });

  it("senza confirmed ritorna approval e MAI invia direttamente", async () => {
    const res = await sendEmailDirectTool.execute(
      "invia email a mario@test.com oggetto: Ciao testo: prova",
      {},
    );
    expect(res.kind).toBe("approval");
    expect(insertPendingActionReturningId).not.toHaveBeenCalled();
  });

  it("con confirmed mette in coda di approvazione (ai_pending_actions), non invia realmente", async () => {
    (insertPendingActionReturningId as any).mockResolvedValue({ id: "pa-1", error: null });
    const ctx: ToolContext = {
      confirmed: true,
      payload: { to: "mario@test.com", subject: "Ciao", body: "Prova" },
    };
    const res = await sendEmailDirectTool.execute("invia email", ctx);
    expect(res.kind).toBe("result");
    expect(insertPendingActionReturningId).toHaveBeenCalledTimes(1);
    expect(res.title).toMatch(/coda di approvazione/);
  });

  it("payload incompleto → risultato gestito senza throw", async () => {
    const ctx: ToolContext = { confirmed: true, payload: { to: "mario@test.com" } };
    const res = await sendEmailDirectTool.execute("invia email", ctx);
    expect(res.kind).toBe("result");
    expect(insertPendingActionReturningId).not.toHaveBeenCalled();
  });

  it("errore DAL gestito senza throw", async () => {
    (insertPendingActionReturningId as any).mockResolvedValue({ id: null, error: { message: "insert error" } });
    const ctx: ToolContext = {
      confirmed: true,
      payload: { to: "mario@test.com", subject: "Ciao", body: "Prova" },
    };
    const res = await sendEmailDirectTool.execute("invia email", ctx);
    if (res.kind !== "result") throw new Error(`kind inatteso: ${res.kind}`);
    expect(res.message).toMatch(/insert error/);
  });
});

// ============= mark-message =============
describe("markMessageTool", () => {
  it("match positivi/negativi", () => {
    expect(markMessageTool.match("segna il messaggio come letto")).toBe(true);
    expect(markMessageTool.match("marca la mail come letta")).toBe(true);
    expect(markMessageTool.match("crea campagna")).toBe(false);
  });

  it("senza confirmed ritorna approval", async () => {
    const res = await markMessageTool.execute(`segna messaggio ${UUID} come letto`, {});
    expect(res.kind).toBe("approval");
    expect(patchChannelMessage).not.toHaveBeenCalled();
  });

  it("con confirmed marca come letto", async () => {
    (patchChannelMessage as any).mockResolvedValue(undefined);
    const ctx: ToolContext = { confirmed: true, payload: { message_id: UUID, action: "read" } };
    const res = await markMessageTool.execute("segna messaggio", ctx);
    expect(res.kind).toBe("result");
    expect(patchChannelMessage).toHaveBeenCalledWith(UUID, expect.objectContaining({ read_at: expect.any(String) }));
  });

  it("id invalido → throw gestito", async () => {
    const ctx: ToolContext = { confirmed: true, payload: { message_id: "bad-id", action: "read" } };
    await expect(markMessageTool.execute("segna messaggio", ctx)).rejects.toThrow();
  });

  it("categoria mancante per action=category → throw gestito", async () => {
    const ctx: ToolContext = { confirmed: true, payload: { message_id: UUID, action: "category" } };
    await expect(markMessageTool.execute("segna messaggio", ctx)).rejects.toThrow(/Categoria mancante/);
  });
});

// ============= apply-email-rules =============
describe("applyEmailRulesTool", () => {
  it("match positivi/negativi", () => {
    expect(applyEmailRulesTool.match("applica regole email a tutta l'inbox")).toBe(true);
    expect(applyEmailRulesTool.match("crea contatto")).toBe(false);
  });

  it("senza confirmed ritorna approval", async () => {
    const res = await applyEmailRulesTool.execute("applica regole email", {});
    expect(res.kind).toBe("approval");
    expect(invokeEdge).not.toHaveBeenCalled();
  });

  it("con confirmed invoca edge", async () => {
    (invokeEdge as any).mockResolvedValue({ processed: 10, matched: 5 });
    const ctx: ToolContext = { confirmed: true, payload: {} };
    const res = await applyEmailRulesTool.execute("applica regole email", ctx);
    expect(res.kind).toBe("result");
    expect(invokeEdge).toHaveBeenCalledWith("apply-email-rules", expect.any(Object));
  });

  it("errore edge gestito senza throw", async () => {
    (invokeEdge as any).mockResolvedValue({ error: "rules engine down" });
    const ctx: ToolContext = { confirmed: true, payload: {} };
    const res = await applyEmailRulesTool.execute("applica regole email", ctx);
    expect(res.kind).toBe("result");
    expect(res.title).toMatch(/fallita/);
  });
});

// ============= manage-email-folders =============
describe("manageEmailFoldersTool", () => {
  it("match positivi/negativi", () => {
    expect(manageEmailFoldersTool.match("crea cartella email Fatture")).toBe(true);
    expect(manageEmailFoldersTool.match("elimina cartella inbox Archivio")).toBe(true);
    expect(manageEmailFoldersTool.match("invia whatsapp")).toBe(false);
  });

  it("senza confirmed ritorna approval", async () => {
    const res = await manageEmailFoldersTool.execute('crea cartella email "Fatture"', {});
    expect(res.kind).toBe("approval");
    expect(invokeEdge).not.toHaveBeenCalled();
  });

  it("con confirmed invoca edge", async () => {
    (invokeEdge as any).mockResolvedValue({ success: true });
    const ctx: ToolContext = { confirmed: true, payload: { action: "create", folder: "Fatture" } };
    const res = await manageEmailFoldersTool.execute("crea cartella email", ctx);
    expect(res.kind).toBe("result");
    expect(invokeEdge).toHaveBeenCalledWith("manage-email-folders", expect.any(Object));
  });

  it("payload incompleto → risultato gestito senza chiamare edge", async () => {
    const ctx: ToolContext = { confirmed: true, payload: {} };
    const res = await manageEmailFoldersTool.execute("crea cartella email", ctx);
    expect(res.kind).toBe("result");
    expect(invokeEdge).not.toHaveBeenCalled();
  });
});
