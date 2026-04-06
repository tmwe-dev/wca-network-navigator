/**
 * sidepanel.js — Unified Communication Hub v5.0
 * Side Panel: Onboarding + Dashboard + Email Reader + Compose
 * ─────────────────────────────────────────────────────────────
 */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const screens = { onboarding: $("#onboarding"), dashboard: $("#dashboard"), compose: $("#compose") };
const steps = $$(".step");
const dots = $$(".step-dot");

let currentStep = 0;
let activeChannel = "email";
let composeChannel = "email";
let allEmails = [];
let currentFilter = "all";
let selectedEmail = null;

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
  const quickBar = $("#quick-bar");
  if (quickBar) quickBar.classList.toggle("hidden", name !== "dashboard");
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
  $("#btn-settings")?.addEventListener("click", () => showOnboarding());
  $("#btn-compose")?.addEventListener("click", () => showCompose(activeChannel));
  $("#btn-reset")?.addEventListener("click", async () => {
    if (confirm("Sei sicuro? Tutti i dati verranno cancellati.")) {
      await send("resetState");
      showOnboarding();
    }
  });

  // ── INBOX (email reader integrated) ──
  $("#btn-panel-search")?.addEventListener("click", () => {
    const bar = $("#search-bar");
    bar.classList.toggle("hidden");
    if (!bar.classList.contains("hidden")) $("#search-input").focus();
  });
  $("#search-input")?.addEventListener("input", () => renderEmailList());
  $("#btn-clear-search")?.addEventListener("click", () => {
    $("#search-input").value = "";
    renderEmailList();
    $("#search-bar").classList.add("hidden");
  });
  $$(".filter-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      $$(".filter-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentFilter = tab.dataset.filter;
      renderEmailList();
    });
  });
  $("#btn-back-list")?.addEventListener("click", closeReader);
  $("#btn-download-eml")?.addEventListener("click", () => {
    if (selectedEmail?.raw) downloadEml(selectedEmail);
  });
  $("#btn-flag")?.addEventListener("click", () => {
    if (!selectedEmail) return;
    selectedEmail.flagged = !selectedEmail.flagged;
    $("#btn-flag").textContent = selectedEmail.flagged ? "⭐" : "☆";
    send("toggleFlag", { uid: selectedEmail.uid, flagged: selectedEmail.flagged });
    renderEmailList();
  });

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "showEmail" && msg.emailId) {
      const email = allEmails.find(e => e.uid === msg.emailId);
      if (email) openReader(email);
    }
    if (msg.action === "emailsUpdated") loadEmails();
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

  // ── QUICK BAR ──
  $("#btn-quick-send")?.addEventListener("click", handleQuickSend);
  $("#quick-input")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleQuickSend();
  });
}

/* ── Email Reader ─────────────────────────────────────────── */
async function loadEmails() {
  const loading = $("#email-loading");
  const empty = $("#email-empty");
  const list = $("#email-list");
  if (loading) loading.classList.remove("hidden");
  if (empty) empty.classList.add("hidden");
  if (list) list.innerHTML = "";

  const res = await send("getRecentEmails");

  if (loading) loading.classList.add("hidden");

  if (res?.success && res.emails?.length) {
    allEmails = res.emails;
    renderEmailList();
  } else {
    allEmails = [];
    if (empty) empty.classList.remove("hidden");
  }
}

function renderEmailList() {
  const list = $("#email-list");
  const empty = $("#email-empty");
  if (!list) return;
  const searchQuery = ($("#search-input")?.value || "").toLowerCase();

  let filtered = allEmails;
  if (currentFilter === "unread") filtered = filtered.filter(e => e.unread);
  else if (currentFilter === "flagged") filtered = filtered.filter(e => e.flagged);

  if (searchQuery) {
    filtered = filtered.filter(e =>
      (e.subject || "").toLowerCase().includes(searchQuery) ||
      (e.from || "").toLowerCase().includes(searchQuery) ||
      (e.snippet || "").toLowerCase().includes(searchQuery)
    );
  }

  const countEl = $("#email-count");
  if (countEl) countEl.textContent = `${filtered.length}`;

  if (!filtered.length) {
    list.innerHTML = "";
    if (empty) empty.classList.remove("hidden");
    return;
  }

  if (empty) empty.classList.add("hidden");
  list.innerHTML = filtered.map(email => {
    const initials = getInitials(email.from);
    const isActive = selectedEmail?.uid === email.uid;
    return `
      <div class="email-row${email.unread ? " unread" : ""}${isActive ? " active" : ""}"
           data-uid="${email.uid}">
        <div class="email-avatar">${initials}</div>
        <div class="email-body-preview">
          <div class="email-from">${escapeHtml(extractName(email.from))}</div>
          <div class="email-subject">${escapeHtml(email.subject || "(senza oggetto)")}</div>
          <div class="email-snippet">${escapeHtml(email.snippet || "")}</div>
        </div>
        <div class="email-meta">
          <div class="email-time">${formatDate(email.date)}</div>
          ${email.flagged ? '<div class="email-flag">⭐</div>' : ""}
          ${email.hasAttachments ? '<div class="email-attachment-badge">📎</div>' : ""}
        </div>
      </div>
    `;
  }).join("");

  list.querySelectorAll(".email-row").forEach(row => {
    row.addEventListener("click", () => {
      const uid = parseInt(row.dataset.uid);
      const email = allEmails.find(e => e.uid === uid);
      if (email) openReader(email);
    });
  });
}

function openReader(email) {
  selectedEmail = email;
  email.unread = false;

  $("#reader-subject").textContent = email.subject || "(senza oggetto)";
  $("#reader-from").textContent = email.from || "Sconosciuto";
  $("#reader-date").textContent = email.date
    ? new Date(email.date).toLocaleString("it-IT", {
        weekday: "long", day: "numeric", month: "long",
        year: "numeric", hour: "2-digit", minute: "2-digit"
      })
    : "";
  $("#reader-avatar").textContent = getInitials(email.from);
  $("#reader-to").textContent = email.to ? `A: ${email.to}` : "";
  $("#btn-flag").textContent = email.flagged ? "⭐" : "☆";

  const bodyContainer = $("#reader-body");
  if (email.bodyHtml) {
    bodyContainer.innerHTML = "";
    const iframe = document.createElement("iframe");
    iframe.sandbox = "allow-same-origin";
    iframe.style.width = "100%";
    iframe.style.border = "none";
    iframe.style.borderRadius = "8px";
    iframe.style.background = "white";
    bodyContainer.appendChild(iframe);
    iframe.addEventListener("load", () => {
      const doc = iframe.contentDocument;
      doc.open();
      doc.write(`<!DOCTYPE html><html><head><style>
        body { font-family: -apple-system, sans-serif; font-size: 14px;
               color: #333; padding: 16px; margin: 0; line-height: 1.6; }
        img { max-width: 100%; height: auto; }
        a { color: #6366f1; }
      </style></head><body>${email.bodyHtml}</body></html>`);
      doc.close();
      setTimeout(() => { iframe.style.height = doc.body.scrollHeight + 20 + "px"; }, 100);
    });
    iframe.src = "about:blank";
  } else if (email.bodyText) {
    bodyContainer.innerHTML = `<div class="text-body">${escapeHtml(email.bodyText)}</div>`;
  } else {
    bodyContainer.innerHTML = `<div class="text-body" style="color:var(--text-muted);text-align:center;padding:40px;">Contenuto non disponibile</div>`;
  }

  const attContainer = $("#reader-attachments");
  const attList = $("#attachment-list");
  if (email.attachments?.length) {
    attContainer.classList.remove("hidden");
    attList.innerHTML = email.attachments.map(att => `
      <div class="attachment-chip" data-path="${escapeHtml(att.path || "")}">
        <span class="att-icon">${getFileIcon(att.filename)}</span>
        <span>${escapeHtml(att.filename)}</span>
        <span class="att-size">${formatSize(att.size)}</span>
      </div>
    `).join("");
  } else {
    attContainer.classList.add("hidden");
  }

  $("#email-reader").classList.remove("hidden");
  $("#email-list-container").style.display = "none";
  const toolbar = $(".inbox-toolbar");
  if (toolbar) toolbar.style.display = "none";
  const searchBar = $("#search-bar");
  if (searchBar) searchBar.classList.add("hidden");

  send("markRead", { uid: email.uid });
  renderEmailList();
}

function closeReader() {
  selectedEmail = null;
  $("#email-reader").classList.add("hidden");
  $("#email-list-container").style.display = "";
  const toolbar = $(".inbox-toolbar");
  if (toolbar) toolbar.style.display = "";
  renderEmailList();
}

/* ── Compose ──────────────────────────────────────────────── */
function setupComposeChannel(ch) {
  composeChannel = ch;
  $$(".compose-ch-btn").forEach(b => b.classList.toggle("active", b.dataset.composeCh === ch));

  const badgeMap = { email: "📧 Email", whatsapp: "💬 WhatsApp", linkedin: "💼 LinkedIn" };
  const titleMap = { email: "Nuova email", whatsapp: "Nuovo messaggio WhatsApp", linkedin: "Nuovo messaggio LinkedIn" };
  $("#compose-badge").textContent = badgeMap[ch];
  $("#compose-title").textContent = titleMap[ch];

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
      if (composeChannel === "email") {
        $("#compose-to").value = ""; $("#compose-cc").value = ""; $("#compose-subject").value = ""; $("#compose-body").value = "";
      } else if (composeChannel === "whatsapp") {
        $("#compose-wa-phone").value = ""; $("#compose-wa-body").value = ""; $("#wa-char-count").textContent = "0";
      } else {
        $("#compose-li-recipient").value = ""; $("#compose-li-body").value = ""; $("#li-char-count").textContent = "0";
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

/* ── Quick Send ───────────────────────────────────────────── */
async function handleQuickSend() {
  const input = $("#quick-input");
  const text = input?.value?.trim();
  if (!text) return;

  // Quick send to active channel
  let result;
  try {
    if (activeChannel === "email") {
      // Quick bar not ideal for email — open compose
      showCompose("email");
      $("#compose-body").value = text;
      input.value = "";
      return;
    } else if (activeChannel === "whatsapp") {
      showCompose("whatsapp");
      $("#compose-wa-body").value = text;
      $("#wa-char-count").textContent = text.length;
      input.value = "";
      return;
    } else if (activeChannel === "linkedin") {
      showCompose("linkedin");
      $("#compose-li-body").value = text;
      $("#li-char-count").textContent = text.length;
      input.value = "";
      return;
    }
  } catch (err) {
    console.error("[QuickSend]", err);
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

  const inboxSection = $("#inbox-section");

  if (channel === "email") {
    $("#dash-channel-info").textContent = cfg?.email ? `${cfg.imapHost}:${cfg.imapPort}` : "Non configurato";
    $("#channel-status").classList.add("hidden");
    $("#btn-sync").classList.remove("hidden");
    if (inboxSection) inboxSection.classList.remove("hidden");
    loadEmails();
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

    if (inboxSection) inboxSection.classList.add("hidden");
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
      if (res.downloaded > 0) loadEmails();
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

  ["email", "whatsapp", "linkedin"].forEach(ch => {
    const tab = $(`.channel-tab[data-channel="${ch}"]`);
    const configured = ch === "email" ? !!config?.email : !!config?.[ch];
    tab.classList.toggle("disabled", !configured);
  });

  ["email", "whatsapp", "linkedin"].forEach(ch => {
    const btn = $(`.compose-ch-btn[data-compose-ch="${ch}"]`);
    if (!btn) return;
    const configured = ch === "email" ? !!config?.email : !!config?.[ch];
    btn.classList.toggle("disabled", !configured);
  });
}

/* ── Helpers ──────────────────────────────────────────────── */
function send(action, data = {}) { return chrome.runtime.sendMessage({ action, ...data }); }
function showStatus(id, text, type) { const el = $(`#${id}`); if (!el) return; el.textContent = text; el.className = `status-box ${type}`; el.classList.remove("hidden"); }
function hideStatus(id) { $(`#${id}`)?.classList.add("hidden"); }
function formatNum(n) { return n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n); }
function togglePw(inputId, btnId) { const inp = $(`#${inputId}`); const show = inp.type === "password"; inp.type = show ? "text" : "password"; $(`#${btnId}`).textContent = show ? "🙈" : "👁️"; }
function escapeHtml(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
function extractName(from) {
  if (!from) return "Sconosciuto";
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : from.split("@")[0];
}
function getInitials(from) {
  const name = extractName(from);
  const parts = name.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate()) return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  if (diff < 604800000) return d.toLocaleDateString("it-IT", { weekday: "short" });
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}
function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}
function getFileIcon(filename) {
  if (!filename) return "📄";
  const ext = filename.split(".").pop()?.toLowerCase();
  const icons = {
    pdf: "📕", doc: "📘", docx: "📘", xls: "📗", xlsx: "📗",
    ppt: "📙", pptx: "📙", zip: "📦", rar: "📦",
    jpg: "🖼️", jpeg: "🖼️", png: "🖼️", gif: "🖼️", webp: "🖼️",
    mp3: "🎵", mp4: "🎬", mov: "🎬",
    csv: "📊", txt: "📝", html: "🌐",
  };
  return icons[ext] || "📄";
}
function downloadEml(email) {
  if (!email.raw) return;
  const blob = new Blob([email.raw], { type: "message/rfc822" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(email.subject || "email").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 60)}.eml`;
  a.click();
  URL.revokeObjectURL(url);
}
function getProxyUrl() { return "https://zrbditqddhjkutzjycgi.supabase.co/functions/v1/email-imap-proxy"; }