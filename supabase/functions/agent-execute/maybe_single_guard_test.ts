import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Doctrine guard (Sezione 6 audit): il lookup agent_tasks NON deve mai
// usare .single() — PGRST116 su task_id inesistente farebbe 500 invece
// di 404 gestito. Test statico previene regressioni.
Deno.test("agent-execute: agent_tasks lookup uses maybeSingle()", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  // Match: ".from(\"agent_tasks\")" ... ".eq(\"id\", task_id)" ... ".maybeSingle()"
  const taskLookupBlock = src.match(/from\("agent_tasks"\)[\s\S]*?\.eq\("id", task_id\)[\s\S]*?(maybeSingle|single)\(\)/);
  assert(taskLookupBlock, "agent_tasks lookup by task_id not found");
  assert(
    taskLookupBlock[1] === "maybeSingle",
    `agent_tasks lookup must use .maybeSingle() (found .${taskLookupBlock[1]}())`,
  );
});

Deno.test("agent-autonomous-cycle: partner lookups use maybeSingle()", async () => {
  const src = await Deno.readTextFile(
    new URL("../agent-autonomous-cycle/index.ts", import.meta.url),
  );
  // Nessuna occorrenza di `.single()` su lookup partners by id
  const violations = [...src.matchAll(/from\("partners"\)[^;]*\.eq\("id",[^;]*\.single\(\)/g)];
  assert(
    violations.length === 0,
    `Found ${violations.length} partners.single() lookup(s) — must be maybeSingle()`,
  );
});