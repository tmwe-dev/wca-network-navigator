// Strumenta le edge functions Q2 con trackUsage (fire-and-forget).
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const Q2 = `agent-audit, agent-loop, agent-simulate, agentic-decide, ai-deep-search-helper,
ai-match-business-cards, ai-monitor, ai-tracking-healthcheck, ai-utility, analyze-email-edit,
analyze-import-structure, analyze-partner, apply-classification-insight, backfill-email-rules,
calculate-lead-scores, calculate-partner-quality, check-external-db, check-inbox-booking,
confirm-injection-review, consume-credits, country-kb-generator, decision-dashboard,
deduplicate-contacts, deduplicate-partners, dispatch-integrity-check, email-imap-proxy,
funnemail-backfill-inbound, funnemail-send-autoresponder, generate-content, get-ra-credentials,
get-wca-credentials, imap-list-folders, improve-email, kb-index-map, kb-ingest-document,
kb-intake-analyze, learn-from-group-correction, linkedin-profile-api, list-elevenlabs-voices,
log-action, manage-email-folders, mission-executor, parse-business-card, parse-profile-ai,
process-ai-import, process-download-job, process-email-queue, prompt-registry-drift-check,
recalculate-partner-quality, replay-domain-events, response-pattern-aggregator, review-message,
save-correction-memory, save-ra-prospects, save-wca-contacts, send-linkedin, send-whatsapp,
simulate-funnemail-classify, sync-business-cards, translate-text, wca-country-counts`
  .split(",").map(s => s.trim()).filter(Boolean);

const done = [], skipped = [], failed = [];

for (const name of Q2) {
  const file = `supabase/functions/${name}/index.ts`;
  if (!existsSync(file)) { failed.push(`${name}: file mancante`); continue; }
  let src = readFileSync(file, "utf8");
  if (src.includes("trackUsage(")) { skipped.push(name); continue; }

  // 1) import dopo l'ultimo import in testa
  const importLine = `import { trackUsage } from "../_shared/usageTrack.ts";\n`;
  const importMatches = [...src.matchAll(/^import .*$/gm)];
  if (!importMatches.length) { failed.push(`${name}: nessun import trovato`); continue; }
  const lastImport = importMatches[importMatches.length - 1];
  src = src.slice(0, lastImport.index + lastImport[0].length) + "\n" + importLine.trimEnd() + src.slice(lastImport.index + lastImport[0].length);

  // 2) chiamata subito dopo l'apertura dell'handler serve
  const call = `\n  trackUsage("${name}", "quarantine", { note: "Q2 bonifica, scadenza 2026-10-02" });`;
  const serveRe = /(Deno\.serve|serve)\(\s*(async\s*)?(\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/;
  const m = src.match(serveRe);
  if (!m) { failed.push(`${name}: handler serve non trovato`); continue; }
  const insertAt = m.index + m[0].length;
  src = src.slice(0, insertAt) + call + src.slice(insertAt);
  writeFileSync(file, src);
  done.push(name);
}

console.log(JSON.stringify({ instrumentate: done.length, giaFatte: skipped.length, fallite: failed }, null, 2));
