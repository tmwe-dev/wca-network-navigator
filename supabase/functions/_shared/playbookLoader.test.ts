import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { loadActivePlaybook } from "./playbookLoader.ts";

// Mock SupabaseClient minimo per i 3 step della query chain.
type ChainResult = { data: unknown; error: null };

function makeMock(steps: ChainResult[]) {
  let step = 0;
  // deno-lint-ignore no-explicit-any
  const chain = (): any => ({
    select: () => chain(),
    eq: () => chain(),
    order: () => chain(),
    limit: () => chain(),
    maybeSingle: () => Promise.resolve(steps[step++] ?? { data: null, error: null }),
    then: (resolve: (v: ChainResult) => void) => resolve(steps[step++] ?? { data: null, error: null }),
  });
  // deno-lint-ignore no-explicit-any
  return { from: (_t: string) => chain() } as any;
}

Deno.test("loadActivePlaybook: partnerId nullo → block vuoto, active=false", async () => {
  const res = await loadActivePlaybook(makeMock([]), "user-1", null);
  assertEquals(res, { block: "", active: false });
});

Deno.test("loadActivePlaybook: nessun workflow attivo → block vuoto", async () => {
  const mock = makeMock([{ data: null, error: null }]);
  const res = await loadActivePlaybook(mock, "user-1", "partner-1");
  assertEquals(res.active, false);
  assertEquals(res.block, "");
});

Deno.test("loadActivePlaybook: workflow + playbook attivi → block contiene istruzioni e tono canonico", async () => {
  const mock = makeMock([
    { data: { workflow_id: "wf-1", status: "active", current_step: 2 }, error: null },
    { data: { code: "sales_standard", name: "Sales Standard" }, error: null },
    { data: [{
      name: "Opening Pitch",
      description: "Aprire conversazione",
      prompt_template: "Sii diretto",
      suggested_actions: ["intro", "qualify"],
      kb_tags: [],
      code: "open",
    }], error: null },
  ]);
  const res = await loadActivePlaybook(mock, "user-1", "partner-1");
  assertEquals(res.active, true);
  assert(res.block.includes("PLAYBOOK ATTIVO — Opening Pitch"));
  assert(res.block.includes("sales_standard"));
  assert(res.block.includes("step: 2"));
  assert(res.block.includes("Sii diretto"));
  assert(res.block.includes("prima di applicare la KB generica"));
});

Deno.test("loadActivePlaybook: workflow attivo ma playbook lista vuota → block vuoto", async () => {
  const mock = makeMock([
    { data: { workflow_id: "wf-1", status: "active", current_step: 0 }, error: null },
    { data: { code: "wfx", name: "X" }, error: null },
    { data: [], error: null },
  ]);
  const res = await loadActivePlaybook(mock, "user-1", "partner-1");
  assertEquals(res, { block: "", active: false });
});