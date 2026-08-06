/**
 * DAL — agentRolesOverview tests (D4)
 * Verifica: 5 chiamate Promise.all su tabelle attese, chain builder esatta
 * (select/is/eq/order), mapping data ?? [], semantica silenziosa preservata
 * (nessun throw quando error è valorizzato), guardrail sul consumer.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type BuilderReturn = { data: unknown; error: unknown };

function makeBuilder(result: BuilderReturn, calls: string[]) {
  const proxy: unknown = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: (v: BuilderReturn) => unknown) => resolve(result);
        }
        return (...args: unknown[]) => {
          calls.push(`${String(prop)}(${args.map((a) => JSON.stringify(a)).join(",")})`);
          return proxy;
        };
      },
    },
  );
  return proxy;
}

const fromMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => fromMock(table) },
}));

import { fetchAgentRolesOverview } from "../agentRolesOverview";

describe("DAL — fetchAgentRolesOverview", () => {
  beforeEach(() => fromMock.mockReset());

  it("esegue 5 query parallele con chain builder esatta e mapping dati", async () => {
    const seq: BuilderReturn[] = [
      {
        data: [
          {
            id: "a1",
            name: "Alice",
            role: "sales",
            avatar_emoji: "🦊",
            is_active: true,
            can_send_email: true,
            can_send_whatsapp: false,
            can_access_inbox: null,
            assigned_tools: ["t1"],
          },
        ],
        error: null,
      },
      { data: [{ agent_id: "a1" }], error: null },
      { data: [{ agent_id: "a1", allowed_tools: ["x", "y"], execution_mode: "auto" }], error: null },
      {
        data: [
          { id: "tpl1", enabled: true },
          { id: "tpl2", enabled: false },
        ],
        error: null,
      },
      { data: [{ id: "w1", is_active: true }], error: null },
    ];
    const perCall: string[][] = [[], [], [], [], []];
    let i = 0;
    fromMock.mockImplementation(() => makeBuilder(seq[i], perCall[i++]));

    const out = await fetchAgentRolesOverview();

    expect(fromMock).toHaveBeenNthCalledWith(1, "agents");
    expect(fromMock).toHaveBeenNthCalledWith(2, "agent_personas");
    expect(fromMock).toHaveBeenNthCalledWith(3, "agent_capabilities");
    expect(fromMock).toHaveBeenNthCalledWith(4, "funnemail_autoresponder_templates");
    expect(fromMock).toHaveBeenNthCalledWith(5, "wake_up_rules");

    const agentsChain = perCall[0].join(" ");
    expect(agentsChain).toContain(
      'select("id, name, role, avatar_emoji, is_active, can_send_email, can_send_whatsapp, can_access_inbox, assigned_tools")',
    );
    expect(agentsChain).toContain('is("deleted_at",null)');
    expect(agentsChain).toContain('eq("is_active",true)');
    expect(agentsChain).toContain('order("role",{"ascending":true})');

    expect(perCall[1].join(" ")).toContain('select("agent_id")');
    expect(perCall[2].join(" ")).toContain('select("agent_id, allowed_tools, execution_mode")');
    expect(perCall[3].join(" ")).toContain('select("id, enabled")');
    const wakeChain = perCall[4].join(" ");
    expect(wakeChain).toContain('select("id, is_active")');
    expect(wakeChain).toContain('is("deleted_at",null)');

    expect(out.agents).toHaveLength(1);
    expect(out.agents[0].id).toBe("a1");
    expect(out.personas).toEqual([{ agent_id: "a1" }]);
    expect(out.capabilities[0].allowed_tools).toEqual(["x", "y"]);
    expect(out.autoresponderTemplates).toHaveLength(2);
    expect(out.wakeUpRules[0].is_active).toBe(true);
  });

  it("equivalenza — data null (con o senza error) è normalizzato a [] senza throw", async () => {
    const err = new Error("RLS");
    const seq: BuilderReturn[] = [
      { data: null, error: err },
      { data: null, error: null },
      { data: null, error: err },
      { data: null, error: null },
      { data: null, error: err },
    ];
    let i = 0;
    fromMock.mockImplementation(() => makeBuilder(seq[i++], []));

    const out = await fetchAgentRolesOverview();
    expect(out).toEqual({
      agents: [],
      personas: [],
      capabilities: [],
      autoresponderTemplates: [],
      wakeUpRules: [],
    });
  });
});

describe("D4 guardrail — AgentRolesOverviewPage non deve reintrodurre supabase.from", () => {
  it("consumer usa solo la DAL", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/v2/ui/pages/AgentRolesOverviewPage.tsx", "utf8");
    expect(src).not.toMatch(/supabase\.from\(/);
    expect(src).not.toMatch(/from ["']@\/integrations\/supabase\/client["']/);
    expect(src).toContain("fetchAgentRolesOverview");
  });
});
