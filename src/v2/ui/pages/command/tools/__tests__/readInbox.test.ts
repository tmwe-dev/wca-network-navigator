import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/data/channelMessages", () => ({
  findRecentInboundMessages: vi.fn(),
}));

import { findRecentInboundMessages } from "@/data/channelMessages";
import { readInboxTool } from "../readInbox";

describe("readInboxTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("match: riconosce prompt su posta in arrivo/inbox", () => {
    expect(readInboxTool.match("mostrami la posta in arrivo")).toBe(true);
    expect(readInboxTool.match("ci sono messaggi non letti?")).toBe(true);
  });

  it("match: non riconosce prompt scorrelati", () => {
    expect(readInboxTool.match("elenco missioni")).toBe(false);
  });

  it("execute: happy path con messaggi", async () => {
    vi.mocked(findRecentInboundMessages).mockResolvedValue({
      rows: [
        {
          id: "1",
          channel: "email",
          from_name: "Mario",
          from_address: "m@x.it",
          subject: "Ciao",
          email_date: "2024-01-01T10:00:00Z",
          created_at: "2024-01-01T10:00:00Z",
          read_at: null,
          category: null,
        },
      ],
      count: 1,
    });
    const res = await readInboxTool.execute("inbox", undefined);
    expect(res.kind).toBe("table");
    if (res.kind !== "table") throw new Error("expected table");
    expect(res.rows[0].state).toBe("da leggere");
  });

  it("execute: nessun messaggio ritorna result empty", async () => {
    vi.mocked(findRecentInboundMessages).mockResolvedValue({ rows: [], count: 0 });
    const res = await readInboxTool.execute("inbox", undefined);
    expect(res.kind).toBe("result");
    if (res.kind !== "result") throw new Error("expected result");
    expect(res.status).toBe("empty");
  });

  it("execute: errore DB gestito senza throw", async () => {
    vi.mocked(findRecentInboundMessages).mockRejectedValue(new Error("db down"));
    const res = await readInboxTool.execute("inbox", undefined);
    expect(res.kind).toBe("result");
    if (res.kind !== "result") throw new Error("expected result");
    expect(res.status).toBe("error");
    expect(res.message).toContain("db down");
  });
});
