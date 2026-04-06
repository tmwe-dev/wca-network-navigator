/**
 * config.js — Centralised configuration & well-known IMAP providers
 * ─────────────────────────────────────────────────────────────────
 * Pure data module: zero side-effects, zero Chrome API calls.
 */

export const VERSION = "2.0.0";

/* ── Well-known IMAP providers ────────────────────────────────── */

export const WELL_KNOWN_PROVIDERS = {
  // Gmail / Google Workspace
  "gmail.com":        { host: "imap.gmail.com",           port: 993, tls: true, label: "Gmail" },
  "googlemail.com":   { host: "imap.gmail.com",           port: 993, tls: true, label: "Gmail" },

  // Microsoft
  "outlook.com":      { host: "outlook.office365.com",    port: 993, tls: true, label: "Outlook" },
  "hotmail.com":      { host: "outlook.office365.com",    port: 993, tls: true, label: "Outlook" },
  "live.com":         { host: "outlook.office365.com",    port: 993, tls: true, label: "Outlook" },
  "msn.com":          { host: "outlook.office365.com",    port: 993, tls: true, label: "Outlook" },

  // Yahoo
  "yahoo.com":        { host: "imap.mail.yahoo.com",      port: 993, tls: true, label: "Yahoo" },
  "yahoo.it":         { host: "imap.mail.yahoo.com",      port: 993, tls: true, label: "Yahoo" },
  "yahoo.co.uk":      { host: "imap.mail.yahoo.com",      port: 993, tls: true, label: "Yahoo" },
  "ymail.com":        { host: "imap.mail.yahoo.com",      port: 993, tls: true, label: "Yahoo" },

  // Apple
  "icloud.com":       { host: "imap.mail.me.com",         port: 993, tls: true, label: "iCloud" },
  "me.com":           { host: "imap.mail.me.com",         port: 993, tls: true, label: "iCloud" },
  "mac.com":          { host: "imap.mail.me.com",         port: 993, tls: true, label: "iCloud" },

  // Zoho
  "zoho.com":         { host: "imap.zoho.com",            port: 993, tls: true, label: "Zoho" },
  "zohomail.com":     { host: "imap.zoho.com",            port: 993, tls: true, label: "Zoho" },

  // AOL
  "aol.com":          { host: "imap.aol.com",             port: 993, tls: true, label: "AOL" },

  // GMX
  "gmx.com":          { host: "imap.gmx.com",             port: 993, tls: true, label: "GMX" },
  "gmx.de":           { host: "imap.gmx.net",             port: 993, tls: true, label: "GMX" },
  "gmx.net":          { host: "imap.gmx.net",             port: 993, tls: true, label: "GMX" },

  // Mail.com
  "mail.com":         { host: "imap.mail.com",            port: 993, tls: true, label: "Mail.com" },

  // Yandex
  "yandex.com":       { host: "imap.yandex.com",          port: 993, tls: true, label: "Yandex" },
  "yandex.ru":        { host: "imap.yandex.com",          port: 993, tls: true, label: "Yandex" },

  // ProtonMail (Bridge required)
  "protonmail.com":   { host: "127.0.0.1",                port: 1143, tls: false, label: "ProtonMail (Bridge)", bridge: true },
  "proton.me":        { host: "127.0.0.1",                port: 1143, tls: false, label: "ProtonMail (Bridge)", bridge: true },

  // Italian providers
  "libero.it":        { host: "imapmail.libero.it",       port: 993, tls: true, label: "Libero" },
  "virgilio.it":      { host: "in.virgilio.it",           port: 993, tls: true, label: "Virgilio" },
  "tim.it":           { host: "imap.tim.it",              port: 993, tls: true, label: "TIM" },
  "alice.it":         { host: "in.alice.it",              port: 993, tls: true, label: "Alice" },
  "tiscali.it":       { host: "imap.tiscali.it",          port: 993, tls: true, label: "Tiscali" },
  "aruba.it":         { host: "imaps.aruba.it",           port: 993, tls: true, label: "Aruba" },
  "pec.it":           { host: "imaps.pec.aruba.it",       port: 993, tls: true, label: "Aruba PEC" },
  "legalmail.it":     { host: "mbox.cert.legalmail.it",   port: 993, tls: true, label: "Legalmail PEC" },
  "postecert.it":     { host: "mail.postecert.it",        port: 993, tls: true, label: "PosteCert PEC" },

  // OVH
  "ovh.net":          { host: "ssl0.ovh.net",             port: 993, tls: true, label: "OVH" },

  // Fastmail
  "fastmail.com":     { host: "imap.fastmail.com",        port: 993, tls: true, label: "Fastmail" },

  // Rackspace
  "emailsrvr.com":    { host: "secure.emailsrvr.com",    port: 993, tls: true, label: "Rackspace" },
};

/* ── MX → IMAP heuristic map ─────────────────────────────────── */

export const MX_TO_IMAP = {
  "google":           { host: "imap.gmail.com",           port: 993, tls: true, label: "Google Workspace" },
  "outlook":          { host: "outlook.office365.com",    port: 993, tls: true, label: "Microsoft 365" },
  "protection.outlook": { host: "outlook.office365.com", port: 993, tls: true, label: "Microsoft 365" },
  "yahoodns":         { host: "imap.mail.yahoo.com",      port: 993, tls: true, label: "Yahoo" },
  "ovh":              { host: "ssl0.ovh.net",             port: 993, tls: true, label: "OVH" },
  "aruba":            { host: "imaps.aruba.it",           port: 993, tls: true, label: "Aruba" },
  "zoho":             { host: "imap.zoho.com",            port: 993, tls: true, label: "Zoho" },
  "fastmail":         { host: "imap.fastmail.com",        port: 993, tls: true, label: "Fastmail" },
};

/* ── Error codes ──────────────────────────────────────────────── */

export const ERR = {
  NO_CREDENTIALS:     "ERR_NO_CREDENTIALS",
  DISCOVERY_FAILED:   "ERR_DISCOVERY_FAILED",
  AUTH_FAILED:        "ERR_AUTH_FAILED",
  PROXY_UNREACHABLE:  "ERR_PROXY_UNREACHABLE",
  DOWNLOAD_FAILED:    "ERR_DOWNLOAD_FAILED",
  SYNC_IN_PROGRESS:   "ERR_SYNC_IN_PROGRESS",
};

/* ── Default settings ─────────────────────────────────────────── */

export const DEFAULTS = {
  syncIntervalMinutes: 15,
  batchSize: 50,
  storageMode: "local",         // "local" | "cloud"
  maxLocalEmails: 10000,
  notificationsEnabled: true,
};
