# Inventario (Fase 1) — consolidato 2026-09-02

Fonti consolidate: `.lovable/audits/complexity/` (4130 file, HEAD 9bfcb62), `scripts/gen-edge-catalog.mjs`, `src/v2/routes.tsx`, `src/v2/navigation/menuItems.ts`.

Regola: niente entra nell'analisi se non è qui; niente esce da qui senza una decisione scritta in `verdetti.md`.

## 1. Punti di ingresso

| Tipo | Conteggio | Dove |
| ---- | --------- | ---- |
| Rotte UI v2 | 37 pagine (`src/v2/routes.tsx`), 66 voci menu (`src/v2/navigation/menuItems.ts`) | router React |
| Edge functions | 154 (`supabase/functions/`) | HTTP / invoke / cron |
| Cron / lavori pianificati | pg_cron su `email-cron-sync`, drain loop, sync WA/LI | migration + `cronGuard.ts` |
| Webhook / bridge estensioni | bridge WA, LinkedIn, email, partner-connect, ra-extension | `public/*-extension/`, edge `*-bridge*` |
| Comandi AI | Command tools (`src/v2/agent/runtime/tools/`) | planner Gemini |

## 2. Superficie dati

- Tabelle business: ~15 con soft-delete globale (trigger), `partners`, `partner_contacts`, `activities`, `outreach_*`, `email_*`, `kb_entries`, `ai_*`, `usage_events` (nuova, Bonifica).
- Migrations: 416 file / ~25k righe. Consolidamento vietato in P0.
- Storage: bucket allegati/export.

## 3. Uscite

- Email (send-email + layout condiviso), WhatsApp, LinkedIn, voce (ElevenLabs), notifiche in-app.
- Scritture esterne: WCA bridge, ReportAziende, IMAP (BODY.PEEK obbligatorio).

## 4. Risorse esterne

- OpenAI (BYOK via `aiCallShim`), Google Gemini (planner Command), ElevenLabs (vocale), IMAP server, Google favicon/FlagCDN (solo UI), WCA bridge, estensioni Chrome.

## 5. Interruttori

- `VITE_REMOTE_LOG_ENDPOINT` (sink remoto), flag tema/tema visivo (`themeRegistry`), scope AI (`aiScopeRouter`), hard guards (`hardGuards.ts`), whitelist auth (`authorized_users`).

## 6. Dipendenze

- Versioni esatte in `snapshot-*.json` (sezioni `dependencies` / `devDependencies`), rigenerate a ogni batch.

## 7. Obblighi

- RLS su tutte le tabelle esposte; soft-delete globale (mai DELETE fisico); editorial review obbligatorio su ogni messaggio in uscita; audit log AI (`AI_INVOCATION_CHARTER`); prompt versionati; IMAP PEEK (no auto-read).

## Candidati noti all'analisi (dall'audit statico — NON sono verdetti)

- 8 cluster duplicati esatti, 9 near-duplicati → `verdetti.md` sezione A.
- 473 orfani candidati (0 importer statici) → triage con Lente 2/3, primi 20 in `quarantena.md`.
- 45 overlap basename v1↔v2 → triage 1-a-1, nessun taglio automatico.
- 82 file DAL bypass (185 hit), 977 `any`, 527 `console.*` → debito tracciato, non in questo giro.
