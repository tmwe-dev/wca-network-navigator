/**
 * Contratto cronGuard — ordine dei gate e comportamento fail-open.
 * Offline: nessuna rete, client Supabase simulato.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { cronGuardCheck, cronGuardLogRun } from "./cronGuard.ts";
import type {
  CronSelectBuilder,
  CronTableBuilder,
  SupabaseCronClient,
} from "./supabaseCronClient.ts";

type Row = Record<string, unknown> | null;

/** Client fake tipizzato: risolve per tabella+key, registra le insert. */
function fakeClient(rows: Record<string, Row>, opts: { throwOn?: string } = {}) {
  const inserts: Array<{ table: string; payload: unknown }> = [];

  const client: SupabaseCronClient = {
    from(table: string): CronTableBuilder {
      let lookupKey = table;
      const selectBuilder: CronSelectBuilder = {
        eq(_column: string, value: string) {
          lookupKey = `${table}:${value}`;
          return selectBuilder;
        },
        is() {
          return selectBuilder;
        },
        order() {
          return selectBuilder;
        },
        limit() {
          return selectBuilder;
        },
        maybeSingle() {
          if (opts.throwOn && lookupKey.startsWith(opts.throwOn)) throw new Error("db down");
          return Promise.resolve({ data: rows[lookupKey] ?? null });
        },
      };
      return {
        select() {
          return selectBuilder;
        },
        insert(payload: Record<string, unknown>) {
          inserts.push({ table, payload });
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  return { client, inserts };
}

const config = {
  jobName: "test_job",
  enabledKey: "test_enabled",
  intervalKey: "test_interval",
  defaultIntervalMin: 10,
};

Deno.test("cron_paused ha priorità su tutto", async () => {
  const { client } = fakeClient({ "system_flags:cron_paused": { value: true } });
  assertEquals(await cronGuardCheck(client, config), { skip: true, reason: "cron_paused" });
});

Deno.test("toggle disattivato → disabled_by_user", async () => {
  const { client } = fakeClient({ "app_settings:test_enabled": { value: "false" } });
  assertEquals(await cronGuardCheck(client, config), { skip: true, reason: "disabled_by_user" });
});

Deno.test("throttle attivo quando l'ultimo run è recente", async () => {
  const { client } = fakeClient({
    "cron_run_log:test_job": { ran_at: new Date(Date.now() - 60_000).toISOString() },
  });
  const res = await cronGuardCheck(client, config);
  assertEquals(res.skip, true);
  if (res.skip) assertEquals(res.reason, "throttled");
});

Deno.test("nessun gate attivo → skip false", async () => {
  const { client } = fakeClient({});
  assertEquals(await cronGuardCheck(client, config), { skip: false });
});

Deno.test("fail-open: errori di lettura non bloccano il run", async () => {
  const { client } = fakeClient({}, { throwOn: "system_flags" });
  assertEquals(await cronGuardCheck(client, config), { skip: false });
});

Deno.test("cronGuardLogRun scrive su cron_run_log", async () => {
  const { client, inserts } = fakeClient({});
  await cronGuardLogRun(client, "test_job", { processed: 2 }, null);
  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].table, "cron_run_log");
});
