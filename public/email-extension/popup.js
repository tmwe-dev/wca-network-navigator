/**
 * popup.js — Unified Communication Hub: Onboarding + Dashboard + Compose v4.0
 * ─────────────────────────────────────────────────────────────────────────────
 */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const screens = { onboarding: $("#onboarding"), dashboard: $("#dashboard"), compose: $("#compose") };
const steps = $$(".step");
const dots = $$(".step-dot");

let currentStep = 0;
let activeChannel = "email";
let composeChannel = "email";

const onboardingState = { email: null, whatsapp: null, linkedin: null, ai: null };

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
function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => el.classList.toggle("hidden", k !== name));
}
function showOnboarding() { showScreen("onboarding"); goToStep(0); }
function showDashboard() { showScreen("dashboard"); switchChannel(activeChannel); refreshDashboard(); }
function showCompose(channel) {
  composeChannel = channel || activeChannel;
  showScreen("compose");
  setupComposeChannel(composeChannel);
}

function goToStep(n) {
  currentStep = n;
  const allSteps = ["step-0", "step-1", "step-1b", "step-2", "step-3", "step-4", "step-5"];
  allSteps.forEach(id => $(`#${id}`)?.classList.remove("active"));
  const stepMap = { 0: "step-0", 1: "step-1", "1b": "step-1b", 2: "step-2", 3: "step-3", 4: "step-4", 5: "step-5" };
  $(`#${stepMap[n]}`)?.classList.add("active");
  const dotIndex = typeof n === "number" ? n : 1;
  dots.forEach((d, i) => { d.classList.toggle("active", i === dotIndex); d.classList.toggle("done", i < dotIndex); });
}

/* ── Events ───────────────────────────────────────────────── */
function bindEvents() {
  $("#btn-start")?.addEventListener("click", () => goToStep(1));

  // ── EMAIL ──
  $("#btn-email-discover")?.addEventListener("click", handleEmailDiscover);
  $("#btn-email-manual")?.addEventListener("click", () => {
    const email = $("#email-addr").value.trim();
    if (!email) { showStatus("email-discover-status", "Inserisci l'email", "warning"); return; }
    $("#email-host").value = "";
    $("#email-port").value = "993";
    $("#email-tls").value = "true";
    $("#smtp-host").value = "";
    $("#smtp-port").value = "587";
    $("#smtp-tls").value = "starttls";
    $("#email-server-label").textContent = "Configurazione manuale";
    $("#email-discover-method").textContent = "";
    goToStep("1b");
  });
  $("#skip-email")?.addEventListener("click", () => goToStep(2));

  $("#btn-email-test")?.addEventListener("click", async () => {
    const host = $("#email-host").value.trim();
    if (!host) { showStatus("email-test-status", "Inserisci l'host IMAP", "warning"); return; }
    onboardingState.email = {
      email: $("#email-addr").value.trim(),
      password: $("#email-pw").value,
      imapHost: host,
      imapPort: parseInt($("#email-port").value) || 993,
      imapTls: $("#email-tls").value === "true",
      smtpHost: $("#smtp-host").value.trim() || host.replace("imap", "smtp"),
      smtpPort: parseInt($("#smtp-port").value) || 587,
      smtpSecurity: $("#smtp-tls").value,
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
        smtpHost: $("#smtp-host").value.trim() || host.replace("imap", "smtp"),
        smtpPort: parseInt($("#smtp-port").value) || 587,
        smtpSecurity: $("#smtp-tls").value,
      };
    }
    goToStep(2);
  });

  // ── WHATSAPP ──
  $("#btn-wa-save")?.addEventListener("click", () => {
    onboardingState.whatsapp = { phone: $("#wa-phone").value.trim(), notifications: $("#wa-notifications").checked };
    goToStep(3);
  });
  $("#skip-wa")?.addEventListener("click", () => goToStep(3));

  // ── LINKEDIN ──
  $("#btn-li-save")?.addEventListener("click", () => {
    onboardingState.linkedin = { profileUrl: $("#li-profile").value.trim(), notifications: $("#li-notifications").checked };
    goToStep(4);
  });
  $("#skip-li")?.addEventListener("click", () => goToStep(4));

  // ── AI ──
  $("#btn-ai-save")?.addEventListener("click", () => {
    onboardingState.ai = { openaiKey: $("#openai-key").value.trim(), anthropicKey: $("#anthropic-key").value.trim(), defaultModel: $("#ai-default-model").value };
    goToStep(5);
    renderSummary();
  });
  $("#skip-ai")?.addEventListener("click", () => { goToStep(5); renderSummary(); });

  // Eye toggles
  $("#eye-email")?.addEventListener("click", () => togglePw("email-pw", "eye-email"));
  $$(".btn-eye[data-target]").forEach(btn => {
    btn.addEventListener("click", () => {
      const inp = $(`#${btn.dataset.target}`);
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
  $("#btn-compose")?.addEventListener("click", () => showCompose(activeChannel));
  $("#btn-reset")?.addEventListener("click", async () => {
    if (confirm("Sei sicuro? Tutti i dati verranno cancellati.")) {
      await send("resetState");
      showOnboarding();
    }
  });

  // ── COMPOSE ──
  $("#btn-compose-back")?.addEventListener("click", () => showDashboard());
  $$(".compose-ch-btn").forEach(btn => {
    btn.addEventListener("click", () => setupComposeChannel(btn.dataset.composeCh));
  });
  $("#btn-send")?.addEventListener("click", handleSend);

  // Char counters
  $("#compose-wa-body")?.addEventListener("input", () => {
    $("#wa-char-count").textContent = ($("#compose-wa-body").value || "").length;
  });
  $("#compose-li-body")?.addEventListener("input", () => {
    $("#li-char-count").textContent = ($("#compose-li-body").value || "").length;
  });
}

/* ── Compose ──────────────────────────────────────────────── */
function setupComposeChannel(ch) {
  composeChannel = ch;
  $$(".compose-ch-btn").forEach(b => b.classList.toggle("active", b.dataset.composeCh === ch));

  const badgeMap = { email: "📧 Email", whatsapp: "💬 WhatsApp", linkedin: "💼 LinkedIn" };
  const titleMap = { email: "Nuova email", whatsapp: "Nuovo messaggio WhatsApp", linkedin: "Nuovo messaggio LinkedIn" };
  $("#compose-badge").textContent = badgeMap[ch];
  $("#compose-title").textContent = titleMap[ch];

  // Show/hide field groups
  ["email", "wa", "li"].forEach(prefix => {
    const el = $(`#compose-${prefix === "email" ? "email" : prefix}-fields`);
    if (el) el.classList.toggle("hidden", (prefix === "email" && ch !== "email") || (prefix === "wa" && ch !== "whatsapp") || (prefix === "li" && ch !== "linkedin"));
  });

  hideStatus("compose-status");
}

async function handleSend() {
  const btn = $("#btn-send");
  const label = $("#send-label");
  btn.disabled = true;
  label.innerHTML = '<span class="spinner"></span> Invio in corso...';
  hideStatus("compose-status");

  try {
    let result;
    if (composeChannel === "email") {
      const to = $("#compose-to").value.trim();
      const cc = $("#compose-cc").value.trim();
      const subject = $("#compose-subject").value.trim();
      const body = $("#compose-body").value.trim();
      if (!to) throw new Error("Inserisci il destinatario");
      if (!subject && !body) throw new Error("Inserisci oggetto o messaggio");
      result = await send("sendEmail", { to, cc, subject, body });
    } else if (composeChannel === "whatsapp") {
      const phone = $("#compose-wa-phone").value.trim();
      const body = $("#compose-wa-body").value.trim();
      if (!phone) throw new Error("Inserisci il numero di telefono");
      if (!body) throw new Error("Inserisci il messaggio");
      result = await send("sendWhatsApp", { phone, text: body });
    } else if (composeChannel === "linkedin") {
      const recipient = $("#compose-li-recipient").value.trim();
      const body = $("#compose-li-body").value.trim();
      if (!recipient) throw new Error("Inserisci il destinatario");
      if (!body) throw new Error("Inserisci il messaggio");
      result = await send("sendLinkedIn", { recipient, text: body });
    }

    if (result?.success) {
      showStatus("compose-status", "✅ Messaggio inviato con successo!", "success");
      // Clear fields
      if (composeChannel === "email") {
        $("#compose-to").value = "";
        $("#compose-cc").value = "";
        $("#compose-subject").value = "";
        $("#compose-body").value = "";
      } else if (composeChannel === "whatsapp") {
        $("#compose-wa-phone").value = "";
        $("#compose-wa-body").value = "";
        $("#wa-char-count").textContent = "0";
      } else {
        $("#compose-li-recipient").value = "";
        $("#compose-li-body").value = "";
        $("#li-char-count").textContent = "0";
      }
    } else {
      showStatus("compose-status", `❌ ${result?.error || "Invio fallito"}`, "error");
    }
  } catch (err) {
    showStatus("compose-status", `❌ ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    label.textContent = "📤 Invia messaggio";
  }
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
      // Auto-fill SMTP
      $("#smtp-host").value = res.server.smtp || res.server.host.replace("imap", "smtp");
      $("#smtp-port").value = res.server.smtpPort || 587;
      $("#smtp-tls").value = (res.server.smtpPort || 587) === 465 ? "ssl" : "starttls";
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
  $("#stat-sent").textContent = formatNum(stats?.sentCount || 0);

  if (syncState?.lastSyncAt) {
    const diff = Date.now() - new Date(syncState.lastSyncAt).getTime();
    if (diff < 60000) $("#stat-last").textContent = "Ora";
    else if (diff < 3600000) $("#stat-last").textContent = `${Math.floor(diff / 60000)}m fa`;
    else if (diff < 86400000) $("#stat-last").textContent = `${Math.floor(diff / 3600000)}h fa`;
    else $("#stat-last").textContent = new Date(syncState.lastSyncAt).toLocaleDateString("it-IT");
  } else {
    $("#stat-last").textContent = "Mai";
  }

  // Tab badges & disabled state
  ["email", "whatsapp", "linkedin"].forEach(ch => {
    const tab = $(`.channel-tab[data-channel="${ch}"]`);
    const configured = ch === "email" ? !!config?.email : !!config?.[ch];
    tab.classList.toggle("disabled", !configured);
  });

  // Compose channel buttons disabled state
  ["email", "whatsapp", "linkedin"].forEach(ch => {
    const btn = $(`.compose-ch-btn[data-compose-ch="${ch}"]`);
    if (!btn) return;
    const configured = ch === "email" ? !!config?.email : !!config?.[ch];
    btn.classList.toggle("disabled", !configured);
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
function showStatus(id, text, type) { const el = $(`#${id}`); if (!el) return; el.textContent = text; el.className = `status-box ${type}`; el.classList.remove("hidden"); }
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
