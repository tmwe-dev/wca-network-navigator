/**
 * auto-discover.js — Multi-strategy IMAP server discovery
 * ────────────────────────────────────────────────────────
 * Strategy chain:
 *   1. Well-known provider map (instant)
 *   2. Mozilla Autoconfig XML (ISP database)
 *   3. MX record heuristic (DNS via DoH)
 *   4. Common subdomain guess (imap.domain.com)
 */

import { WELL_KNOWN_PROVIDERS, MX_TO_IMAP } from "./config.js";

/**
 * Discover IMAP settings for an email address.
 * @param {string} email — full email address
 * @param {string} [proxyUrl] — edge function URL for server-side verification
 * @returns {Promise<{host:string, port:number, tls:boolean, label:string, method:string}>}
 */
export async function discoverImapServer(email, proxyUrl) {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) throw new Error("Indirizzo email non valido");

  // ── Strategy 1: Well-known map ──
  const known = WELL_KNOWN_PROVIDERS[domain];
  if (known) return { ...known, method: "well-known" };

  // ── Strategy 2: Mozilla Autoconfig ──
  try {
    const autoconfig = await tryMozillaAutoconfig(domain);
    if (autoconfig) return { ...autoconfig, method: "autoconfig" };
  } catch { /* continue */ }

  // ── Strategy 3: MX heuristic via DNS-over-HTTPS ──
  try {
    const mxResult = await tryMxLookup(domain);
    if (mxResult) return { ...mxResult, method: "mx-heuristic" };
  } catch { /* continue */ }

  // ── Strategy 4: Common subdomain guess ──
  const guess = {
    host: `imap.${domain}`,
    port: 993,
    tls: true,
    label: domain,
    method: "guess",
  };

  // If we have a proxy, verify the guess
  if (proxyUrl) {
    try {
      const ok = await verifyImapServer(proxyUrl, guess.host, guess.port, guess.tls);
      if (ok) return guess;
    } catch { /* continue */ }

    // Try mail.domain as fallback
    const fallback = { ...guess, host: `mail.${domain}` };
    try {
      const ok = await verifyImapServer(proxyUrl, fallback.host, fallback.port, fallback.tls);
      if (ok) return { ...fallback, method: "guess-fallback" };
    } catch { /* continue */ }
  }

  // Return the guess anyway — let the user confirm
  return guess;
}

/* ── Mozilla Autoconfig ───────────────────────────────────────── */

async function tryMozillaAutoconfig(domain) {
  const urls = [
    `https://autoconfig.${domain}/mail/config-v1.1.xml`,
    `https://${domain}/.well-known/autoconfig/mail/config-v1.1.xml`,
    `https://autoconfig.thunderbird.net/v1.1/${domain}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const xml = await res.text();
      const parsed = parseAutoconfigXml(xml);
      if (parsed) return parsed;
    } catch { continue; }
  }
  return null;
}

function parseAutoconfigXml(xml) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "text/xml");
    const incoming = doc.querySelector(
      'incomingServer[type="imap"], incomingServer[type="IMAP"]'
    );
    if (!incoming) return null;

    const hostname = incoming.querySelector("hostname")?.textContent?.trim();
    const port = parseInt(incoming.querySelector("port")?.textContent?.trim() || "993", 10);
    const ssl = incoming.querySelector("socketType")?.textContent?.trim()?.toUpperCase();

    if (!hostname) return null;

    return {
      host: hostname,
      port,
      tls: ssl === "SSL" || ssl === "TLS" || port === 993,
      label: hostname,
    };
  } catch {
    return null;
  }
}

/* ── MX Lookup via Google DoH ─────────────────────────────────── */

async function tryMxLookup(domain) {
  const res = await fetch(
    `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
    { signal: AbortSignal.timeout(5000) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const answers = data.Answer || [];
  if (!answers.length) return null;

  // Sort by priority (lowest = preferred)
  const sorted = answers
    .filter(a => a.type === 15)
    .sort((a, b) => {
      const pa = parseInt(a.data.split(" ")[0]) || 0;
      const pb = parseInt(b.data.split(" ")[0]) || 0;
      return pa - pb;
    });

  const topMx = sorted[0]?.data?.split(" ")[1]?.toLowerCase()?.replace(/\.$/, "");
  if (!topMx) return null;

  // Match MX against known patterns
  for (const [pattern, settings] of Object.entries(MX_TO_IMAP)) {
    if (topMx.includes(pattern)) return { ...settings };
  }

  return null;
}

/* ── Server verification via proxy ────────────────────────────── */

async function verifyImapServer(proxyUrl, host, port, tls) {
  const res = await fetch(`${proxyUrl}/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host, port, tls }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.reachable === true;
}
