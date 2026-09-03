import { describe, it, expect, vi, beforeEach } from "vitest";

const createAgentMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock("@/v2/io/supabase/mutations/agents", () => ({
  createAgent: (...args: unknown[]) => createAgentMock(...args),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: (...args: unknown[]) => getSessionMock(...args) } },
}));

import { createAgentTool } from "../createAgent";
import { ok, err } from "@/v2/core/domain/result";

describe("createAgentTool", () => {
  beforeEach(() => {
    createAgentMock.mockReset();
    getSessionMock.mockReset();
  });

  describe("match", () => {
    it.each(["crea agente Marco", "nuovo agente per outreach"])("riconosce: %s", (p) => {
      expect(createAgentTool.match(p)).toBe(true);
    });
    it.each(["attiva agente Marco", "quanti agenti abbiamo"])("NON riconosce: %s", (p) => {
      expect(createAgentTool.match(p)).toBe(false);
    });
  });

  it("senza conferma → approval con payload estratto dal prompt", async () => {
    const res = await createAgentTool.execute('crea agente "Marco" con ruolo outreach');
    expect(res.kind).toBe("approval");
    if (res.kind === "approval") {
      expect(res.pendingPayload.role).toBe("outreach");
      expect(res.toolId).toBe("create-agent");
    }
  });

  it("confermato, utente autenticato → crea agente", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } });
    createAgentMock.mockResolvedValue(ok({ id: "a1", name: "Marco" }));
    const res = await createAgentTool.execute("crea agente Marco", {
      confirmed: true,
      payload: { name: "Marco", role: "outreach", system_prompt: "", avatar_emoji: "🤖" },
    });
    expect(createAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", name: "Marco", role: "outreach" }),
    );
    expect(res.kind).toBe("result");
    if (res.kind === "result") {
      expect(res.message).toContain("Marco");
    }
  });

  it("confermato, utente non autenticato → lancia errore", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    await expect(
      createAgentTool.execute("crea agente Marco", { confirmed: true, payload: { name: "Marco" } }),
    ).rejects.toThrow("Non autenticato");
  });

  it("confermato, mutation fallisce → propaga errore", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } });
    createAgentMock.mockResolvedValue(err({ code: "DATABASE_ERROR", message: "boom" } as never));
    await expect(
      createAgentTool.execute("crea agente Marco", { confirmed: true, payload: { name: "Marco" } }),
    ).rejects.toThrow("boom");
  });
});
