# Command Co-Pilot: pop-up flottante che guida e agisce nella piattaforma

## Obiettivo
Trasformare Command da "pagina dedicata" a **assistente vocale persistente** che:
- Resta sempre disponibile come bolla flottante draggable su tutte le route V2
- Naviga al posto tuo, apre modali, applica filtri, evidenzia elementi
- Chiede conferma vocale solo per azioni distruttive (invio email, salvataggi, eliminazioni)
- Sa "dove portarti" leggendo una mappa intent→route editabile da Prompt Lab

## Architettura

```text
┌──────────────────────────────────────────────────┐
│  FloatingCoPilot (singleton in App.tsx)          │
│  ├─ Bolla 64px draggable (posizione persistita)  │
│  ├─ Espansa: pannello 360x500 con voce + log     │
│  └─ Mai smontata durante navigazione             │
└──────────────────────────────────────────────────┘
                    │
                    ▼ usa stesso useCommandRealtimeVoice
┌──────────────────────────────────────────────────┐
│  Client Tools registrati su ElevenLabs Agent     │
│  ├─ navigate_to(intent | path)                   │
│  ├─ open_modal(name, params)                     │
│  ├─ apply_filter(scope, filters)                 │
│  ├─ highlight_element(selector, hint, duration)  │
│  ├─ confirm_destructive(action_label) → user OK  │
│  └─ ask_brain (esistente)                        │
└──────────────────────────────────────────────────┘
                    │
                    ▼ emette window event
┌──────────────────────────────────────────────────┐
│  ai-ui-action bus (già esistente, esteso)        │
│  Route handlers ascoltano e reagiscono           │
└──────────────────────────────────────────────────┘
                    │
                    ▼ risolve intent→destinazione
┌──────────────────────────────────────────────────┐
│  ui_navigation_map (DB, editabile Prompt Lab)    │
│  intent_key | path | default_filters | modal     │
│  description | examples (per match AI)           │
└──────────────────────────────────────────────────┘
```

## Cosa costruisco

### 1. DB: tabella `ui_navigation_map`
Migration con:
- `intent_key` (slug univoco, es. `network.italy.hot_leads`)
- `label` (nome leggibile)
- `description` (per matching AI)
- `examples` (text[] di frasi tipiche)
- `path` (es. `/v2/network/IT`)
- `default_filters` (jsonb, es. `{"leadStatus":"hot"}`)
- `modal` (nullable, nome modale da aprire)
- `category` (network, crm, outreach, prompt-lab, settings…)
- `requires_confirmation` (bool)
- RLS: tutti gli operatori autenticati leggono, solo admin scrive

Seed iniziale con ~30 intent coprendo le destinazioni V2 più usate (NetworkPage per ogni network principale, BCA, CRM contatti, Outreach Queue, Pipeline, Prompt Lab tabs, Email Intelligence, Staff Direzionale, Sherlock).

### 2. Singleton `FloatingCoPilot` in App.tsx
- Component nuovo `src/v2/ui/copilot/FloatingCoPilot.tsx`
- Posizione draggable persistita in `localStorage`
- Due stati: bolla compatta (microfono + indicatore voce) ed espansa (controlli completi + ultimi messaggi + log azioni)
- Si nasconde automaticamente su `/auth` e `/v2/command` (dove c'è già l'esperienza piena)
- Toggle globale on/off da topbar e da memoria utente

### 3. UI Action Bus esteso
- Estendo `src/v2/lib/uiActionBus.ts` con 4 nuovi tipi azione: `navigate`, `open_modal`, `apply_filter`, `highlight`
- `App.tsx` monta un listener globale che gestisce navigate (via useNavigate) e highlight (overlay con alone pulsante)
- Le pagine target espongono handler per `open_modal` e `apply_filter` tramite contesto leggero `CoPilotContext`

### 4. Client tools voce
Aggiungo in `useCommandRealtimeVoice.ts` 5 client tools che ElevenLabs può invocare:
- `navigate_to({ intent_key?, path? })` - se intent_key, lookup in `ui_navigation_map`
- `open_modal({ name, params })`
- `apply_filter({ scope, filters })`
- `highlight_element({ description })` - usa AI per risolvere description→selector dal DOM corrente
- `request_confirmation({ action_label })` - mostra dialog, attende click utente, ritorna OK/cancel

Tutti i tool emettono `ai-ui-action` event e ritornano risultato sincrono al modello.

### 5. Edge function `resolve-ui-intent`
Nuova edge function con scope `command`:
- Input: testo libero utente o `intent_key`
- Logica: se intent_key esatto → lookup DB. Se testo → embedding match su `ui_navigation_map.description + examples` (top-3) + AI re-rank
- Output: `{ path, default_filters, modal, requires_confirmation, confidence }`
- Usata dal tool `navigate_to` quando l'AI passa solo un'intenzione

### 6. Pagina Prompt Lab → tab "Navigation Map"
- Nuovo tab in `/v2/prompt-lab` per CRUD su `ui_navigation_map`
- Form: intent_key, label, descrizione, esempi, path picker, filtri JSON, modale
- Bottone "Test" che simula la navigazione

### 7. ElevenLabs Agent: aggiornamento prompt e tools
Documento `docs/PROMPT_11LABS_COMMAND.md` aggiornato con:
- Nuovi 5 client tools (schema + esempi)
- Nuove regole di comportamento ("se l'utente chiede di vedere/aprire/filtrare X, usa navigate_to o apply_filter prima di descrivere a voce")
- Pattern di conferma per azioni distruttive

### 8. Memoria
Nuovo memory file `mem://features/floating-copilot-v1` con:
- Architettura, vincoli (singleton, no su /auth, /v2/command)
- Lista client tools e governance ai-ui-action

## Cosa NON tocco
- Estensione browser: nessuna modifica. Useremo l'estensione SOLO per pagine esterne (WCA/WA/LI), come già fa, attraverso i tool esistenti.
- Logica voce ElevenLabs core: resta `useCommandRealtimeVoice`, riusato dal pop-up.
- Tool DB esistenti (`get_partner_detail`, `search_contacts`, ecc.): restano invariati, già rifatti nei turni precedenti.

## Sicurezza
- `requires_confirmation=true` → tool `request_confirmation` obbligatorio prima di emettere azione
- Hard guard lato client: azioni `apply_filter`/`open_modal` whitelist per route corrente
- `ai_scope_registry`: aggiunti i 5 nuovi tool sotto scope `command` con `requires_user_present=true`

## File toccati
**Nuovi**
- `supabase/migrations/<ts>_ui_navigation_map.sql`
- `supabase/functions/resolve-ui-intent/index.ts`
- `src/v2/ui/copilot/FloatingCoPilot.tsx`
- `src/v2/ui/copilot/CoPilotBubble.tsx`
- `src/v2/ui/copilot/CoPilotPanel.tsx`
- `src/v2/ui/copilot/HighlightOverlay.tsx`
- `src/v2/ui/copilot/CoPilotContext.tsx`
- `src/v2/hooks/useCoPilotTools.ts`
- `src/v2/ui/pages/prompt-lab/tabs/NavigationMapTab.tsx`
- `src/data/uiNavigationMap.ts` (DAL)
- `mem/features/floating-copilot-v1.md`

**Modificati**
- `src/App.tsx` (monta FloatingCoPilot + listener globale)
- `src/v2/ui/pages/command/hooks/useCommandRealtimeVoice.ts` (aggiunge 5 client tools)
- `src/v2/lib/uiActionBus.ts` (nuovi tipi azione)
- `src/lib/queryKeys.ts` (chiavi navigation map)
- `docs/PROMPT_11LABS_COMMAND.md` (nuovi tool + regole)
- `mem/index.md` (riferimento)

## Test di accettazione
1. Da qualsiasi route V2, dico "portami sui partner italiani caldi" → mi navigo su `/v2/network/IT` con filtro lead caldi applicato
2. Da `/v2/crm`, dico "apri il dettaglio di [nome contatto]" → si apre modale dettaglio contatto
3. Dico "evidenzia il bottone per inviare email" → alone pulsante sul bottone giusto
4. Dico "manda l'email" → AI invoca `request_confirmation`, vedo dialog, conferma, parte
5. Bolla resta visibile cambiando 5 route diverse senza interrompere la conversazione
6. Da Prompt Lab aggiungo nuovo intent_key, lo provo subito a voce senza redeploy