import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/data/commandKbSearch", () => ({
  searchKbFullText: vi.fn(),
  searchKbByTitle: vi.fn(),
}));

import { searchKbFullText, searchKbByTitle } from "@/data/commandKbSearch";
import { searchKbTool } from "../searchKb";

describe("searchKbTool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("match: riconosce prompt su kb/documentazione/workflow", () => {
    expect(searchKbTool.match("cerca nella kb come si fa l'import")).toBe(true);
    expect(searchKbTool.match("mostrami la documentazione")).toBe(true);
  });

  it("match: non riconosce prompt scorrelati", () => {
    expect(searchKbTool.match("elenco partner Malta")).toBe(false);
  });

  it("execute: happy path con risultati full-text", async () => {
    vi.mocked(searchKbFullText).mockResolvedValue([
      { id: "1", title: "Import contatti", category: "guide", content: "Come importare i contatti...", source_path: "docs/import.md", priority: 1 },
    ]);
    const res = await searchKbTool.execute("come si fa l'import contatti", undefined);
    expect(res.kind).toBe("table");
    if (res.kind !== "table") throw new Error("expected table");
    expect(res.rows[0].title).toBe("Import contatti");
    expect(searchKbByTitle).not.toHaveBeenCalled();
  });

  it("execute: fallback su ricerca per titolo quando full-text vuoto", async () => {
    vi.mocked(searchKbFullText).mockResolvedValue([]);
    vi.mocked(searchKbByTitle).mockResolvedValue([
      { id: "2", title: "Workflow email", category: "guide", content: "...", source_path: null, priority: 0 },
    ]);
    const res = await searchKbTool.execute("come si fa il workflow email", undefined);
    expect(res.kind).toBe("table");
    if (res.kind !== "table") throw new Error("expected table");
    expect(res.rows[0].title).toBe("Workflow email");
  });

  it("execute: nessun risultato ovunque ritorna tabella con messaggio senza throw", async () => {
    vi.mocked(searchKbFullText).mockResolvedValue([]);
    vi.mocked(searchKbByTitle).mockResolvedValue([]);
    const res = await searchKbTool.execute("xyzabc123", undefined);
    expect(res.kind).toBe("table");
    if (res.kind !== "table") throw new Error("expected table");
    expect(res.rows[0].message).toContain("Nessuna entry trovata");
  });
});
