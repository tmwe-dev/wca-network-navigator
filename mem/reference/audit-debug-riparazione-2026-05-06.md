---
name: Audit Debug & Riparazione 2026-05-06
description: Sintesi documento utente "tmwe_partner_connect_debug_e_riparazione.docx" — audit menu/route/sovrapposizioni con 10 sovrapposizioni TOP e raccomandazioni canonical
type: reference
---

# Audit Debug & Riparazione (2026-05-06)

Sorgente: `tmwe_partner_connect_debug_e_riparazione.docx` (50+ pagine, caricato dall'utente).

## Menu principale (14 voci da `navItemsDef`)
1. Command `/v2/command`
2. Finder API `/v2/finder-api`
3. Finder API Catalog `/v2/finder-api/schema`
4. Vendi `/v2/explore/network`
5. Autorizza `/v2/cestinone`
6. Cockpit `/v2/cockpit`
7. Leggi `/v2/inbox`
8. Scrivi `/v2/email`
9. Agenda `/v2/agenda`
10. Funnemail `/v2/email-intelligence`
11. Funnemail Inbox `/v2/funnemail-inbox`
12. Agenti `/v2/intelligence`
13. Prompt Reader `/v2/prompt-reader`
14. Config `/v2/settings`

Sezione collassabile separata: `OrphanPagesNav` ("Tutte le pagine") + `NavMenuPopover` + `SettingsPage.DEV_PAGE_GROUPS` → **3 liste duplicate** di pagine dev/orfane.

## Verifica a 7 fasi (proposta utente)
1. Inventario menu/rotte/pagine reali (matrice menu × routes.tsx × redirect × orfane).
2. Verifica tecnica automatica (lint, typecheck, test, build, e2e, coverage).
3. Smoke test pagine (no crash, no white-screen, console OK, redirect corretti, attivazione menu, mobile/desktop, drawer globali).
4. Verifica funzionale per area business (Command, Finder, Vendi, Cestinone, Cockpit, Leggi, Scrivi, Agenda, Funnemail, Agenti, Prompt Reader, Config).
5. Matrice sovrapposizioni (stessa funzione/dato/flusso, vecchie pagine, redirect non documentati, feature nascoste/incomplete).
6. Verifica logica applicativa (email/outreach, network/partner, agenda/pipeline, agenti/AI).
7. Piano PR ordinato (route test, pulizia sovrapposizioni, refactor incrementale, osservabilità).

## TOP 10 sovrapposizioni (da pp. 47-48)
1. **SettingsPage VS ConfigSection** — strutturale, ALTA, route settings fantasma.
2. **OrphanPagesNav VS NavMenuPopover VS SettingsPage.DEV_PAGE_GROUPS** — manutenzione, ALTA.
3. **Leggi VS Funnemail Inbox** — funzionale/UX, ALTA, due inbox.
4. **Email Intelligence VS Funnemail Inbox** — UX, ALTA, regole AI vs inbox AI.
5. **Scrivi VS Email Forge** — apparente, MEDIA/ALTA, due composer.
6. **Cockpit VS Campagne** — flusso, MEDIA/ALTA.
7. **Cestinone VS Campaign Jobs** — stato operativo, MEDIA/ALTA, coda approvazione vs esecuzione.
8. **Agenda VS Calendar** — UX, MEDIA/ALTA, due calendari percepiti.
9. **Agenda Pipeline VS PipelineSection** — legacy, MEDIA.
10. **Agenti VS AI Staff VS Missioni** — tassonomia AI, MEDIA.

## Canonical proposti
- Partner WCA → `/v2/explore/network`
- Contatti CRM → `/v2/explore/contacts`
- Pipeline → `/v2/agenda/pipeline`
- Composer → `/v2/email`
- Inbox tradizionale → `/v2/inbox`
- Inbox AI → `/v2/funnemail-inbox`
- Regole email AI → `/v2/email-intelligence`
- Approvazioni → `/v2/cestinone`
- Campagne → `/v2/explore/campaigns`
- Settings → `/v2/settings`

## Confini semantici raccomandati
- Email: `Leggi` posta ricevuta · `Funnemail Inbox` posta lavorata da AI · `Funnemail` regole/intelligence · `Scrivi` composer operativo · `Email Forge` lab AI · `Cestinone` approvazione.
- Tempo: `Agenda` cosa fare oggi · `Calendar` eventi/appuntamenti · `Pipeline` stato contatti.
- AI: `Agenti` conversazione · `Missioni` automazioni · `AI Staff` consulenti direzionali · `Prompt Lab` prompt/KB · `AI Control` monitoraggio.

## Priorità verifiche (pp. 49-50)
1. Sotto-route `/v2/settings/{ai-control,ai-analytics,prompt-lab,kb,outreach-tools}` funzionano?
2. Tre liste Development allineate?
3. Navigazione completa 14 voci menu.
4. Flusso Scrivi → Cestinone.
5. Flusso Campaigns → Jobs → Cestinone.
6. Differenza Leggi vs Funnemail Inbox.
7. Agenda vs Calendar.
8. Route legacy con redirect multipli.
9. E2E Calendar obsoleto.
10. Catalogo route canonical/alias/legacy.

## Conclusione utente
"La sovrapposizione più pericolosa non è tra pagine business, ma tra strutture di navigazione e configurazione: SettingsPage, ConfigSection, OrphanPagesNav, NavMenuPopover, SettingsPage Development list, routes.tsx."
