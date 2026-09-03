import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeEdgeMock = vi.fn();

vi.mock("@/lib/api/invokeEdge", () => ({
  invokeEdge: (...args: unknown[]) => invokeEdgeMock(...args),
}));

import { replayDomainEventsTool } from "../replayDomainEvents";

describe("replayDomainEventsTool", () => {
  beforeEach(() => {
    invokeEdgeMock.mockReset();
  });

  describe("match", () => {
    it.each([
      "replay eventi dominio ultimi 7 giorni",
      "riesegui eventi degli ultimi 3 giorni",
      "riproduci gli eventi del dominio",
      "reprocess domain events",
    ])("riconosce: %s", (p) => {
      expect(replayDomainEventsTool.match(p)).toBe(true);
    });

    it.each(["mostra gli eventi recenti", "quanti eventi ci sono", "crea un nuovo agente"])(
      "NON riconosce: %s",
      (p) => {
        expect(replayDomainEventsTool.match(p)).toBe(false);
      },
    );
  });

  it("senza conferma → approval con finestra estratta dal prompt", async () => {
    const res = await replayDomainEventsTool.execute('replay eventi dominio ultimi 5 giorni evento "outreach.sent"');
    expect(res.kind).toBe("approval");
    if (res.kind === "approval") {
      expect(res.details[1].value).toBe("outreach.sent");
      expect(res.pendingPayload.event_type).toBe("outreach.sent");
    }
  });

  it("senza finestra esplicita → default backend / tutti", async () => {
    const res = await replayDomainEventsTool.execute("replay eventi dominio");
    expect(res.kind).toBe("approval");
    if (res.kind === "approval") {
      expect(res.details[0].value).toBe("(default backend)");
      expect(res.details[1].value).toBe("tutti");
    }
  });

  it("confermato → invoca edge function e ritorna esito", async () => {
    invokeEdgeMock.mockResolvedValue({ replayed: 12, failed: 1 });
    const res = await replayDomainEventsTool.execute("replay eventi dominio", {
      confirmed: true,
      payload: { from: "2024-01-01T00:00:00.000Z", event_type: null },
    });
    expect(invokeEdgeMock).toHaveBeenCalledWith(
      "replay-domain-events",
      expect.objectContaining({ body: { from: "2024-01-01T00:00:00.000Z", event_type: null } }),
    );
    expect(res.kind).toBe("result");
    if (res.kind === "result") {
      expect(res.title).toBe("Replay completato");
      expect(res.message).toContain("12");
      expect(res.meta?.count).toBe(12);
    }
  });

  it("edge function ritorna errore → result con titolo fallito", async () => {
    invokeEdgeMock.mockResolvedValue({ error: "edge down" });
    const res = await replayDomainEventsTool.execute("replay eventi dominio", { confirmed: true, payload: {} });
    expect(res.kind).toBe("result");
    if (res.kind === "result") {
      expect(res.title).toBe("Replay fallito");
      expect(res.message).toBe("edge down");
    }
  });
});
