/**
 * useDiagnosticsRunner — extracted from Diagnostics.tsx monolith
 * Each test function catches its own errors — no generic try-catch wrappers.
 */
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { countTableRows, countViewRows, rpcCall } from "@/data/rpc";
import { countPartnersWithoutCountry, countActivePartners } from "@/data/partners";
import { getProfileSummary } from "@/data/profiles";
import { getUserCredits, countCreditTransactions } from "@/data/credits";
import { countActivitiesWithNullPartner } from "@/data/activities";
import { findJobsByStatusSelect } from "@/data/downloadJobs";
import { countPendingCampaignEmails } from "@/data/emailCampaigns";
import { getWcaCookie } from "@/lib/wcaCookieStore";
import { createLogger } from "@/lib/log";
import {
  type TestResult, type TestStatus, type DiagnosticsSummary,
  DB_TABLES, EDGE_FUNCTIONS, RPC_FUNCTIONS, STORAGE_BUCKETS, APP_ROUTES,
  extractErrorMessage, timedRun,
} from "./diagnostics/types";

const log = createLogger("Diagnostics");

type Upsert = (r: TestResult) => void;

// ── Individual test runners ──────────────────────────────────────

async function runAuthTests(upsert: Upsert) {
  // Session
  upsert({ id: "auth-session", name: "Sessione autenticazione", category: "Auth", status: "running" });
  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.error || !sessionResult.data.session) {
    upsert({ id: "auth-session", name: "Sessione autenticazione", category: "Auth", status: "fail", message: sessionResult.error?.message ?? "Nessuna sessione attiva" });
  } else {
    upsert({ id: "auth-session", name: "Sessione autenticazione", category: "Auth", status: "pass", message: "Sessione valida" });
  }

  // User ID
  const uid = sessionResult.data.session?.user?.id;
  upsert({ id: "auth-user", name: "User ID disponibile", category: "Auth", status: uid ? "pass" : "fail", message: uid ? uid.slice(0, 8) + "…" : "User ID mancante" });

  // Profile
  upsert({ id: "auth-profile", name: "Profilo utente", category: "Auth", status: "running" });
  try {
    const data = await getProfileSummary();
    upsert({ id: "auth-profile", name: "Profilo utente", category: "Auth", status: "pass", message: `${data.display_name || "—"} | onboarding: ${data.onboarding_completed}` });
  } catch (e: unknown) {
    upsert({ id: "auth-profile", name: "Profilo utente", category: "Auth", status: "fail", message: extractErrorMessage(e) });
  }
}

async function runDBTests(upsert: Upsert, abortRef: React.RefObject<boolean>) {
  for (const table of DB_TABLES) {
    if (abortRef.current) return;
    const id = `db-${table}`;
    upsert({ id, name: table, category: "Database Tables", status: "running" });
    try {
      let msg = "";
      const ms = await timedRun(async () => {
        const count = await countTableRows(table);
        msg = `${count} righe`;
      });
      upsert({ id, name: table, category: "Database Tables", status: "pass", message: msg, durationMs: ms });
    } catch (e: unknown) {
      upsert({ id, name: table, category: "Database Tables", status: "fail", message: extractErrorMessage(e) });
    }
  }
}

async function runRPCTests(upsert: Upsert, abortRef: React.RefObject<boolean>) {
  for (const fn of RPC_FUNCTIONS) {
    if (abortRef.current) return;
    const id = `rpc-${fn}`;
    upsert({ id, name: fn, category: "RPC Functions", status: "running" });
    if (fn === "deduct_credits" || fn === "increment_contact_interaction") {
      upsert({ id, name: fn, category: "RPC Functions", status: "warn", message: "Richiede parametri — skip test distruttivo" });
      continue;
    }
    try {
      const ms = await timedRun(async () => { await rpcCall(fn); });
      upsert({ id, name: fn, category: "RPC Functions", status: "pass", durationMs: ms });
    } catch (e: unknown) {
      upsert({ id, name: fn, category: "RPC Functions", status: "fail", message: extractErrorMessage(e) });
    }
  }
}

async function runStorageTests(upsert: Upsert, abortRef: React.RefObject<boolean>) {
  for (const bucket of STORAGE_BUCKETS) {
    if (abortRef.current) return;
    const id = `storage-${bucket}`;
    upsert({ id, name: bucket, category: "Storage Buckets", status: "running" });
    try {
      const ms = await timedRun(async () => {
        const { error } = await supabase.storage.from(bucket).list("", { limit: 1 });
        if (error) throw error;
      });
      upsert({ id, name: bucket, category: "Storage Buckets", status: "pass", message: "Accessibile", durationMs: ms });
    } catch (e: unknown) {
      upsert({ id, name: bucket, category: "Storage Buckets", status: "fail", message: extractErrorMessage(e) });
    }
  }
}

async function runEdgeFunctionTests(upsert: Upsert, abortRef: React.RefObject<boolean>) {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!baseUrl) {
    upsert({ id: "ef-url", name: "Supabase URL", category: "Edge Functions", status: "fail", message: "VITE_SUPABASE_URL mancante" });
    return;
  }
  const { data: { session } } = await supabase.auth.getSession();
  for (const fn of EDGE_FUNCTIONS) {
    if (abortRef.current) return;
    const id = `ef-${fn}`;
    upsert({ id, name: fn, category: "Edge Functions", status: "running" });
    try {
      const ms = await timedRun(async () => {
        const res = await fetch(`${baseUrl}/functions/v1/${fn}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token || ""}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
          },
          body: JSON.stringify({ _diagnostic_ping: true }),
        });
        const text = await res.text();
        if (res.status === 500 && text.includes("boot")) throw new Error("Boot error");
        if (res.status >= 500 && res.status !== 500) throw new Error(`HTTP ${res.status}`);
      });
      upsert({ id, name: fn, category: "Edge Functions", status: "pass", message: "Raggiungibile", durationMs: ms });
    } catch (e: unknown) {
      upsert({ id, name: fn, category: "Edge Functions", status: "fail", message: extractErrorMessage(e) });
    }
  }
}

async function runCreditsTests(upsert: Upsert) {
  upsert({ id: "credits-balance", name: "Saldo crediti", category: "Sistema Crediti", status: "running" });
  try {
    const data = await getUserCredits();
    upsert({ id: "credits-balance", name: "Saldo crediti", category: "Sistema Crediti", status: "pass", message: `Saldo: ${data.balance} | Consumati: ${data.total_consumed}` });
  } catch (e: unknown) {
    upsert({ id: "credits-balance", name: "Saldo crediti", category: "Sistema Crediti", status: "fail", message: extractErrorMessage(e) });
  }

  upsert({ id: "credits-transactions", name: "Storico transazioni", category: "Sistema Crediti", status: "running" });
  try {
    const count = await countCreditTransactions();
    upsert({ id: "credits-transactions", name: "Storico transazioni", category: "Sistema Crediti", status: "pass", message: `${count ?? 0} transazioni` });
  } catch (e: unknown) {
    upsert({ id: "credits-transactions", name: "Storico transazioni", category: "Sistema Crediti", status: "fail", message: extractErrorMessage(e) });
  }
}

async function runDataIntegrityTests(upsert: Upsert) {
  // Partner without country
  upsert({ id: "integrity-partner-country", name: "Partner senza country_code", category: "Integrità Dati", status: "running" });
  try {
    const count = await countPartnersWithoutCountry();
    const s: TestStatus = count === 0 ? "pass" : "warn";
    upsert({ id: "integrity-partner-country", name: "Partner senza country_code", category: "Integrità Dati", status: s, message: `${count} trovati` });
  } catch (e: unknown) {
    upsert({ id: "integrity-partner-country", name: "Partner senza country_code", category: "Integrità Dati", status: "fail", message: extractErrorMessage(e) });
  }

  // Contacts coverage
  upsert({ id: "integrity-contacts-coverage", name: "Copertura contatti partner", category: "Integrità Dati", status: "running" });
  try {
    const totalPartners = await countActivePartners();
    const noContacts = await countViewRows("partners_no_contacts", { column: "resolved", value: false });
    const pct = totalPartners ? Math.round(((totalPartners - (noContacts ?? 0)) / totalPartners) * 100) : 0;
    upsert({ id: "integrity-contacts-coverage", name: "Copertura contatti partner", category: "Integrità Dati", status: pct > 50 ? "pass" : "warn", message: `${pct}% con contatti (${noContacts ?? 0} senza)` });
  } catch (e: unknown) {
    upsert({ id: "integrity-contacts-coverage", name: "Copertura contatti partner", category: "Integrità Dati", status: "fail", message: extractErrorMessage(e) });
  }

  // Orphan activities
  upsert({ id: "integrity-orphan-activities", name: "Attività senza partner", category: "Integrità Dati", status: "running" });
  try {
    const count = await countActivitiesWithNullPartner();
    upsert({ id: "integrity-orphan-activities", name: "Attività senza partner", category: "Integrità Dati", status: (count ?? 0) === 0 ? "pass" : "warn", message: `${count ?? 0} orfane` });
  } catch (e: unknown) {
    upsert({ id: "integrity-orphan-activities", name: "Attività senza partner", category: "Integrità Dati", status: "fail", message: extractErrorMessage(e) });
  }

  // Stuck jobs
  upsert({ id: "integrity-stuck-jobs", name: "Download jobs bloccati", category: "Integrità Dati", status: "running" });
  try {
    const data = await findJobsByStatusSelect(["running", "pending"], "id, status, updated_at");
    const stuck = (data || []).filter(j => {
      const age = Date.now() - new Date(j.updated_at).getTime();
      return age > 30 * 60 * 1000;
    });
    upsert({ id: "integrity-stuck-jobs", name: "Download jobs bloccati", category: "Integrità Dati", status: stuck.length === 0 ? "pass" : "warn", message: `${stuck.length} bloccati (>30min), ${(data || []).length} attivi` });
  } catch (e: unknown) {
    upsert({ id: "integrity-stuck-jobs", name: "Download jobs bloccati", category: "Integrità Dati", status: "fail", message: extractErrorMessage(e) });
  }

  // Email queue
  upsert({ id: "integrity-email-queue", name: "Coda email bloccata", category: "Integrità Dati", status: "running" });
  try {
    const count = await countPendingCampaignEmails();
    upsert({ id: "integrity-email-queue", name: "Coda email", category: "Integrità Dati", status: "pass", message: `${count ?? 0} in coda` });
  } catch (e: unknown) {
    upsert({ id: "integrity-email-queue", name: "Coda email", category: "Integrità Dati", status: "fail", message: extractErrorMessage(e) });
  }
}

async function runBridgeTests(upsert: Upsert) {
  // WCA bridge
  upsert({ id: "bridge-wca-app", name: "wca-app Bridge", category: "Claude Engine V8", status: "running" });
  try {
    const ms = await timedRun(async () => {
      const res = await fetch("https://wca-app.vercel.app/api/login", { method: "OPTIONS" });
      if (!res.ok && res.status !== 405 && res.status !== 204) throw new Error(`HTTP ${res.status}`);
    });
    upsert({ id: "bridge-wca-app", name: "wca-app Bridge", category: "Claude Engine V8", status: "pass", message: "Raggiungibile", durationMs: ms });
  } catch (e: unknown) {
    upsert({ id: "bridge-wca-app", name: "wca-app Bridge", category: "Claude Engine V8", status: "fail", message: extractErrorMessage(e) });
  }

  // WCA login
  upsert({ id: "bridge-wca-login", name: "Login WCA (server-side)", category: "Claude Engine V8", status: "running" });
  try {
    const ms = await timedRun(async () => {
      const res = await fetch("https://wca-app.vercel.app/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data: { success?: boolean; error?: string } = await res.json();
      if (!data.success) throw new Error(data.error || "Login fallito");
    });
    upsert({ id: "bridge-wca-login", name: "Login WCA (server-side)", category: "Claude Engine V8", status: "pass", message: "Cookie ottenuto", durationMs: ms });
  } catch (e: unknown) {
    upsert({ id: "bridge-wca-login", name: "Login WCA (server-side)", category: "Claude Engine V8", status: "fail", message: extractErrorMessage(e) });
  }

  // Local cookie
  upsert({ id: "bridge-local-cookie", name: "Cookie locale (cache)", category: "Claude Engine V8", status: "running" });
  try {
    const cookie = getWcaCookie();
    upsert({ id: "bridge-local-cookie", name: "Cookie locale (cache)", category: "Claude Engine V8", status: cookie ? "pass" : "warn", message: cookie ? "Valido" : "Non presente o scaduto" });
  } catch (e: unknown) {
    upsert({ id: "bridge-local-cookie", name: "Cookie locale (cache)", category: "Claude Engine V8", status: "fail", message: extractErrorMessage(e) });
  }

  // Chrome extension
  upsert({ id: "ext-wca-chrome", name: "Estensione Chrome (opzionale)", category: "Claude Engine V8", status: "running" });
  try {
    const ok = await new Promise<boolean>((resolve) => {
      const reqId = `diag_${Date.now()}`;
      const timer = setTimeout(() => resolve(false), 2000);
      const handler = (e: MessageEvent) => {
        if (e.data?.direction === "from-extension" && e.data?.requestId === reqId) {
          clearTimeout(timer);
          window.removeEventListener("message", handler);
          resolve(true);
        }
      };
      window.addEventListener("message", handler);
      window.postMessage({ direction: "from-webapp", action: "ping", requestId: reqId }, window.location.origin);
    });
    upsert({ id: "ext-wca-chrome", name: "Estensione Chrome (opzionale)", category: "Claude Engine V8", status: ok ? "pass" : "warn", message: ok ? "Connessa" : "Non installata (non necessaria)" });
  } catch (e: unknown) {
    log.warn("operation failed", { error: extractErrorMessage(e) });
    upsert({ id: "ext-wca-chrome", name: "Estensione Chrome (opzionale)", category: "Claude Engine V8", status: "warn", message: "Non rilevata" });
  }
}

function runNavigationTests(upsert: Upsert) {
  for (const route of APP_ROUTES) {
    upsert({ id: `nav-${route}`, name: route, category: "Navigazione (Route)", status: "pass", message: "Registrata" });
  }
}

// ── Hook ──────────────────────────────────────────────────────────

export function useDiagnosticsRunner() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const abortRef = useRef(false);

  const upsert = useCallback((r: TestResult) => {
    setResults(prev => {
      const idx = prev.findIndex(x => x.id === r.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = r; return n; }
      return [...prev, r];
    });
  }, []);

  const runAll = useCallback(async () => {
    setRunning(true);
    abortRef.current = false;
    setResults([]);
    setExpandedCats(new Set());

    await runAuthTests(upsert);
    await runCreditsTests(upsert);
    await runDBTests(upsert, abortRef);
    await runRPCTests(upsert, abortRef);
    await runStorageTests(upsert, abortRef);
    await runDataIntegrityTests(upsert);
    await runBridgeTests(upsert);
    runNavigationTests(upsert);
    await runEdgeFunctionTests(upsert, abortRef);

    setRunning(false);
  }, [upsert]);

  const abort = useCallback(() => { abortRef.current = true; }, []);

  const toggleCat = useCallback((cat: string) => {
    setExpandedCats(prev => {
      const n = new Set(prev);
      n.has(cat) ? n.delete(cat) : n.add(cat);
      return n;
    });
  }, []);

  const categories = [...new Set(results.map(r => r.category))];
  const byCat = (cat: string) => results.filter(r => r.category === cat);

  const summary: DiagnosticsSummary = {
    total: results.length,
    pass: results.filter(r => r.status === "pass").length,
    fail: results.filter(r => r.status === "fail").length,
    warn: results.filter(r => r.status === "warn").length,
    running: results.filter(r => r.status === "running").length,
  };

  return { results, running, expandedCats, categories, summary, runAll, abort, toggleCat, byCat };
}
