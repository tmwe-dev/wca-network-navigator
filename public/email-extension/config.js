/**
 * config.js — Configurazione centralizzata v3.0
 * ──────────────────────────────────────────────
 */

export const VERSION = "3.0.0";

export const DEFAULTS = {
  storageMode: "local",
  batchSize: 25,
  syncInterval: 15,
};

export const ERR = {
  NO_CREDENTIALS:    "NO_CREDENTIALS",
  AUTH_FAILED:       "AUTH_FAILED",
  PROXY_UNREACHABLE: "PROXY_UNREACHABLE",
  SYNC_IN_PROGRESS:  "SYNC_IN_PROGRESS",
  DOWNLOAD_FAILED:   "DOWNLOAD_FAILED",
};

export const CHANNELS = ["email", "whatsapp", "linkedin"];

export const WELL_KNOWN_PROVIDERS = {
  "gmail.com":       { host: "imap.gmail.com",        port: 993, tls: true, label: "Gmail" },
  "googlemail.com":  { host: "imap.gmail.com",        port: 993, tls: true, label: "Gmail" },
  "outlook.com":     { host: "outlook.office365.com",  port: 993, tls: true, label: "Outlook" },
  "hotmail.com":     { host: "outlook.office365.com",  port: 993, tls: true, label: "Hotmail" },
  "live.com":        { host: "outlook.office365.com",  port: 993, tls: true, label: "Live" },
  "yahoo.com":       { host: "imap.mail.yahoo.com",   port: 993, tls: true, label: "Yahoo" },
  "yahoo.it":        { host: "imap.mail.yahoo.com",   port: 993, tls: true, label: "Yahoo" },
  "icloud.com":      { host: "imap.mail.me.com",      port: 993, tls: true, label: "iCloud" },
  "me.com":          { host: "imap.mail.me.com",      port: 993, tls: true, label: "iCloud" },
  "mac.com":         { host: "imap.mail.me.com",      port: 993, tls: true, label: "iCloud" },
  "aol.com":         { host: "imap.aol.com",          port: 993, tls: true, label: "AOL" },
  "zoho.com":        { host: "imap.zoho.com",         port: 993, tls: true, label: "Zoho" },
  "protonmail.com":  { host: "127.0.0.1",             port: 1143, tls: false, label: "ProtonMail Bridge" },
  "proton.me":       { host: "127.0.0.1",             port: 1143, tls: false, label: "ProtonMail Bridge" },
  "fastmail.com":    { host: "imap.fastmail.com",     port: 993, tls: true, label: "Fastmail" },
  "gmx.com":         { host: "imap.gmx.com",          port: 993, tls: true, label: "GMX" },
  "gmx.de":          { host: "imap.gmx.net",          port: 993, tls: true, label: "GMX" },
  "web.de":          { host: "imap.web.de",            port: 993, tls: true, label: "Web.de" },
  "mail.ru":         { host: "imap.mail.ru",           port: 993, tls: true, label: "Mail.ru" },
  "yandex.ru":       { host: "imap.yandex.ru",        port: 993, tls: true, label: "Yandex" },
  "yandex.com":      { host: "imap.yandex.com",       port: 993, tls: true, label: "Yandex" },
  "libero.it":       { host: "imapmail.libero.it",    port: 993, tls: true, label: "Libero" },
  "virgilio.it":     { host: "in.virgilio.it",        port: 993, tls: true, label: "Virgilio" },
  "tin.it":          { host: "in.virgilio.it",        port: 993, tls: true, label: "TIN" },
  "alice.it":        { host: "in.alice.it",           port: 993, tls: true, label: "Alice" },
  "tim.it":          { host: "imap.tim.it",           port: 993, tls: true, label: "TIM" },
  "tiscali.it":      { host: "imap.tiscali.it",       port: 993, tls: true, label: "Tiscali" },
  "aruba.it":        { host: "imaps.aruba.it",        port: 993, tls: true, label: "Aruba" },
  "pec.it":          { host: "imaps.pec.aruba.it",    port: 993, tls: true, label: "Aruba PEC" },
  "legalmail.it":    { host: "mbox.cert.legalmail.it",port: 993, tls: true, label: "Legalmail PEC" },
  "postecert.it":    { host: "mbox.cert.postecert.it",port: 993, tls: true, label: "PosteCert PEC" },
  "bluewin.ch":      { host: "imaps.bluewin.ch",     port: 993, tls: true, label: "Bluewin" },
  "t-online.de":     { host: "secureimap.t-online.de",port: 993, tls: true, label: "T-Online" },
  "orange.fr":       { host: "imap.orange.fr",        port: 993, tls: true, label: "Orange" },
  "laposte.net":     { host: "imap.laposte.net",     port: 993, tls: true, label: "La Poste" },
  "free.fr":         { host: "imap.free.fr",          port: 993, tls: true, label: "Free" },
  "seznam.cz":       { host: "imap.seznam.cz",       port: 993, tls: true, label: "Seznam" },
};

export const MX_TO_IMAP = {
  "google":        { host: "imap.gmail.com",        port: 993, tls: true, label: "Google Workspace" },
  "outlook":       { host: "outlook.office365.com",  port: 993, tls: true, label: "Microsoft 365" },
  "office365":     { host: "outlook.office365.com",  port: 993, tls: true, label: "Microsoft 365" },
  "yahoo":         { host: "imap.mail.yahoo.com",   port: 993, tls: true, label: "Yahoo" },
  "zoho":          { host: "imap.zoho.com",          port: 993, tls: true, label: "Zoho" },
  "fastmail":      { host: "imap.fastmail.com",     port: 993, tls: true, label: "Fastmail" },
  "aruba":         { host: "imaps.aruba.it",        port: 993, tls: true, label: "Aruba" },
  "register":      { host: "imap.register.it",     port: 993, tls: true, label: "Register.it" },
  "ovh":           { host: "ssl0.ovh.net",          port: 993, tls: true, label: "OVH" },
  "ionos":         { host: "imap.ionos.com",        port: 993, tls: true, label: "IONOS" },
  "gandi":         { host: "mail.gandi.net",        port: 993, tls: true, label: "Gandi" },
};