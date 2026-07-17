## Obiettivo

Audit completo e trasversale del progetto con voto numerico (scala 1–100.000) su tre assi:

1. **Funzionalità** — le voci di menu fanno ciò che promettono, i flussi end-to-end (login → esplora → outreach → email intel → cockpit) reggono, edge functions rispondono.
2. **Pulizia codice** — layering UI/hook/DAL, duplicazioni, morti (import/route/component), aderenza a SSOT (StandardPageFrame, bulkOps, aiCallShim), debito ESLint/TS.
3. **Leggerezza infrastruttura** — DB (indici, RLS, funzioni pesanti, cron), edge functions (numero, dimensione, freddo), bundle FE, query key/network, cache.

## Metodo

Per ogni asse produco:
- **Misure oggettive** (numeri raccolti da tool, non stime a occhio).
- **Findings classificati** (blocker / bug / debito / cosmetico).
- **Voto parziale 1–100.000** con motivazione trasparente della formula.
- **Voto complessivo** = media pesata (40% funzionalità, 35% pulizia, 25% infra).

### Asse 1 — Funzionalità (Playwright + edge log)

- Loop headless su tutte le 15 voci del menu con sessione TMWE reale.
- Per pagina: HTTP 200, no errori console `error`, no 4xx/5xx in network (esclusi 401 attesi), presenza H1, almeno 1 azione principale cliccabile senza crash.
- Sonde edge critiche: `manage-email-folders`, `classify-email`, `send-email`, `wca-search`, `ai-gateway-shim` — chiamata di health e verifica 2xx.
- Metriche: `pagine_verdi / 15`, `edge_verdi / N`.

### Asse 2 — Pulizia codice

- `tsgo` (typecheck) + conteggio errori/warning.
- ESLint completo: conteggio per regola, focus su `no-direct-ai-invoke`, `no-direct-bulk-op`, `no-console`.
- Debito baseline: `any`, `@ts-ignore`, `TODO`, `FIXME`.
- Codice morto: import inutilizzati, file in `archive/` referenziati, route senza voce menu, componenti mai importati (via ripgrep).
- Duplicazioni note (audit precedente): funnemail/inbox, agenti/intelligence, sherlock/deep-search.
- SSOT: quante pagine usano `StandardPageFrame` vs header custom.

### Asse 3 — Leggerezza infrastruttura

- **DB**: `supabase--slow_queries`, `supabase--db_health`, `supabase--linter`; conteggio tabelle, indici mancanti su FK, funzioni SECURITY DEFINER, trigger.
- **Edge functions**: numero totale, dimensione media, cold start (log ultimi 7g), errori.
- **AI Gateway**: `list_ai_gateway_requests` ultimi 7g — call/giorno, token medi, costo, error rate.
- **Bundle FE**: `dist/` size, chunk più grandi (`vite build --report` output analizzato via file).
- **Query centralization**: quante useQuery usano `queryKeys.ts` vs stringhe libere.

### Formula del voto (trasparente)

Ogni asse parte da 100.000 e viene decurtato:

- **Funzionalità**: −5.000 per pagina rossa, −1.500 per gialla, −8.000 per edge critica down.
- **Pulizia**: −200 per errore TS, −100 per warning ESLint, −50 per `any`, −500 per duplicazione strutturale, −2.000 per SSOT violato su >10 pagine.
- **Infra**: −300 per slow query >500ms, −500 per edge con error rate >5%, −1 punto per KB di bundle oltre 800 KB gzip, −1.000 per tabella pubblica senza RLS.

Voto complessivo = `0.40 × F + 0.35 × P + 0.25 × I`, arrotondato all'intero.

## Deliverable

Un unico documento `docs/audit/full-audit-2026-07-17.md` con:

- Sezioni per asse con tabelle di misura.
- Elenco findings per severità.
- Voto parziale + voto complessivo con spiegazione decurtazioni.
- Top 10 azioni di rientro ordinate per impatto/effort.

Nessuna modifica di codice in questo audit: solo osservazione + documento. Fix in run successive su tua conferma.

## Costi/tempo stimati

3–4 turni: (1) misure DB/edge/AI gateway + typecheck/eslint, (2) Playwright su tutte le pagine, (3) analisi bundle + codice morto, (4) scrittura documento con voti.
