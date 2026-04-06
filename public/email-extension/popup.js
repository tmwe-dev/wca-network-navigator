/**
 * popup.js — Unified Communication Hub: Onboarding + Dashboard
 * ─────────────────────────────────────────────────────────────
 */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const screens = { onboarding: $("#onboarding"), dashboard: $("#dashboard") };
const steps = $$(".step");
const dots = $$(".step-dot");

let currentStep = 0;
let activeChannel = "email";

// Temporary onboarding state
const onboardingState = {
  email: null,
  whatsapp: null,
  linkedin: null,
  ai: null,
};

/* ── Init ─────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
  const res = await send("getConfig");
  if (res?.config?.configuredAt) {
    showDashboard();
  } else {
    showOnboarding();
  }
  bindEvents();
});

/* ── Navigation ───────────────────────────────────────────── */
function showOnboarding() {
  screens.onboarding.classList.remove("hidden");
  screens.dashboard.classList.add("hidden");
  goToStep(0);
}

function showDashboard() {
  screens.onboarding.classList.add("hidden");
  screens.dashboard.classList.remove("hidden");
  switchChannel("email");
  refreshDashboard();
}

function goToStep(n) {
  currentStep = n;
  // Handle sub-step 1b
  const allSteps = ["step-0", "step-1", "step-1b", "step-2", "step-3", "step-4", "step-5"];
  allSteps.forEach(id => {
    const el = $(`#${id}`);
    if (el) el.classList.remove("active");
  });
  
  const stepMap = { 0: "step-0", 1: "step-1", "1b": "step-1b", 2: "step-2", 3: "step-3", 4: "step-4", 5: "step-5" };
  const targetId = stepMap[n];
  if (targetId) $(`#${targetId}`)?.classList.add("active");

  // Update dots (map sub-steps)
  const dotIndex = typeof n === "number" ? n : 1;
  dots.forEach((d, i) => {
    d.classList.toggle("active", i === dotIndex);
    d.classList.toggle("done", i < dotIndex);
  });
}

/* ── Events ───────────────────────────────────────────────── */
function bindEvents() {
  // Step 0
  $("#btn-start")?.addEventListener("click", () => goToStep(1));

  // ── EMAIL ──
  $("#btn-email-discover")?.addEventListener("click", handleEmailDiscover);
  $("#btn-email-manual")?.addEventListener("click", () => {
    const email = $("#email-addr").value.trim();
    if (!email) { showStatus("email-discover-status", "Inserisci l'email", "warning"); return; }
    $("#email-host").value = "";
    $("#email-port").value = "993";
    $("#email-tls").value = "true";
    $("#email-server-label").textContent = "Configurazione manuale";
    $("#email-discover-method").textContent = "";
    goToStep("1b");
  });
  $("#skip-email")?.addEventListener("click", () => goToStep(2));
  
  $("#btn-email-test")?.addEventListener("click", async () => {
    const host = $("#email-host").value.trim();
    if (!host) { showStatus("email-test-status", "Inserisci l'host", "warning"); return; }
    onboardingState.email = {
      email: $("#email-addr").value.trim(),
      password: $("#email-pw").value,
      imapHost: host,
      imapPort: parseInt($("#email-port").value) || 993,
      imapTls: $("#email-tls").value === "true",
    };
    showStatus("email-test-status", "✅ Configurazione email salvata", "success");
    setTimeout(() => goToStep(2), 800);
  });
  $("#btn-email-skip-test")?.addEventListener("click", () => {
    const host = $("#email-host").value.trim();
    if (host) {
      onboardingState.email = {
        email: $("#email-addr").value.trim(),
        password: $("#email-pw").value,
        imapHost: host,
        imapPort: parseInt($("#email-port").value) || 993,
        imapTls: $("#email-tls").value === "true",
      };
    }
    goToStep(2);
  });

  // ── WHATSAPP ──
  $("#btn-wa-save")?.addEventListener("click", () => {
    onboardingState.whatsapp = {
      phone: $("#wa-phone").value.trim(),
      notifications: $("#wa-notifications").checked,
    };
    goToStep(3);
  });
  $("#skip-wa")?.addEventListener("click", () => goToStep(3));

  // ── LINKEDIN ──
  $("#btn-li-save")?.addEventListener("click", () => {
    onboardingState.linkedin = {
      profileUrl: $("#li-profile").value.trim(),
      notifications: $("#li-notifications").checked,
    };
    goToStep(4);
  });
  $("#skip-li")?.addEventListener("click", () => goToStep(4));

  // ── AI ──
  $("#btn-ai-save")?.addEventListener("click", () => {
    onboardingState.ai = {
      openaiKey: $("#openai-key").value.trim(),
      anthropicKey: $("#anthropic-key").value.trim(),
      defaultModel: $("#ai-default-model").value,
    };
    goToStep(5);
    renderSummary();
  });
  $("#skip-ai")?.addEventListener("click", () => { goToStep(5); renderSummary(); });

  // Eye toggles
  $("#eye-email")?.addEventListener("click", () => togglePw("email-pw", "eye-email"));
  $$(".btn-eye[data-target]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.target;
      const inp = $(`#${id}`);
      const show = inp.type === "password";
      inp.type = show ? "text" : "password";
      btn.textContent = show ? "🙈" : "👁️";
    });
  });

  // Storage options
  $$(".storage-option").forEach(opt => {
    opt.addEventListener("click", () => {
      $$(".storage-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      opt.querySelector("input").checked = true;
    });
  });

  // ── FINISH ──
  $("#btn-finish")?.addEventListener("click", handleFinish);

  // ── DASHBOARD ──
  $$(".channel-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      if (tab.classList.contains("disabled")) return;
      switchChannel(tab.dataset.channel);
    });
  });
  $("#btn-sync")?.addEventListener("click", handleSync);
  $("#btn-open-panel")?.addEventListener("click", () => send("openSidePanel"));
  $("#btn-view-all")?.addEventListener("click", () => send("openSidePanel"));
  $("#btn-settings")?.addEventListener("click", () => showOnboarding());
  $("#btn-reset")?.addEventListener("click", async () => {
    if (confirm("Sei sicuro? Tutti i dati verranno cancellati.")) {
      await send("resetState");
      showOnboarding();
    }
  });
}

/* ── Email discover ───────────────────────────────────────── */
async function handleEmailDiscover() {
  const email = $("#email-addr").value.trim();
  const password = $("#email-pw").value;
  if (!email || !password) { showStatus("email-discover-status", "Inserisci email e password", "error"); return; }

  const btn = $("#btn-email-discover");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  hideStatus("email-discover-status");

  try {
    const res = await send("discover", { email });
    if (res?.success && res.server) {
      $("#email-host").value = res.server.host;
      $("#email-port").value = res.server.port;
      $("#email-tls").value = String(res.server.tls !== false);
      $("#email-server-label").textContent = res.server.label || res.server.host;
      $("#email-discover-method").textContent = `Trovato con: ${friendlyMethod(res.server.method)}`;
      goToStep("1b");
    } else {
      showStatus("email-discover-status", "⚠️ Server non trovato. Inseriscilo manualmente.", "warning");
    }
  } catch (err) {
    showStatus("email-discover-status", err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🔍 Trova server automaticamente';
  }
}

function friendlyMethod(m) {
  const map = { "well-known": "Database provider noti", "autoconfig": "Mozilla Autoconfig", "mx-heuristic": "Analisi record MX", "guess": "Deduzione automatica" };
  return map[m] || m;
}

/* ── Summary ──────────────────────────────────────────────── */
function renderSummary() {
  const el = $("#config-summary");
  const rows = [
    { icon: "📧", label: "Email", on: !!onboardingState.email },
    { icon: "💬", label: "WhatsApp", on: !!onboardingState.whatsapp },
    { icon: "💼", label: "LinkedIn", on: !!onboardingState.linkedin },
    { icon: "🤖", label: "AI Agent", on: !!(onboardingState.ai?.openaiKey || onboardingState.ai?.anthropicKey) },
  ];
  el.innerHTML = rows.map(r => `
    <div class="summary-row">
      <span class="summary-icon">${r.icon}</span>
      <span class="summary-label">${r.label}</span>
      <span class="summary-status ${r.on ? "on" : "off"}">${r.on ? "✅ Configurato" : "⏭ Saltato"}</span>
    </div>
  `).join("");
}

/* ── Finish ───────────────────────────────────────────────── */
async function handleFinish() {
  const btn = $("#btn-finish");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Salvataggio...';

  const storageMode = document.querySelector('input[name="storage"]:checked')?.value || "local";
  const syncInterval = parseInt($("#input-sync-interval").value) || 0;

  const config = {
    ...onboardingState.email,
    whatsapp: onboardingState.whatsapp,
    linkedin: onboardingState.linkedin,
    ai: onboardingState.ai,
    storageMode,
    syncInterval: syncInterval || null,
    proxyUrl: getProxyUrl(),
    configuredAt: new Date().toISOString(),
  };

  await send("saveConfig", { config });
  showDashboard();
  btn.disabled = false;
  btn.innerHTML = "🚀 Completa e avvia";
}

/* ── Dashboard channel switch ─────────────────────────────── */
async function switchChannel(channel) {
  activeChannel = channel;
  $$(".channel-tab").forEach(t => t.classList.toggle("active", t.dataset.channel === channel));

  const avatarMap = { email: "📧", whatsapp: "💬", linkedin: "💼" };
  const nameMap = { email: "Email", whatsapp: "WhatsApp", linkedin: "LinkedIn" };
  $("#dash-avatar").textContent = avatarMap[channel];
  $("#dash-channel-name").textContent = nameMap[channel];

  const res = await send("getConfig");
  const cfg = res?.config;

  if (channel === "email") {
    $("#dash-channel-info").textContent = cfg?.email ? `${cfg.imapHost}:${cfg.imapPort}` : "Non configurato";
    $("#channel-status").classList.add("hidden");
    $("#btn-sync").classList.remove("hidden");
    loadInboxPreview();
  } else {
    const chCfg = cfg?.[channel];
    const connected = !!chCfg;
    $("#dash-channel-info").textContent = connected
      ? (channel === "whatsapp" ? chCfg.phone || "Connesso" : chCfg.profileUrl || "Connesso")
      : "Non configurato";
    
    const status = $("#channel-status");
    status.classList.remove("hidden");
    const indicator = $("#status-indicator");
    const text = $("#status-text");
    if (connected) {
      indicator.className = "status-indicator connected";
      text.textContent = "Sessione configurata — apri il sito per attivare";
    } else {
      indicator.className = "status-indicator disconnected";
      text.textContent = "Non configurato — vai nelle impostazioni";
    }
    
    $("#inbox-preview").classList.add("hidden");
    $("#btn-sync").classList.toggle("hidden", !connected);
  }

  // AI card
  const aiCard = $("#ai-card");
  if (cfg?.ai?.openaiKey || cfg?.ai?.anthropicKey) {
    aiCard.classList.remove("hidden");
    $("#ai-model-label").textContent = cfg.ai.defaultModel || "—";
    const providers = [];
    if (cfg.ai.openaiKey) providers.push("OpenAI");
    if (cfg.ai.anthropicKey) providers.push("Anthropic");
    $("#ai-status").textContent = providers.join(" + ") + " configurato";
  } else {
    aiCard.classList.add("hidden");
  }

  refreshDashboard();
}

/* ── Sync ──────────────────────────────────────────────────── */
async function handleSync() {
  const btn = $("#btn-sync");
  const label = $("#sync-label");
  btn.disabled = true;
  label.innerHTML = '<span class="spinner"></span> Sincronizzazione...';
  
  const progress = $("#sync-progress");
  progress.classList.remove("hidden");
  $("#progress-fill").style.width = "30%";
  $("#progress-text").textContent = "Connessione...";
  hideStatus("sync-result");

  try {
    const res = await send("syncNow");
    $("#progress-fill").style.width = "100%";
    if (res?.success) {
      const msg = res.downloaded > 0
        ? `✅ Scaricati ${res.downloaded} messaggi`
        : "✅ Nessun nuovo messaggio";
      showStatus("sync-result", msg, "success");
      if (res.downloaded > 0) loadInboxPreview();
    } else {
      showStatus("sync-result", `❌ ${res?.error || "Errore"}`, "error");
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

/* ── Refresh ──────────────────────────────────────────────── */
async function refreshDashboard() {
  const res = await send("getStatus");
  if (!res?.success) return;
  const { stats, syncState, config } = res;

  $("#stat-total").textContent = formatNum(stats?.totalEmails || 0);
  $("#stat-syncs").textContent = formatNum(stats?.syncCount || 0);
  $("#stat-mode").textContent = config?.storageMode === "cloud" ? "☁️ Cloud" : "💾 Locale";

  if (syncState?.lastSyncAt) {
    const diff = Date.now() - new Date(syncState.lastSyncAt).getTime();
    if (diff < 60000) $("#stat-last").textContent = "Ora";
    else if (diff < 3600000) $("#stat-last").textContent = `${Math.floor(diff / 60000)}m fa`;
    else if (diff < 86400000) $("#stat-last").textContent = `${Math.floor(diff / 3600000)}h fa`;
    else $("#stat-last").textContent = new Date(syncState.lastSyncAt).toLocaleDateString("it-IT");
  } else {
    $("#stat-last").textContent = "Mai";
  }

  // Tab badges
  ["email", "whatsapp", "linkedin"].forEach(ch => {
    const tab = $(`.channel-tab[data-channel="${ch}"]`);
    const configured = ch === "email" ? !!config?.email : !!config?.[ch];
    tab.classList.toggle("disabled", !configured);
  });
}

/* ── Inbox preview ────────────────────────────────────────── */
async function loadInboxPreview() {
  const res = await send("getRecentEmails");
  const container = $("#inbox-preview");
  const list = $("#inbox-list");
  if (!res?.success || !res.emails?.length) { container.classList.add("hidden"); return; }
  container.classList.remove("hidden");
  list.innerHTML = "";
  res.emails.slice(0, 5).forEach(email => {
    const item = document.createElement("div");
    item.className = `inbox-item${email.unread ? " unread" : ""}`;
    item.innerHTML = `
      <div class="mail-dot${email.unread ? "" : " read"}"></div>
      <div class="mail-info">
        <div class="mail-from">${esc(email.from || "Sconosciuto")}</div>
        <div class="mail-subject">${esc(email.subject || "(senza oggetto)")}</div>
      </div>
      <div class="mail-date">${fmtDate(email.date)}</div>
    `;
    item.addEventListener("click", () => send("openSidePanel", { emailId: email.uid }));
    list.appendChild(item);
  });
}

/* ── Helpers ──────────────────────────────────────────────── */
function send(action, data = {}) { return chrome.runtime.sendMessage({ action, ...data }); }
function showStatus(id, text, type) { const el = $(`#${id}`); el.textContent = text; el.className = `status-box ${type}`; el.classList.remove("hidden"); }
function hideStatus(id) { $(`#${id}`)?.classList.add("hidden"); }
function formatNum(n) { return n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n); }
function togglePw(inputId, btnId) { const inp = $(`#${inputId}`); const show = inp.type === "password"; inp.type = show ? "text" : "password"; $(`#${btnId}`).textContent = show ? "🙈" : "👁️"; }
function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d), now = new Date(), diff = now - dt;
  if (diff < 86400000 && dt.getDate() === now.getDate()) return dt.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  if (diff < 604800000) return dt.toLocaleDateString("it-IT", { weekday: "short" });
  return dt.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}
function getProxyUrl() { return "https://zrbditqddhjkutzjycgi.supabase.co/functions/v1/email-imap-proxy"; }