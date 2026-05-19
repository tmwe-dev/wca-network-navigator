
# Piano: Lean Mode + Prompt Lab ridisegnato + Comunicazioni unica

Obiettivo: rendere il sistema snello, focalizzato e leggibile **senza cancellare codice**, usando un feature flag reversibile. Tre interventi atomici, in sequenza, ognuno reversibile.

---

## Principio guida

Tutto passa da un singolo flag `VITE_LEAN_MODE=true` (default ON). Niente DROP di tabelle, niente eliminazione file. Solo:
- nascondere voci di menu
- consolidare rotte sotto un guscio unico
- ridisegnare il Prompt Lab in 5 tab invece di 20+

Se serve tornare indietro: si toglie il flag, tutto riappare.

---

## Fase 1 — Lean Mode (sidebar + rotte nascoste)

**File toccati (solo lettura/scrittura mirata, no refactor):**
- `src/v2/ui/templates/navConfig.tsx` → filtra `navItemsDef` in base al flag
- `src/v2/navigation/registry.ts` → rimuove dai popover voci RA Explorer, Super Mario, AI Arena 3D, Standalone Globe, Voice agents, Mission Builder visuale, KPI Dashboard separato, AI Lab v1
- `src/lib/featureFlags.ts` (nuovo, o estende esistente) → esporta `LEAN_MODE`
- `.env.example` → documenta `VITE_LEAN_MODE`

**Sidebar finale (7 voci):**
```
Command       /v2/command
Esplora       /v2/explore/network
Pipeline      /v2/cockpit
Comunicazioni /v2/comms          ← nuova rotta-guscio (Fase 3)
Agenda        /v2/agenda
Agenti        /v2/agents
Config        /v2/settings
```

**Voci spostate sotto Config → Avanzato (solo admin):**
- Prompt Lab (nuovo, Fase 2)
- Observability / AI Routing / Edge Metrics / AI Interaction Log
- Lab tests / KB Supervisor / Email Forge
- Finder API / Guida

**Voci nascoste a tutti (codice resta, rotte attive solo via deep-link):**
- RA Explorer, RA Scraping
- AI Arena 3D, Standalone Globe
- Super Mario (flag già spento)
- Voice agents 11Labs (Aurora/Bruce/Robin/Floating Copilot)
- Mission Builder visuale (Autopilot resta)
- KPI Dashboard separato (metriche già nel Cockpit)

**Sidebar shadcn:** sostituire l'attuale top-bar/dock con `Sidebar collapsible="icon"` laterale fissa (già richiesto nel turno precedente, lavoro già in parte fatto).

---

## Fase 2 — Prompt Lab ridisegnato (20+ tab → 5)

**Problema attuale:** 4 macro gruppi × ~20 tab + 6 sister pages = caos. Audit 2026-05-11 → 62/100.

**Nuovo Prompt Lab:** una sola pagina `/v2/prompt-lab` con **5 tab orizzontali**.

| Tab | Cosa contiene oggi sparso | Cosa fa |
|---|---|---|
| **1. Prompts** | Catalog + Operative Prompts + Email/WA/LI/Classification/Outreach prompts + Funnemail Classifier | Lista unica di tutti i prompt operativi con filtro per scope, edit inline, versioning, rollback |
| **2. Personas** | Agent Personas tab + Editor Persona | 8 agenti × identità/tono/KB filtrata |
| **3. Capabilities** | Agent Capabilities tab | Tool whitelist/blacklist, timeout, modello, modalità per agente |
| **4. Tests** | Test cases + Test runs + Simulator + Eval set Funnemail | Run regression, vedere ultime esecuzioni, dry-run simulator |
| **5. Health** | Audit + Drift + Suggestions + Proposals + Architect + Harmonizer + Refiner status | Dashboard salute: KPI prompt, cron status, suggerimenti pending, drift report |

**File toccati:**
- `src/v2/ui/pages/PromptLabPage.tsx` → ristruttura in 5 tab (i sotto-componenti esistenti restano, solo riorganizzati)
- Sister pages (`/v2/prompt-lab/atlas`, `/catalog`, `/tests`, `/proposals`, `/suggestions`, `/agent/:slug`) → restano accessibili via deep-link da dentro le 5 tab, non più voci separate di menu
- `src/v2/config/labTabs.ts` (se esiste) → SSOT dei 5 tab

**Nessun edit ai prompt esistenti, nessun edit alle edge function di governance.**

---

## Fase 3 — Comunicazioni: una sola voce

**Problema:** oggi 4 voci di menu parlano di messaggi (Inbox, Email, Funnemail Inbox, Rubrica WA, Rubrica LinkedIn, Email Intelligence). L'utente non sa dove cliccare.

**Nuova rotta:** `/v2/comms` con 5 tab interne:

| Tab | Sostituisce |
|---|---|
| **Inbox** | `/v2/inbox` (vista unificata cross-canale) |
| **Email** | `/v2/email` (composer + thread email) |
| **WhatsApp** | `/v2/rubrica/whatsapp` |
| **LinkedIn** | `/v2/rubrica/linkedin` |
| **Smistamento (Funnemail)** | `/v2/funnemail-inbox` + `/v2/email-intelligence` |

**File toccati:**
- `src/v2/ui/pages/CommsPage.tsx` (nuovo, ~80 righe) → guscio con `<Tabs>` shadcn che monta i 5 componenti pagina esistenti
- `src/App.tsx` o router V2 → aggiunge rotta `/v2/comms` + rotte `/v2/comms/:tab` per deep-link
- Vecchie rotte `/v2/inbox`, `/v2/email`, `/v2/funnemail-inbox`, `/v2/rubrica/*`, `/v2/email-intelligence` → redirect a `/v2/comms/<tab>` corrispondente (stesso pattern V1→V2)

**I componenti pagina esistenti non vengono modificati.** Solo montati dentro un guscio Tabs.

---

## Cosa NON viene toccato (zero rischio)

- Edge functions (check-inbox, journalist review, send-email, classify-*, agent-loop, ecc.)
- DB schema, RLS, trigger soft-delete
- Auth, whitelist, RBAC
- DAL (`src/data/`)
- Hard guards, AI Invocation Charter, Editorial review
- Cron jobs
- Extension bridge (WA/LI/email)
- Logica business (lead scoring, holding pattern, dedup)

---

## Verifica finale

Dopo le 3 fasi:
- `bun run build` → typecheck verde
- Smoke test manuale: login → Command → Pipeline → Comunicazioni (5 tab) → Agenda → Prompt Lab (5 tab) → Config
- Tutti i vecchi URL diretti continuano a funzionare via redirect
- Toggle `VITE_LEAN_MODE=false` riporta tutto come prima

---

## Memorie da aggiornare a fine lavoro

- `mem://ui/lean-mode-2026-05-19` (nuova) — flag, sidebar 7 voci, redirect map
- `mem://features/prompt-lab-5-tabs-2026-05-19` (nuova) — nuova IA Prompt Lab
- `mem://features/comms-unified-page-2026-05-19` (nuova) — guscio /v2/comms
- Aggiornare `mem://index.md` con i 3 nuovi riferimenti

---

## Stima

- Fase 1: ~45 min
- Fase 2: ~60 min
- Fase 3: ~30 min
- Verifica + memorie: ~15 min

**Totale: ~2.5 ore di lavoro, zero rischio business, completamente reversibile.**
