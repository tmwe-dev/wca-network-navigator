/**
 * config.js — Configurazione centralizzata v4.0
 * ──────────────────────────────────────────────
 */

export const VERSION = "4.0.0";

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
  SEND_FAILED:       "SEND_FAILED",
  TAB_NOT_FOUND:     "TAB_NOT_FOUND",
  INJECT_FAILED:     "INJECT_FAILED",
};

export const CHANNELS = ["email", "whatsapp", "linkedin"];

export const WELL_KNOWN_PROVIDERS = {
  "gmail.com":       { host: "imap.gmail.com",        smtp: "smtp.gmail.com",        smtpPort: 587, port: 993, tls: true, label: "Gmail" },
  "googlemail.com":  { host: "imap.gmail.com",        smtp: "smtp.gmail.com",        smtpPort: 587, port: 993, tls: true, label: "Gmail" },
  "outlook.com":     { host: "outlook.office365.com",  smtp: "smtp.office365.com",    smtpPort: 587, port: 993, tls: true, label: "Outlook" },
  "hotmail.com":     { host: "outlook.office365.com",  smtp: "smtp.office365.com",    smtpPort: 587, port: 993, tls: true, label: "Hotmail" },
  "live.com":        { host: "outlook.office365.com",  smtp: "smtp.office365.com",    smtpPort: 587, port: 993, tls: true, label: "Live" },
  "yahoo.com":       { host: "imap.mail.yahoo.com",   smtp: "smtp.mail.yahoo.com",   smtpPort: 587, port: 993, tls: true, label: "Yahoo" },
  "yahoo.it":        { host: "imap.mail.yahoo.com",   smtp: "smtp.mail.yahoo.com",   smtpPort: 587, port: 993, tls: true, label: "Yahoo" },
  "icloud.com":      { host: "imap.mail.me.com",      smtp: "smtp.mail.me.com",      smtpPort: 587, port: 993, tls: true, label: "iCloud" },
  "me.com":          { host: "imap.mail.me.com",      smtp: "smtp.mail.me.com",      smtpPort: 587, port: 993, tls: true, label: "iCloud" },
  "mac.com":         { host: "imap.mail.me.com",      smtp: "smtp.mail.me.com",      smtpPort: 587, port: 993, tls: true, label: "iCloud" },
  "aol.com":         { host: "imap.aol.com",          smtp: "smtp.aol.com",          smtpPort: 587, port: 993, tls: true, label: "AOL" },
  "zoho.com":        { host: "imap.zoho.com",         smtp: "smtp.zoho.com",         smtpPort: 587, port: 993, tls: true, label: "Zoho" },
  "protonmail.com":  { host: "127.0.0.1",             smtp: "127.0.0.1",             smtpPort: 1025, port: 1143, tls: false, label: "ProtonMail Bridge" },
  "proton.me":       { host: "127.0.0.1",             smtp: "127.0.0.1",             smtpPort: 1025, port: 1143, tls: false, label: "ProtonMail Bridge" },
  "fastmail.com":    { host: "imap.fastmail.com",     smtp: "smtp.fastmail.com",     smtpPort: 587, port: 993, tls: true, label: "Fastmail" },
  "gmx.com":         { host: "imap.gmx.com",          smtp: "mail.gmx.com",          smtpPort: 587, port: 993, tls: true, label: "GMX" },
  "gmx.de":          { host: "imap.gmx.net",          smtp: "mail.gmx.net",          smtpPort: 587, port: 993, tls: true, label: "GMX" },
  "web.de":          { host: "imap.web.de",            smtp: "smtp.web.de",           smtpPort: 587, port: 993, tls: true, label: "Web.de" },
  "mail.ru":         { host: "imap.mail.ru",           smtp: "smtp.mail.ru",          smtpPort: 587, port: 993, tls: true, label: "Mail.ru" },
  "yandex.ru":       { host: "imap.yandex.ru",        smtp: "smtp.yandex.ru",        smtpPort: 587, port: 993, tls: true, label: "Yandex" },
  "yandex.com":      { host: "imap.yandex.com",       smtp: "smtp.yandex.com",       smtpPort: 587, port: 993, tls: true, label: "Yandex" },
  "libero.it":       { host: "imapmail.libero.it",    smtp: "smtp.libero.it",        smtpPort: 587, port: 993, tls: true, label: "Libero" },
  "virgilio.it":     { host: "in.virgilio.it",        smtp: "out.virgilio.it",       smtpPort: 587, port: 993, tls: true, label: "Virgilio" },
  "tin.it":          { host: "in.virgilio.it",        smtp: "out.virgilio.it",       smtpPort: 587, port: 993, tls: true, label: "TIN" },
  "alice.it":        { host: "in.alice.it",           smtp: "out.alice.it",          smtpPort: 587, port: 993, tls: true, label: "Alice" },
  "tim.it":          { host: "imap.tim.it",           smtp: "smtp.tim.it",           smtpPort: 587, port: 993, tls: true, label: "TIM" },
  "tiscali.it":      { host: "imap.tiscali.it",       smtp: "smtp.tiscali.it",       smtpPort: 587, port: 993, tls: true, label: "Tiscali" },
  "aruba.it":        { host: "imaps.aruba.it",        smtp: "smtps.aruba.it",        smtpPort: 465, port: 993, tls: true, label: "Aruba" },
  "pec.it":          { host: "imaps.pec.aruba.it",    smtp: "smtps.pec.aruba.it",   smtpPort: 465, port: 993, tls: true, label: "Aruba PEC" },
  "legalmail.it":    { host: "mbox.cert.legalmail.it",smtp: "sendm.cert.legalmail.it",smtpPort: 465, port: 993, tls: true, label: "Legalmail PEC" },
  "postecert.it":    { host: "mbox.cert.postecert.it",smtp: "relay.cert.postecert.it",smtpPort: 465, port: 993, tls: true, label: "PosteCert PEC" },
  "bluewin.ch":      { host: "imaps.bluewin.ch",     smtp: "smtpauths.bluewin.ch",  smtpPort: 465, port: 993, tls: true, label: "Bluewin" },
  "t-online.de":     { host: "secureimap.t-online.de",smtp: "securesmtp.t-online.de",smtpPort: 587, port: 993, tls: true, label: "T-Online" },
  "orange.fr":       { host: "imap.orange.fr",        smtp: "smtp.orange.fr",        smtpPort: 587, port: 993, tls: true, label: "Orange" },
  "laposte.net":     { host: "imap.laposte.net",     smtp: "smtp.laposte.net",     smtpPort: 587, port: 993, tls: true, label: "La Poste" },
  "free.fr":         { host: "imap.free.fr",          smtp: "smtp.free.fr",          smtpPort: 587, port: 993, tls: true, label: "Free" },
  "seznam.cz":       { host: "imap.seznam.cz",       smtp: "smtp.seznam.cz",       smtpPort: 587, port: 993, tls: true, label: "Seznam" },
};

export const MX_TO_IMAP = {
  "google":        { host: "imap.gmail.com",        smtp: "smtp.gmail.com",        smtpPort: 587, port: 993, tls: true, label: "Google Workspace" },
  "outlook":       { host: "outlook.office365.com",  smtp: "smtp.office365.com",    smtpPort: 587, port: 993, tls: true, label: "Microsoft 365" },
  "office365":     { host: "outlook.office365.com",  smtp: "smtp.office365.com",    smtpPort: 587, port: 993, tls: true, label: "Microsoft 365" },
  "yahoo":         { host: "imap.mail.yahoo.com",   smtp: "smtp.mail.yahoo.com",   smtpPort: 587, port: 993, tls: true, label: "Yahoo" },
  "zoho":          { host: "imap.zoho.com",          smtp: "smtp.zoho.com",         smtpPort: 587, port: 993, tls: true, label: "Zoho" },
  "fastmail":      { host: "imap.fastmail.com",     smtp: "smtp.fastmail.com",     smtpPort: 587, port: 993, tls: true, label: "Fastmail" },
  "aruba":         { host: "imaps.aruba.it",        smtp: "smtps.aruba.it",        smtpPort: 465, port: 993, tls: true, label: "Aruba" },
  "register":      { host: "imap.register.it",     smtp: "smtp.register.it",     smtpPort: 587, port: 993, tls: true, label: "Register.it" },
  "ovh":           { host: "ssl0.ovh.net",          smtp: "ssl0.ovh.net",          smtpPort: 587, port: 993, tls: true, label: "OVH" },
  "ionos":         { host: "imap.ionos.com",        smtp: "smtp.ionos.com",        smtpPort: 587, port: 993, tls: true, label: "IONOS" },
  "gandi":         { host: "mail.gandi.net",        smtp: "mail.gandi.net",        smtpPort: 587, port: 993, tls: true, label: "Gandi" },
};
