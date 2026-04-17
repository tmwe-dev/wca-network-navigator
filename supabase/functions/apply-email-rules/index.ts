/**
 * apply-email-rules — Esegue le regole email_address_rules sui messaggi appena scaricati.
 *
 * Strategia: UNA sola connessione IMAP TLS, login, comandi in serie, logout.
 * Chiamato da check-inbox dopo l'inserimento batch dei nuovi messaggi.
 *
 * Input: { operator_id: uuid, message_ids: uuid[] }
 * Output: { processed, applied, errors[] }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getCaCertsForHost } from "../check-inbox/caCerts.ts";

interface RuleRow {
  id: string;
  operator_id: string | null;
  email_address: string | null;
  address: string | null;
  domain: string | null;
  domain_pattern: string | null;
  auto_action: string | null;
  auto_action_params: Record<string, unknown> | null;
  auto_execute: boolean | null;
  is_active: boolean | null;
  priority: number | null;
}

interface MsgRow {
  id: string;
  from_address: string | null;
  imap_uid: number | null;
  folder: string | null;
  user_id: string;
  operator_id: string | null;
}

/* ── Minimal IMAP client (raw TLS) per esecuzione sequenziale ── */
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
    // Greeting
    const buf = new Uint8Array(4096);
    await this.conn.read(buf);
    // Login
    const r = await this.send(`LOGIN "${user}" "${pass}"`);
    if (!r.includes("OK")) throw new Error("IMAP login failed");
  }

  async send(cmd: string): Promise<string> {
    const tag = `A${++this.tag}`;
    await this.conn.write(this.encoder.encode(`${tag} ${cmd}\r\n`));
    let response = "";
    const buf = new Uint8Array(8192);
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
    this.folders = null; // invalidate cache
  }

  async selectInbox(): Promise<void> {
    await this.send("SELECT INBOX");
  }

  async markSeen(uid: number): Promise<boolean> {
    const r = await this.send(`UID STORE ${uid} +FLAGS (\\Seen)`);
    return r.includes("OK");
  }

  async moveTo(uid: number, target: string): Promise<boolean> {
    // Try MOVE first (RFC 6851), fallback COPY+DELETE+EXPUNGE
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

function findMatchingRule(rules: RuleRow[], fromAddr: string): RuleRow | null {
  if (!fromAddr) return null;
  const lower = fromAddr.toLowerCase();
  const domain = lower.includes("@") ? lower.split("@")[1] : "";

  // Sort by priority DESC (nulls last)
  const sorted = [...rules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  // Pass 1: exact address match
  for (const r of sorted) {
    const addr = (r.address || r.email_address || "").toLowerCase();
    if (addr && addr === lower) return r;
  }
  // Pass 2: domain match
  for (const r of sorted) {
    const dom = (r.domain_pattern || r.domain || "").toLowerCase();
    if (dom && domain && (domain === dom || domain.endsWith("." + dom))) return r;
  }
  return null;
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

    // Service-role call from check-inbox (Bearer = service key) o normale chiamata utente
    const isServiceCall = authHeader === `Bearer ${serviceKey}`;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (!isServiceCall) {
      // Verifica utente per chiamate dall'UI
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "INVALID_TOKEN" }), {
          status: 401, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const operatorId: string = body.operator_id;
    const messageIds: string[] = Array.isArray(body.message_ids) ? body.message_ids : [];

    if (!operatorId || messageIds.length === 0) {
      return new Response(JSON.stringify({ processed: 0, applied: 0, errors: [] }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Carica messaggi
    const { data: msgs, error: msgErr } = await supabase
      .from("channel_messages")
      .select("id, from_address, imap_uid, folder, user_id, operator_id")
      .in("id", messageIds)
      .eq("channel", "email")
      .eq("direction", "inbound");
    if (msgErr) throw msgErr;
    const messages = (msgs ?? []) as MsgRow[];
    if (messages.length === 0) {
      return new Response(JSON.stringify({ processed: 0, applied: 0, errors: [] }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Carica regole attive per operator
    const { data: rulesData, error: rulesErr } = await supabase
      .from("email_address_rules")
      .select("id, operator_id, email_address, address, domain, domain_pattern, auto_action, auto_action_params, auto_execute, is_active, priority")
      .eq("operator_id", operatorId)
      .eq("is_active", true)
      .eq("auto_execute", true);
    if (rulesErr) throw rulesErr;
    const rules = (rulesData ?? []) as RuleRow[];
    if (rules.length === 0) {
      return new Response(JSON.stringify({ processed: messages.length, applied: 0, errors: [] }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Pre-match: associa ogni messaggio a una regola (se esiste)
    type Plan = { msg: MsgRow; rule: RuleRow };
    const plan: Plan[] = [];
    for (const m of messages) {
      const r = findMatchingRule(rules, m.from_address || "");
      if (r && r.auto_action && r.auto_action !== "none") {
        plan.push({ msg: m, rule: r });
      }
    }

    if (plan.length === 0) {
      return new Response(JSON.stringify({ processed: messages.length, applied: 0, errors: [] }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Determina se serve IMAP (mark_read / archive / move_to_folder sì; hide no)
    const needsImap = plan.some(p =>
      ["mark_read", "archive", "move_to_folder", "spam"].includes(p.rule.auto_action ?? "")
    );

    let imap: ImapConn | null = null;
    const errors: Array<{ message_id: string; error: string }> = [];
    let applied = 0;
    const ruleApplications: Record<string, number> = {};

    try {
      if (needsImap) {
        const host = Deno.env.get("IMAP_HOST") || "";
        const user = Deno.env.get("IMAP_USER") || "";
        const pass = Deno.env.get("IMAP_PASSWORD") || "";
        if (!host || !user || !pass) throw new Error("IMAP credentials not configured");
        imap = new ImapConn();
        await imap.connect(host, user, pass);
        await imap.selectInbox();
      }

      for (const { msg, rule } of plan) {
        try {
          const action = rule.auto_action!;
          const params = (rule.auto_action_params ?? {}) as Record<string, unknown>;

          if (action === "mark_read") {
            if (msg.imap_uid && imap) {
              const ok = await imap.markSeen(msg.imap_uid);
              if (!ok) errors.push({ message_id: msg.id, error: "IMAP STORE failed" });
            }
            await supabase.from("channel_messages")
              .update({ read_at: new Date().toISOString() })
              .eq("id", msg.id);

          } else if (action === "hide") {
            await supabase.from("channel_messages")
              .update({ hidden_by_rule: true })
              .eq("id", msg.id);

          } else if (action === "archive" || action === "spam" || action === "move_to_folder") {
            const target = (params.target_folder as string)
              || (action === "archive" ? "Archive" : action === "spam" ? "Junk" : "");
            if (!target) {
              errors.push({ message_id: msg.id, error: "missing target_folder" });
              continue;
            }
            if (msg.imap_uid && imap) {
              await imap.ensureFolder(target);
              const ok = await imap.moveTo(msg.imap_uid, target);
              if (!ok) {
                errors.push({ message_id: msg.id, error: "IMAP MOVE failed" });
                continue;
              }
            }
            await supabase.from("channel_messages")
              .update({ folder: target })
              .eq("id", msg.id);
          } else {
            // azione sconosciuta — skip silenzioso
            continue;
          }

          applied++;
          ruleApplications[rule.id] = (ruleApplications[rule.id] ?? 0) + 1;
        } catch (perMsgErr: unknown) {
          errors.push({
            message_id: msg.id,
            error: perMsgErr instanceof Error ? perMsgErr.message : String(perMsgErr),
          });
        }
      }
    } finally {
      if (imap) await imap.logout();
    }

    // Aggiorna stats regole (best-effort)
    for (const [ruleId, count] of Object.entries(ruleApplications)) {
      const { data: cur } = await supabase
        .from("email_address_rules")
        .select("applied_count")
        .eq("id", ruleId)
        .maybeSingle();
      const prev = (cur?.applied_count as number) ?? 0;
      await supabase.from("email_address_rules").update({
        last_applied_at: new Date().toISOString(),
        applied_count: prev + count,
      }).eq("id", ruleId);
    }

    return new Response(JSON.stringify({
      processed: messages.length,
      applied,
      errors,
    }), { headers: { ...cors, "Content-Type": "application/json" } });

  } catch (e: unknown) {
    console.error("[apply-email-rules] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
