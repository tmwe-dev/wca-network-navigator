
# Piano operativo — Audit, canonical routes e cleanup sovrapposizioni

Sorgente: `mem://reference/audit-debug-riparazione-2026-05-06`.
Approccio: **redirect + rimozione fisica**, ma SOLO dopo backup completo e creazione versione "old" navigabile.
Verifica tra fasi: `tsc --noEmit` + report scritto. Procedo automaticamente, ti fermo solo se tsc rompe o se trovo ambiguità di scope.

---

## Fase 0 — Backup & versione "old" (prerequisito intoccabile)

Obiettivo: avere una via di ritorno completa **prima** di toccare una sola route.

1. Snapshot del repo in `archive/pre-cleanup-2026-05-06/` (copia ricorsiva di `src/v2/ui/pages`, `src/components`, `src/v2/routes.tsx`, `src/v2/ui/templates/sidebar/*`, `src/components/SettingsPage*`, `src/components/ConfigSection*`, `OrphanPagesNav`, `NavMenuPopover`).
2. Esportazione dump dei prompt/route-related: query a `operative_prompts`, `ai_scope_registry`, `system_doctrine` salvata in `/mnt/documents/audit/db-dump-2026-05-06.json`.
3. Versione "old" navigabile: nuovo gruppo di route `/v2-legacy/*` che monta i componenti destinati alla rimozione (ConfigSection, PipelineSection, EmailForge legacy, Calendar legacy, Inbox legacy duplicata) prima di toglierli dal menu/route principali. Accesso solo via deep-link, **non in menu**, banner "Legacy — sarà rimosso".
4. Tag git tramite messaggio Lovable "snapshot pre-cleanup" (l'utente avrà il rollback via History).

Output: `/mnt/documents/audit/00-backup-manifest.md` con elenco file copiati e mapping `legacy → canonical`.

Verifica: `tsc --noEmit`.

---

## Fase 1 — Inventario reale (read-only, niente modifiche)

Obiettivo: matrice oggettiva menu × routes × redirect × orfane.

1. Parsing di `src/v2/routes.tsx` → estrai `path`, `element`, `redirect`.
2. Parsing di `navItemsDef`, `OrphanPagesNav`, `NavMenuPopover`, `SettingsPage.DEV_PAGE_GROUPS`, `Sidebar` mobile.
3. Cross-check: ogni voce menu → route esiste? ogni route → ha menu? quali sono solo deep-link?
4. Cataloga redirect legacy (`/v1/*`, `/pipeline/*`, `/agent-tasks`, `/agent-chat`, ecc.).
5. Output: `/mnt/documents/audit/01-route-map.md` (tabella) + `/mnt/documents/audit/01-orphans.md` (elenco pagine senza menu) + `/mnt/documents/audit/01-conflicts.md` (route presenti in più liste con label diverse).

Verifica: nessuna, è read-only.

---

## Fase 2 — Consolidamento NAVIGAZIONE (P0 del documento)

Sovrapposizione più pericolosa secondo l'utente: 5 fonti diverse di navigazione (`SettingsPage`, `ConfigSection`, `OrphanPagesNav`, `NavMenuPopover`, `SettingsPage.DEV_PAGE_GROUPS`).

1. Definisci **fonte unica** `src/v2/navigation/registry.ts`:
   - `MAIN_NAV` (le 14 voci canoniche)
   - `SECONDARY_NAV` (sotto-route Settings)
   - `DEV_NAV` (orfane / dev-only, mostrate solo in build dev o dietro flag)
   - `LEGACY_REDIRECTS` (path vecchio → canonical)
2. Refactor di `OrphanPagesNav`, `NavMenuPopover`, `SettingsPage.DEV_PAGE_GROUPS` → leggono dal registry, niente più liste hard-coded.
3. `ConfigSection` (sembra fantasma) → spostato in `archive/` se non montato; se montato in qualche route, marcato `@deprecated` e ricondotto a `SettingsPage`.
4. Rimozione fisica dei componenti duplicati che non sono più referenziati dopo lo step 2.

Verifica: `tsc --noEmit` + grep che nessuno importi i file rimossi + apertura visiva `/v2/settings` dal preview (no crash).

---

## Fase 3 — Canonical EMAIL (Leggi / Funnemail Inbox / Email Intelligence / Scrivi / Email Forge / Cestinone)

Confini target (dal documento):
- `Leggi /v2/inbox` = posta ricevuta grezza
- `Funnemail Inbox /v2/funnemail-inbox` = posta lavorata da AI
- `Funnemail /v2/email-intelligence` = regole/classificazione
- `Scrivi /v2/email` = composer operativo
- `Email Forge` = laboratorio AI (sotto `/v2/email/forge` o legacy)
- `Cestinone /v2/cestinone` = approvazioni

Lavoro:
1. Verifica con `MailRowChrome` (già adottato) che non ci siano divergenze visive.
2. `Email Forge` standalone → diventa tab dentro `/v2/email`, route legacy → redirect.
3. `Funnemail` vs `Funnemail Inbox`: copia label e descrizioni in alto-pagina per chiarire ruolo, sposta sezione "regole" da Inbox a Intelligence se duplicata.
4. Catalogo legacy redirect aggiornato in `LEGACY_REDIRECTS`.
5. Rimozione fisica componenti duplicati composer/inbox dopo aver migrato gli import.

Verifica: `tsc --noEmit` + apertura preview delle 6 pagine.

---

## Fase 4 — Canonical TEMPO/AZIONI (Agenda / Calendar / Pipeline)

Target:
- `Agenda /v2/agenda` = cosa fare oggi (action-grouping già in mem)
- `Calendar` = eventi appuntamenti veri (decidi: o vive in `/v2/agenda/calendar` o in `/v2/calendar` standalone)
- `Pipeline /v2/agenda/pipeline` = stato contatti

Lavoro:
1. `PipelineSection` legacy → redirect a `/v2/agenda/pipeline`, componente vecchio archiviato e rimosso.
2. E2E `calendar-flow.spec.ts` allineato (era marcato come potenzialmente obsoleto).
3. Decisione su Calendar: tab dentro Agenda o pagina separata. Se separata, va in `MAIN_NAV` o `DEV_NAV`?

Verifica: `tsc --noEmit` + run `e2e/agenda-flow.spec.ts` se possibile in sandbox (non bloccante).

---

## Fase 5 — Canonical AI (Agenti / AI Staff / Missioni / Prompt Lab / Prompt Reader / AI Control)

Target:
- `Agenti /v2/intelligence` = conversazione operativa
- `AI Staff /v2/staff-direzionale` = consulenti direzionali
- `Missioni` = obiettivi/automazioni
- `Prompt Lab /v2/settings/prompt-lab` = prompt/KB/governance
- `Prompt Reader /v2/prompt-reader` → valuta merge dentro Prompt Lab (tab "Reader") e redirect
- `AI Control /v2/settings/ai-control` = monitoraggio

Lavoro:
1. Decisione canonical per Prompt Reader (merge consigliato).
2. Aggiornamento `MAIN_NAV` di conseguenza (slot 13 si libera o ospita altro).
3. Redirect + rimozione del componente standalone se merge approvato.

Verifica: `tsc --noEmit`.

---

## Fase 6 — Canonical CAMPAGNE / OUTREACH (Cockpit / Campagne / Campaign Jobs / Cestinone)

Target chiarezza:
- `Cockpit /v2/cockpit` = dashboard outreach in corso
- `Campaigns /v2/explore/campaigns` = generazione campagne
- `Campaign Jobs` = monitoraggio esecuzione job (sotto Cockpit o standalone?)
- `Cestinone /v2/cestinone` = solo coda approvazione pre-invio

Lavoro:
1. Sposta job monitor sotto Cockpit (tab) se duplicato.
2. Verifica che il flusso `Scrivi → Cestinone` e `Campaigns → Jobs → Cestinone` non passino da componenti duplicati di approvazione.
3. Redirect path legacy.

Verifica: `tsc --noEmit`.

---

## Fase 7 — Hardening: smoke route + osservabilità

1. Test `e2e/app-routing-access.spec.ts` esteso: apre tutte le entry di `MAIN_NAV` + tutte le `LEGACY_REDIRECTS` e verifica che la destinazione canonical risponda.
2. Aggiorna `mem://architecture/v1-deprecation-redirect` con la nuova mappa unificata.
3. Aggiorna `docs/v2/MIGRATION_STATUS.md`.
4. Report finale `/mnt/documents/audit/07-final.md` con: cosa è stato canonicalizzato, cosa redirezionato, cosa rimosso fisicamente, cosa archiviato in `/v2-legacy/*`.

Verifica: `tsc --noEmit` + smoke route test.

---

## Vincoli rispettati lungo tutte le fasi

- **No DAL bypass**: nessuna nuova `supabase.from()` fuori da `src/data/`.
- **AI Charter**: nessuna invocazione AI diretta, solo `invokeAi()`.
- **Editorial Review**: non tocco i flussi che lo invocano, solo route/menu.
- **No physical delete su tabelle business**: solo file frontend rimossi.
- **Code lifecycle governance**: i componenti `src/components/` non utilizzati ma in sviluppo NON vengono rimossi a meno che siano nella matrice esplicita di Fase 2/3/4/5/6.
- **invokeAi/MailRowChrome**: già canonicizzati, non si tocca la business logic.

## Cosa NON è in questo piano

- Nessuna modifica a check-inbox / email-imap-proxy / mark-imap-seen.
- Nessuna modifica RLS o schema DB.
- Nessuna modifica ai prompt operativi (gestiti da Prompt Lab a runtime).
- Nessun refactor opportunistico di hooks o DAL non legato alle route.

## Stima

- Fase 0: 1 step (backup + versione old).
- Fasi 1-7: ~2-3 step ciascuna.
- Tempo: lungo, ma incrementale e rollbackabile fase per fase.

## Punto di stop esplicito

Tra Fase 6 e Fase 7 ti chiederò conferma esplicita prima di rimuovere fisicamente i componenti delle fasi 3-6 (ultima finestra di reversibilità prima del cleanup definitivo).
