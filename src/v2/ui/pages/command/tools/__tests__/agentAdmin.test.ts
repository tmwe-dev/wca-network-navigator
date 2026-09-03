import { describe, it, expect, vi, beforeEach } from "vitest";

const findAgentRefMock = vi.fn();
const updateAgentMock = vi.fn();
const updateAgentPersonaByAgentIdMock = vi.fn();

vi.mock("@/data/agents", () => ({
  findAgentRef: (...args: unknown[]) => findAgentRefMock(...args),
  updateAgent: (...args: unknown[]) => updateAgentMock(...args),
}));
vi.mock("@/data/agentPersonas", () => ({
  updateAgentPersonaByAgentId: (...args: unknown[]) => updateAgentPersonaByAgentIdMock(...args),
}));

import { toggleAgentTool, updateAgentPersonaTool } from "../agentAdmin";

describe("toggleAgentTool", () => {
  beforeEach(() => {
    findAgentRefMock.mockReset();
    updateAgentMock.mockReset();
  });

  describe("match", () => {
    it.each(["attiva l'agente Marco", "disattiva agente Luigi", "abilita agente Gordon", "disabilita l'agente"])(
      "riconosce: %s",
      (p) => {
        expect(toggleAgentTool.match(p)).toBe(true);
      },
    );
    it.each(["crea agente Marco", "quanti agenti abbiamo"])("NON riconosce: %s", (p) => {
      expect(toggleAgentTool.match(p)).toBe(false);
    });
  });

  it("senza conferma → ritorna approval con stato dedotto dal prompt", async () => {
    const res = await toggleAgentTool.execute('disattiva agente "Gordon"');
    expect(res.kind).toBe("approval");
    if (res.kind === "approval") {
      expect(res.title).toBe("Disattivare agente?");
      expect(res.pendingPayload.active).toBe(false);
      expect(res.pendingPayload.agent_name).toBe("Gordon");
    }
  });

  it("attiva agente per default se non contiene negazione", async () => {
    const res = await toggleAgentTool.execute('attiva agente "Gordon"');
    expect(res.kind).toBe("approval");
    if (res.kind === "approval") {
      expect(res.pendingPayload.active).toBe(true);
    }
  });

  it("confermato, agente risolto → esegue update e ritorna result", async () => {
    findAgentRefMock.mockResolvedValue({ id: "agent-1", name: "Gordon" });
    updateAgentMock.mockResolvedValue(undefined);
    const res = await toggleAgentTool.execute('attiva agente "Gordon"', {
      confirmed: true,
      payload: { agent_name: "Gordon", active: true },
    });
    expect(updateAgentMock).toHaveBeenCalledWith("agent-1", { is_active: true });
    expect(res.kind).toBe("result");
    if (res.kind === "result") {
      expect(res.title).toContain("attivato");
      expect(res.message).toContain("Gordon");
    }
  });

  it("confermato ma senza riferimento → lancia errore", async () => {
    await expect(
      toggleAgentTool.execute("attiva agente", { confirmed: true, payload: {} }),
    ).rejects.toThrow("Riferimento agente mancante");
  });

  it("confermato, agente non trovato → lancia errore", async () => {
    findAgentRefMock.mockResolvedValue(null);
    await expect(
      toggleAgentTool.execute("attiva agente", { confirmed: true, payload: { agent_name: "Fantasma" } }),
    ).rejects.toThrow('Agente "Fantasma" non trovato');
  });
});

describe("updateAgentPersonaTool", () => {
  beforeEach(() => {
    findAgentRefMock.mockReset();
    updateAgentPersonaByAgentIdMock.mockReset();
  });

  describe("match", () => {
    it.each(["aggiorna persona dell'agente Gordon", "modifica tono agente Marco", "aggiorna prompt agente"])(
      "riconosce: %s",
      (p) => {
        expect(updateAgentPersonaTool.match(p)).toBe(true);
      },
    );
    it.each(["attiva agente Gordon", "crea agente nuovo"])("NON riconosce: %s", (p) => {
      expect(updateAgentPersonaTool.match(p)).toBe(false);
    });
  });

  it("senza conferma → approval", async () => {
    const res = await updateAgentPersonaTool.execute("aggiorna persona agente Gordon", {
      payload: { agent_name: "Gordon", updates: { tone: "amichevole" } },
    });
    expect(res.kind).toBe("approval");
    if (res.kind === "approval") {
      expect(res.details[0].value).toBe("Gordon");
      expect(res.details[1].value).toBe("tone");
    }
  });

  it("confermato → esegue update persona", async () => {
    findAgentRefMock.mockResolvedValue({ id: "agent-2", name: "Gordon" });
    updateAgentPersonaByAgentIdMock.mockResolvedValue(undefined);
    const res = await updateAgentPersonaTool.execute("aggiorna persona agente Gordon", {
      confirmed: true,
      payload: { agent_name: "Gordon", updates: { tone: "diretto" } },
    });
    expect(updateAgentPersonaByAgentIdMock).toHaveBeenCalledWith("agent-2", { tone: "diretto" });
    expect(res.kind).toBe("result");
  });

  it("confermato senza updates → lancia errore", async () => {
    await expect(
      updateAgentPersonaTool.execute("aggiorna persona agente Gordon", {
        confirmed: true,
        payload: { agent_name: "Gordon", updates: {} },
      }),
    ).rejects.toThrow("Nessun aggiornamento fornito");
  });

  it("confermato senza riferimento agente → lancia errore", async () => {
    await expect(
      updateAgentPersonaTool.execute("aggiorna persona agente", {
        confirmed: true,
        payload: { updates: { tone: "diretto" } },
      }),
    ).rejects.toThrow("Riferimento agente mancante");
  });
});
