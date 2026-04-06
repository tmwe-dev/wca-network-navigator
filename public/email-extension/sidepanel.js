/**
 * sidepanel.js — Full email reader in Chrome Side Panel
 * ─────────────────────────────────────────────────────
 */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let allEmails = [];
let currentFilter = "all";
let selectedEmail = null;

/* ── Init ─────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  loadEmails();
});

/* ── Events ───────────────────────────────────────────────────── */
function bindEvents() {
  // Sync
  $("#btn-panel-sync").addEventListener("click", async () => {
    $("#btn-panel-sync").textContent = "⏳";
    await send("syncNow");
    await loadEmails();
    $("#btn-panel-sync").textContent = "🔄";
  });

  // Search toggle
  $("#btn-panel-search").addEventListener("click", () => {
    const bar = $("#search-bar");
    bar.classList.toggle("hidden");
    if (!bar.classList.contains("hidden")) {
      $("#search-input").focus();
    }
  });

  // Search input
  $("#search-input").addEventListener("input", (e) => {
    filterEmails(e.target.value);
  });
  $("#btn-clear-search").addEventListener("click", () => {
    $("#search-input").value = "";
    filterEmails("");
    $("#search-bar").classList.add("hidden");
  });

  // Filter tabs
  $$(".filter-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      $$(".filter-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentFilter = tab.dataset.filter;
      renderEmailList();
    });
  });

  // Back button
  $("#btn-back-list").addEventListener("click", closeReader);

  // Download eml
  $("#btn-download-eml").addEventListener("click", () => {
    if (selectedEmail?.raw) {
      downloadEml(selectedEmail);
    }
  });

  // Flag toggle
  $("#btn-flag").addEventListener("click", () => {
    if (!selectedEmail) return;
    selectedEmail.flagged = !selectedEmail.flagged;
    $("#btn-flag").textContent = selectedEmail.flagged ? "⭐" : "☆";
    send("toggleFlag", { uid: selectedEmail.uid, flagged: selectedEmail.flagged });
    renderEmailList();
  });

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "showEmail" && msg.emailId) {
      const email = allEmails.find(e => e.uid === msg.emailId);
      if (email) openReader(email);
    }
    if (msg.action === "emailsUpdated") {
      loadEmails();
    }
  });
}

/* ── Load emails ──────────────────────────────────────────────── */
async function loadEmails() {
  $("#email-loading").classList.remove("hidden");
  $("#email-empty").classList.add("hidden");
  $("#email-list").innerHTML = "";

  const res = await send("getRecentEmails");

  $("#email-loading").classList.add("hidden");

  if (res?.success && res.emails?.length) {
    allEmails = res.emails;
    renderEmailList();
  } else {
    allEmails = [];
    $("#email-empty").classList.remove("hidden");
  }
}

/* ── Render list ──────────────────────────────────────────────── */
function renderEmailList() {
  const list = $("#email-list");
  const empty = $("#email-empty");
  const searchQuery = ($("#search-input")?.value || "").toLowerCase();

  let filtered = allEmails;

  // Filter by tab
  if (currentFilter === "unread") {
    filtered = filtered.filter(e => e.unread);
  } else if (currentFilter === "flagged") {
    filtered = filtered.filter(e => e.flagged);
  }

  // Filter by search
  if (searchQuery) {
    filtered = filtered.filter(e =>
      (e.subject || "").toLowerCase().includes(searchQuery) ||
      (e.from || "").toLowerCase().includes(searchQuery) ||
      (e.snippet || "").toLowerCase().includes(searchQuery)
    );
  }

  // Update count
  $("#email-count").textContent = `${filtered.length} email`;

  if (!filtered.length) {
    list.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
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

  // Bind click
  list.querySelectorAll(".email-row").forEach(row => {
    row.addEventListener("click", () => {
      const uid = parseInt(row.dataset.uid);
      const email = allEmails.find(e => e.uid === uid);
      if (email) openReader(email);
    });
  });
}

function filterEmails(query) {
  renderEmailList();
}

/* ── Reader ───────────────────────────────────────────────────── */
function openReader(email) {
  selectedEmail = email;
  email.unread = false;

  // Update header
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

  // Render body
  const bodyContainer = $("#reader-body");
  if (email.bodyHtml) {
    // Use iframe for HTML emails (safe sandbox)
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
      doc.write(`
        <!DOCTYPE html>
        <html><head><style>
          body { font-family: -apple-system, sans-serif; font-size: 14px;
                 color: #333; padding: 16px; margin: 0; line-height: 1.6; }
          img { max-width: 100%; height: auto; }
          a { color: #6366f1; }
        </style></head><body>${email.bodyHtml}</body></html>
      `);
      doc.close();
      // Auto-resize iframe
      setTimeout(() => {
        iframe.style.height = doc.body.scrollHeight + 20 + "px";
      }, 100);
    });
    // Trigger load
    iframe.src = "about:blank";
  } else if (email.bodyText) {
    bodyContainer.innerHTML = `<div class="text-body">${escapeHtml(email.bodyText)}</div>`;
  } else {
    bodyContainer.innerHTML = `<div class="text-body" style="color:var(--text-muted);text-align:center;padding:40px;">Contenuto non disponibile</div>`;
  }

  // Attachments
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

  // Show reader
  $("#email-reader").classList.remove("hidden");
  $("#email-list-container").style.display = "none";

  // Mark as read
  send("markRead", { uid: email.uid });
  renderEmailList();
}

function closeReader() {
  selectedEmail = null;
  $("#email-reader").classList.add("hidden");
  $("#email-list-container").style.display = "";
  renderEmailList();
}

/* ── Helpers ──────────────────────────────────────────────────── */

function send(action, data = {}) {
  return chrome.runtime.sendMessage({ action, ...data });
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

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
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  }
  if (diff < 604800000) {
    return d.toLocaleDateString("it-IT", { weekday: "short" });
  }
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