/**
 * backfill-email-rules — Applica le regole IMAP a messaggi STORICI già presenti
 * sul server di posta (non solo ai nuovi arrivi).
 *
 * Strategia: una connessione IMAP per address (sequenziale).
 * Per ogni address con auto_action impostata:
 *   1. SELECT INBOX
 *   2. UID SEARCH FROM "<address>" → recupera tutti gli UID storici
 *   3. Applica auto_action (mark_read | archive | move_to_folder | spam) a ogni UID
 *   4. Aggiorna channel_messages se la riga esiste in DB
 *   5. LOGOUT
 *
 * Input:
 *   { operator_id, scope: "address"|"group", target: string, dry_run?: boolean }
 *
 * Output:
 *   { addresses_processed, messages_matched, messages_applied, errors[] }
 *
 * NOTA: classe ImapConn + matcher duplicati intenzionalmente da apply-email-rules
 * per evitare di toccare quella function (vincolo: no regressioni su check-inbox).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getCaCertsForHost } from "./caCerts.ts";

const DEFAULT_BACKFILL_CAP = 5000;
const MAX_ADDRESSES_PER_CALL = 20;

interface RuleRow {
  id: string;
  operator_id: string | null;
  email_address: string | null;
  address: string | null;
  domain: string | null;
  domain_pattern: string | null;
  auto_action: string | null;
  auto_action_params: Record<string, unknown> | null;
  is_active: boolean | null;
  group_name: string | null;
}

interface AddressReport {
  address: string;
  matched: number;
  applied: number;
  error?: string;
}

/* ── IMAP minimal client (raw TLS) — duplicato per isolamento ── */
class ImapConn {
  private conn!: Deno.TlsConn;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();
  private tag = 0;
  private folders: string[] | null = null;

  async connect(host: string, user: string, pass: string): Promise<void> {
    this.conn = await Deno.connectTls({
      hostname: host,
      port: 993,
      caCerts: getCaCertsForHost(host),
    });
    const greet = new Uint8Array(4096);
    await this.conn.read(greet);
    const r = await this.send(`LOGIN "${user}" "${pass}"`);
    if (!r.includes("OK")) throw new Error("IMAP login failed");
  }

  async send(cmd: string): Promise<string> {
    const tag = `B${++this.tag}`;
    await this.conn.write(this.encoder.encode(`${tag} ${cmd}\r\n`));
    let response = "";
    const buf = new Uint8Array(16384);
    while (true) {
      const n = await this.conn.read(buf);
      if (n === null) break;
      response += this.decoder.decode(buf.subarray(0, n));
      if (
        response.includes(`${tag} OK`) ||
        response.includes(`${tag} NO`) ||
        response.includes(`${tag} BAD`)
      ) break;
    }
    return response;
  }

  async listFolders(): Promise<string[]> {
    if (this.folders) return this.folders;
    const r = await this.send('LIST "" "*"');
    const out: string[] = [];
    for (const line of r.split("\n")) {
      const m = line.match(/\* LIST \([^)]*\) "[^"]*" "?([^"\r\n]+)"?/);
      if (m) out.push(m[1].trim());
    }
    this.folders = out;
    return out;
  }

  async ensureFolder(name: string): Promise<void> {
    const folders = await this.listFolders();
    if (folders.includes(name)) return;
    await this.send(`CREATE "${name}"`);
    this.folders = null;
  }

  async selectInbox(): Promise<void> {
    await this.send("SELECT INBOX");
  }

  /** UID SEARCH FROM "<address>" — torna tutti gli UID che matchano il mittente. */
  async searchByFrom(address: string, cap: number): Promise<number[]> {
    // Escape virgolette per sicurezza minimale del protocollo IMAP.
    const safe = address.replace(/"/g, '\\"');
    const r = await this.send(`UID SEARCH FROM "${safe}"`);
    if (!r.includes("OK")) return [];
    // Risposta tipica:  "* SEARCH 12 34 56\r\nB1 OK SEARCH completed"
    const uids: number[] = [];
    for (const line of r.split("\n")) {
      const m = line.match(/^\*\s+SEARCH\s+(.+?)$/);
      if (m) {
        for (const t of m[1].trim().split(/\s+/)) {
          const n = Number.parseInt(t, 10);
          if (Number.isFinite(n) && n > 0) uids.push(n);
        }
      }
    }
    // Cap protezione mailbox enormi: prendi i più recenti (ordine descrescente).
    uids.sort((a, b) => b - a);
    return uids.slice(0, cap);
  }

  async markSeen(uid: number): Promise<boolean> {
    const r = await this.send(`UID STORE ${uid} +FLAGS (\\Seen)`);
    return r.includes("OK");
  }

  async moveTo(uid: number, target: string): Promise<boolean> {
    const m = await this.send(`UID MOVE ${uid} "${target}"`);
    if (m.includes("OK")) return true;
    const c = await this.send(`UID COPY ${uid} "${target}"`);
    if (!c.includes("OK")) return false;
    await this.send(`UID STORE ${uid} +FLAGS (\\Deleted)`);
    await this.send("EXPUNGE");
    return true;
  }

  async logout(): Promise<void> {
    try { await this.send("LOGOUT"); } catch { /* ignore */ }
    try { this.conn.close(); } catch { /* ignore */ }
  }
}

/** Risolve target_folder per move/archive/spam con default sensati. */
function resolveTargetFolder(action: string, params: Record<string, unknown>): string {
  const explicit = (params.target_folder as string) || "";
  if (explicit) return explicit;
  if (action === "archive") return "Archive";
  if (action === "spam") return "Junk";
  return "";
}

/** Esegue il backfill per un singolo address con regola attiva. */
async function backfillAddress(
  supabase: ReturnType<typeof createClient>,
  imap: ImapConn,
  rule: RuleRow,
  address: string,
  dryRun: boolean,
): Promise<AddressReport> {
  const action = rule.auto_action ?? "";
  if (!action || action === "none") {
    return { address, matched: 0, applied: 0, error: "no auto_action" };
  }

  const params = (rule.auto_action_params ?? {}) as Record<string, unknown>;
  const cap = (params.backfill_cap as number) || DEFAULT_BACKFILL_CAP;

  let uids: number[];
  try {
    uids = await imap.searchByFrom(address, cap);
  } catch (err: unknown) {
    return {
      address,
      matched: 0,
      applied: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (uids.length === 0 || dryRun) {
    return { address, matched: uids.length, applied: 0 };
  }

  // Pre-resolve cartella target se serve
  let target = "";
  if (action === "archive" || action === "spam" || action === "move_to_folder") {
    target = resolveTargetFolder(action, params);
    if (!target) {
      return { address, matched: uids.length, applied: 0, error: "missing target_folder" };
    }
    try { await imap.ensureFolder(target); } catch (e) {
      return {
        address,
        matched: uids.length,
        applied: 0,
        error: `ensureFolder failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  const alsoMarkRead = params.also_mark_read === true;
  let applied = 0;

  for (const uid of uids) {
    try {
      if (action === "mark_read") {
        const ok = await imap.markSeen(uid);
        if (!ok) continue;
      } else if (action === "archive" || action === "spam" || action === "move_to_folder") {
        if (alsoMarkRead) await imap.markSeen(uid); // prima del MOVE
        const ok = await imap.moveTo(uid, target);
        if (!ok) continue;
      } else if (action === "hide") {
        // hide = solo lato DB, niente IMAP
      } else {
        continue; // azione sconosciuta
      }

      applied++;

      // Aggiorna DB se la riga esiste (storici scaricati)
      // deno-lint-ignore no-explicit-any
      const sb = supabase as any;
      if (action === "mark_read") {
        await sb.from("channel_messages")
          .update({ read_at: new Date().toISOString() })
          .eq("imap_uid", uid)
          .eq("from_address", address);
      } else if (action === "archive" || action === "spam" || action === "move_to_folder") {
        await sb.from("channel_messages")
          .update({ folder: target, ...(alsoMarkRead ? { read_at: new Date().toISOString() } : {}) })
          .eq("imap_uid", uid)
          .eq("from_address", address);
      } else if (action === "hide") {
        await sb.from("channel_messages")
          .update({ hidden_by_rule: true })
          .eq("imap_uid", uid)
          .eq("from_address", address);
      }
    } catch (_perUidErr) {
      // continua con i prossimi UID
    }
  }

  return { address, matched: uids.length, applied };
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verifica utente (no service-role-only — backfill manuale richiede UI utente)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "INVALID_TOKEN" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const operatorId: string = body.operator_id;
    const scope: "address" | "group" = body.scope;
    const target: string = (body.target ?? "").toString().trim();
    const dryRun: boolean = body.dry_run === true;

    if (!operatorId || !scope || !target) {
      return new Response(JSON.stringify({ error: "missing operator_id/scope/target" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (scope !== "address" && scope !== "group") {
      return new Response(JSON.stringify({ error: "invalid scope" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Carica regole filtrate per operator + scope
    let q = supabase
      .from("email_address_rules")
      .select("id, operator_id, email_address, address, domain, domain_pattern, auto_action, auto_action_params, is_active, group_name")
      .eq("operator_id", operatorId)
      .eq("is_active", true)
      .not("auto_action", "is", null);

    if (scope === "address") {
      q = q.eq("email_address", target);
    } else {
      q = q.eq("group_name", target);
    }

    const { data: rulesData, error: rulesErr } = await q;
    if (rulesErr) throw rulesErr;

    let rules = (rulesData ?? []) as RuleRow[];
    // Esclude azioni vuote o "none"
    rules = rules.filter((r) => r.auto_action && r.auto_action !== "none");

    // Cap di sicurezza per chiamata
    if (rules.length > MAX_ADDRESSES_PER_CALL) {
      rules = rules.slice(0, MAX_ADDRESSES_PER_CALL);
    }

    if (rules.length === 0) {
      return new Response(JSON.stringify({
        addresses_processed: 0,
        messages_matched: 0,
        messages_applied: 0,
        errors: [],
        truncated: false,
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const host = Deno.env.get("IMAP_HOST") || "";
    const imapUser = Deno.env.get("IMAP_USER") || "";
    const imapPass = Deno.env.get("IMAP_PASSWORD") || "";
    if (!host || !imapUser || !imapPass) {
      return new Response(JSON.stringify({ error: "IMAP credentials not configured" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const reports: AddressReport[] = [];
    let totalMatched = 0;
    let totalApplied = 0;

    // Sequenziale: una connessione IMAP per address (più affidabile su sessioni lunghe)
    for (const rule of rules) {
      const addr = (rule.email_address || rule.address || "").toLowerCase().trim();
      if (!addr) {
        reports.push({ address: "(unknown)", matched: 0, applied: 0, error: "no address" });
        continue;
      }

      const imap = new ImapConn();
      try {
        await imap.connect(host, imapUser, imapPass);
        await imap.selectInbox();
        const report = await backfillAddress(supabase, imap, rule, addr, dryRun);
        reports.push(report);
        totalMatched += report.matched;
        totalApplied += report.applied;

        // Aggiorna stats regola se non dry-run e abbiamo applicato
        if (!dryRun && report.applied > 0) {
          // deno-lint-ignore no-explicit-any
          const sb = supabase as any;
          const { data: cur } = await sb
            .from("email_address_rules")
            .select("applied_count")
            .eq("id", rule.id)
            .maybeSingle();
          const prev = (cur?.applied_count as number) ?? 0;
          await sb.from("email_address_rules").update({
            last_applied_at: new Date().toISOString(),
            applied_count: prev + report.applied,
          }).eq("id", rule.id);
        }
      } catch (connErr: unknown) {
        reports.push({
          address: addr,
          matched: 0,
          applied: 0,
          error: connErr instanceof Error ? connErr.message : String(connErr),
        });
      } finally {
        await imap.logout();
      }
    }

    return new Response(JSON.stringify({
      addresses_processed: reports.length,
      messages_matched: totalMatched,
      messages_applied: totalApplied,
      errors: reports.filter((r) => r.error).map((r) => ({ address: r.address, error: r.error! })),
      reports,
      truncated: (rulesData?.length ?? 0) > MAX_ADDRESSES_PER_CALL,
      dry_run: dryRun,
    }), { headers: { ...cors, "Content-Type": "application/json" } });

  } catch (e: unknown) {
    console.error("[backfill-email-rules] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});