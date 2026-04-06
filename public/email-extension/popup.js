/**
 * popup.js — Onboarding + Dashboard UI logic
 * ────────────────────────────────────────────
 */

/* ── DOM refs ─────────────────────────────────────────────────── */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const screens = { onboarding: $("#onboarding"), dashboard: $("#dashboard") };
const steps = $$(".step");
const dots = $$(".step-dot");

/* ── State ────────────────────────────────────────────────────── */
let currentStep = 0;
let discoveredServer = null;

/* ── Init ─────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
  const response = await send("getConfig");
  if (response?.config?.email) {
    showDashboard();
  } else {
    showOnboarding();
  }
  bindEvents();
});

/* ── Navigation ───────────────────────────────────────────────── */
function showOnboarding() {
  screens.onboarding.classList.remove("hidden");
  screens.dashboard.classList.add("hidden");
  goToStep(0);
}

function showDashboard() {
  screens.onboarding.classList.add("hidden");
  screens.dashboard.classList.remove("hidden");
  refreshDashboard();
}

function goToStep(n) {
  currentStep = n;
  steps.forEach((s, i) => s.classList.toggle("active", i === n));
  dots.forEach((d, i) => {
    d.classList.toggle("active", i === n);
    d.classList.toggle("done", i < n);
  });
}

/* ── Event bindings ───────────────────────────────────────────── */
function bindEvents() {
  // Step 0 → 1
  $("#btn-start")?.addEventListener("click", () => goToStep(1));

  // Step 1: Discover
  $("#btn-discover")?.addEventListener("click", handleDiscover);

  // Step 2: Test connection
  $("#btn-test")?.addEventListener("click", handleTest);

  // Step 3: Storage options
  $$(".storage-option").forEach(opt => {
    opt.addEventListener("click", () => {
      $$(".storage-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      opt.querySelector("input").checked = true;
    });
  });

  // Step 3: Finish
  $("#btn-finish")?.addEventListener("click", handleFinish);

  // Dashboard: Sync
  $("#btn-sync")?.addEventListener("click", handleSync);

  // Dashboard: Settings → back to onboarding
  $("#btn-settings")?.addEventListener("click", () => showOnboarding());

  // Dashboard: Reset
  $("#btn-reset")?.addEventListener("click", async () => {
    if (confirm("Sei sicuro? Tutti i dati di configurazione verranno cancellati.")) {
      await send("resetState");
      showOnboarding();
    }
  });
}

/* ── Step 1: Auto-discover ────────────────────────────────────── */
async function handleDiscover() {
  const email = $("#input-email").value.trim();
  const password = $("#input-password").value;

  if (!email || !password) {
    showStatus("discover-status", "Inserisci email e password", "error");
    return;
  }

  const btn = $("#btn-discover");
  btn.disabled = true;
  btn.textContent = "Ricerca in corso...";
  hideStatus("discover-status");

  try {
    const res = await send("discover", { email });
    if (res?.success && res.server) {
      discoveredServer = res.server;
      // Fill step 2
      $("#input-host").value = res.server.host;
      $("#input-port").value = res.server.port;
      $("#input-tls").value = String(res.server.tls !== false);
      $("#server-label").textContent = res.server.label || res.server.host;
      $("#discover-method").textContent = `Metodo: ${res.server.method}`;
      goToStep(2);
    } else {
      showStatus("discover-status", res?.error || "Server non trovato. Prova a inserire manualmente.", "warning");
      // Still allow to proceed with manual input
      goToStep(2);
    }
  } catch (err) {
    showStatus("discover-status", err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Trova server automaticamente";
  }
}

/* ── Step 2: Test connection ──────────────────────────────────── */
async function handleTest() {
  const btn = $("#btn-test");
  btn.disabled = true;
  btn.textContent = "Test in corso...";
  hideStatus("test-status");

  const email = $("#input-email").value.trim();
  const password = $("#input-password").value;
  const host = $("#input-host").value.trim();
  const port = parseInt($("#input-port").value) || 993;
  const tls = $("#input-tls").value === "true";

  // Save temporary config for test
  await send("saveConfig", {
    config: {
      email, password, imapHost: host, imapPort: port, imapTls: tls,
      proxyUrl: getProxyUrl(),
    },
  });

  try {
    const res = await send("testConnection");
    if (res?.success) {
      showStatus("test-status", `✅ Connessione riuscita! Cartelle: ${res.folders || "—"}, Email: ${res.totalMessages || "—"}`, "success");
      // Auto-advance after 1.5s
      setTimeout(() => goToStep(3), 1500);
    } else {
      showStatus("test-status", `❌ ${res?.error || "Connessione fallita"}`, "error");
    }
  } catch (err) {
    showStatus("test-status", err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Testa connessione";
  }
}

/* ── Step 3: Finish ───────────────────────────────────────────── */
async function handleFinish() {
  const btn = $("#btn-finish");
  btn.disabled = true;
  btn.textContent = "Salvataggio...";

  const storageMode = document.querySelector('input[name="storage"]:checked')?.value || "local";
  const syncInterval = parseInt($("#input-sync-interval").value) || 0;
  const notifications = $("#input-notifications").checked;

  const email = $("#input-email").value.trim();
  const password = $("#input-password").value;
  const host = $("#input-host").value.trim();
  const port = parseInt($("#input-port").value) || 993;
  const tls = $("#input-tls").value === "true";

  await send("saveConfig", {
    config: {
      email, password,
      imapHost: host, imapPort: port, imapTls: tls,
      storageMode,
      syncInterval: syncInterval || null,
      notificationsEnabled: notifications,
      proxyUrl: getProxyUrl(),
      configuredAt: new Date().toISOString(),
    },
  });

  showDashboard();

  btn.disabled = false;
  btn.textContent = "Completa e sincronizza";

  // Auto-sync on first setup
  handleSync();
}

/* ── Dashboard: Sync ──────────────────────────────────────────── */
async function handleSync() {
  const btn = $("#btn-sync");
  const label = $("#sync-label");
  btn.disabled = true;
  label.textContent = "⏳ Sincronizzazione...";

  const progress = $("#sync-progress");
  progress.classList.remove("hidden");
  $("#progress-fill").style.width = "30%";
  $("#progress-text").textContent = "Connessione al server...";
  hideStatus("sync-result");

  try {
    const res = await send("syncNow");
    $("#progress-fill").style.width = "100%";

    if (res?.success) {
      const msg = res.downloaded > 0
        ? `✅ Scaricate ${res.downloaded} email${res.errors ? ` (${res.errors} errori)` : ""}`
        : "✅ Nessuna nuova email";
      showStatus("sync-result", msg, "success");
      $("#progress-text").textContent = "Completato!";
    } else {
      showStatus("sync-result", `❌ ${res?.error || "Sincronizzazione fallita"}`, "error");
      $("#progress-text").textContent = "Errore";
    }
  } catch (err) {
    showStatus("sync-result", err.message, "error");
  } finally {
    btn.disabled = false;
    label.textContent = "🔄 Sincronizza ora";
    setTimeout(() => progress.classList.add("hidden"), 3000);
    refreshDashboard();
  }
}

/* ── Dashboard: Refresh ───────────────────────────────────────── */
async function refreshDashboard() {
  const res = await send("getStatus");
  if (!res?.success) return;

  const { config, syncState, stats } = res;

  $("#dash-email").textContent = config?.email || "—";
  $("#dash-server").textContent = `${config?.imapHost || "—"}:${config?.imapPort || "—"}`;
  $("#stat-total").textContent = formatNum(stats?.totalEmails || 0);
  $("#stat-syncs").textContent = formatNum(stats?.syncCount || 0);
  $("#stat-mode").textContent = config?.storageMode === "cloud" ? "☁️ Cloud" : "💾 Locale";
  
  if (syncState?.lastSyncAt) {
    const d = new Date(syncState.lastSyncAt);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60000) $("#stat-last").textContent = "Ora";
    else if (diff < 3600000) $("#stat-last").textContent = `${Math.floor(diff / 60000)}m fa`;
    else if (diff < 86400000) $("#stat-last").textContent = `${Math.floor(diff / 3600000)}h fa`;
    else $("#stat-last").textContent = d.toLocaleDateString("it-IT");
  } else {
    $("#stat-last").textContent = "Mai";
  }
}

/* ── Helpers ──────────────────────────────────────────────────── */

function send(action, data = {}) {
  return chrome.runtime.sendMessage({ action, ...data });
}

function showStatus(id, text, type) {
  const el = $(`#${id}`);
  el.textContent = text;
  el.className = `status-box ${type}`;
  el.classList.remove("hidden");
}

function hideStatus(id) {
  $(`#${id}`)?.classList.add("hidden");
}

function formatNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

function getProxyUrl() {
  // Read from storage or use default
  // The proxy URL will be set during extension configuration
  // For now, return a placeholder that will be configured
  return "https://zrbditqddhjkutzjycgi.supabase.co/functions/v1/email-imap-proxy";
}
