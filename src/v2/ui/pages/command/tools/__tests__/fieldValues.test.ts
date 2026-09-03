import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/data/aiFieldValues", () => ({
  rpcFieldValues: vi.fn(),
}));
vi.mock("@/data/rpc", () => ({
  rpcIntrospectSchema: vi.fn(),
}));

import { rpcFieldValues } from "@/data/aiFieldValues";
import { rpcIntrospectSchema } from "@/data/rpc";
import { fieldValuesTool } from "../fieldValues";

describe("fieldValuesTool", () => {
  beforeEach(() => vi.resetAllMocks());

  it("match: riconosce prompt su valori di un campo", () => {
    expect(fieldValuesTool.match("quali valori esistono nel campo lead_status dei partner")).toBe(true);
  });

  it("match: non riconosce prompt senza la parola 'campo'", () => {
    expect(fieldValuesTool.match("quali sono gli stati dei partner")).toBe(false);
  });

  it("match: non riconosce prompt scorrelati", () => {
    expect(fieldValuesTool.match("ciao come stai")).toBe(false);
  });

  it("execute: senza campo parsabile ritorna result empty senza chiamare RPC", async () => {
    const res = await fieldValuesTool.execute("dammi una mano con i valori", undefined);
    expect(res.kind).toBe("result");
    if (res.kind !== "result") throw new Error("expected result");
    expect(res.status).toBe("empty");
    expect(rpcFieldValues).not.toHaveBeenCalled();
  });

  it("execute: happy path costruisce la tabella dei valori", async () => {
    vi.mocked(rpcFieldValues).mockResolvedValue({
      distinct_values: 3,
      non_null: 10,
      total_rows: 10,
      top_values: [{ value: "new", count: 5 }, { value: "contacted", count: 5 }],
    });
    const res = await fieldValuesTool.execute("quali valori esistono nel campo lead_status dei partner", undefined);
    expect(res.kind).toBe("table");
    if (res.kind !== "table") throw new Error("expected table");
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0].value).toBe("new");
  });

  it("execute: campo inesistente -> fallback su introspezione schema", async () => {
    vi.mocked(rpcFieldValues)
      .mockResolvedValueOnce({ error: "colonna inesistente" })
      .mockResolvedValueOnce({ distinct_values: 1, non_null: 2, total_rows: 2, top_values: [{ value: "x", count: 2 }] });
    vi.mocked(rpcIntrospectSchema).mockResolvedValue([{ columns: [{ name: "lead_status" }] } as any]);
    const res = await fieldValuesTool.execute("quali valori esistono nel campo lead_stat dei partner", undefined);
    expect(res.kind).toBe("table");
    if (res.kind !== "table") throw new Error("expected table");
    expect(res.rows[0].value).toBe("x");
  });

  it("execute: RPC ritorna null senza throw", async () => {
    vi.mocked(rpcFieldValues).mockResolvedValue(null);
    vi.mocked(rpcIntrospectSchema).mockResolvedValue(null);
    const res = await fieldValuesTool.execute("quali valori esistono nel campo lead_status dei partner", undefined);
    expect(res.kind).toBe("result");
    if (res.kind !== "result") throw new Error("expected result");
    expect(res.status).toBe("error");
  });
});
