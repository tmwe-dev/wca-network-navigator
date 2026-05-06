# Finder API — clone di Command per query TMWE/Findair

## Obiettivo
Pagina `/v2/finder-api` che riproduce la UX di Command ma è dedicata a **interrogare l'API TMWE/Findair** già attiva via OAuth. L'agente conversa, traduce richieste in chiamate ai 6 endpoint whitelisted del proxy, mostra risultati nel canvas, propone azioni, e quando l'interpretazione fallisce **suggerisce un articolo KB dedicato** salvabile in una nuova tabella consultabile sia dall'utente sia dall'agente stesso.

## Scope

**Cosa fa l'agente Finder API:**
1. Riceve richieste in linguaggio naturale (es. "tracking AWB 123-45678", "le mie spedizioni di marzo", "cerca SPL Cargo nella rubrica").
2. Sceglie l'op TMWE giusta dalla whitelist `TMWE_OPS` e costruisce i parametri.
3. Chiama `tmwe-proxy` via DAL `src/data/tmwe.ts` (zero nuovo accesso DB).
4. Renderizza il risultato nel canvas riusando `LiveTableCanvas` / `CardGridCanvas` / `TimelineCanvas`.
5. Su errori o output ambiguo: propone una **KB card** ("Aggiorno la knowledge base?") che, una volta approvata, finisce in `finder_api_kb` ed è automaticamente disponibile come contesto nelle prossime invocazioni.
6. Permette azioni post-risultato (es. apri dettaglio AWB, riusa risultato per nuova query) tramite gli stessi `BulkAction` di Command.

**Cosa NON fa:**
- Non manda email, non crea partner, non tocca CRM, niente outreach.
- Non aggiunge nuove operazioni TMWE (whitelist resta deterministica).
- Non scrive token, non bypassa il proxy, non parla con `findair.net` direttamente.
- Non duplica logica di Command — riusa hook e componenti.

## Architettura file

```text
src/v2/ui/pages/
  FinderApiPage.tsx                       ← clone sottile di CommandPage
  finder-api/
    constants.ts                           ← agentName, system prompt, scenarios
    hooks/
      useFinderApiSubmit.ts                ← variante di useCommandSubmit (scope=finder_api)
    tools/
      tmweProfile.ts                       ← wrapper su tmweGetMyProfile
      tmweTrack.ts                         ← wrapper su tmweTrack
      tmweShipments.ts                     ← wrapper su tmweListMyShipments
      tmweUnified.ts                       ← wrapper su tmweUnifiedShipment
      tmweRubrica.ts                       ← wrapper su tmweRubricaSearch
      tmweHealth.ts                        ← wrapper system.health (read-only)
      proposeKbEntry.ts                    ← suggerisce nuovo articolo KB
src/data/
  finderApiKb.ts                           ← DAL nuova tabella finder_api_kb
src/lib/queryKeysParts/
  finderApi.ts                             ← chiavi per KB e conversazioni
src/lib/ai/invokeAi.ts                     ← aggiunto literal type "finder_api"
```

Componenti UI Command **riusati 100% senza fork**: `CommandHistory`, `CommandInput`, `CommandOutput`, `CommandThread`, `ConversationSidebar`, `VoicePresence`, `FloatingDock`, canvas live.

## Nuovo agente AI

**Riuso vs nuovo:** crea un nuovo agente DB perché il dominio (Findair API) è specifico e va tenuto separato dai venditori/operatori esistenti.

- INSERT in `agents` (`name: "Finder API"`)
- INSERT in `agent_personas` con tono tecnico-conversazionale: spiega cosa sta facendo, mostra quale endpoint userà ("Sto chiamando `shipment.list` con filtro mese=marzo"), ammette quando non capisce e propone una KB card.
- INSERT in `agent_capabilities`: `mode=read_only`, `model=google/gemini-2.5-pro`, `timeout=20000`, `tool_whitelist` = i 7 tool tmwe* + `proposeKbEntry`.
- Persona ispirata a Bruce/Robin (formato già esistente) ma adattata.

## Scope AI

- Nuovo scope `finder_api` registrato in `ai_scope_registry` (descrizione: "Finder API — query conversazionali su TMWE/Findair via proxy whitelistato").
- Aggiungo letterale `"finder_api"` al type `AiScope` in `src/lib/ai/invokeAi.ts`.
- Tutte le invocazioni dalla pagina passano da `invokeAi({ scope: "finder_api", source: "FinderApiPage" })` (charter rispettato).

## Tabella KB dedicata

```sql
CREATE TABLE public.finder_api_kb (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  trigger_query TEXT,            -- query utente che ha generato la card
  trigger_op TEXT,               -- op TMWE invocata
  trigger_error TEXT,            -- errore o ambiguità rilevata
  tags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending'   -- pending|approved|archived
    CHECK (status IN ('pending','approved','archived')),
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
```

- RLS: SELECT a tutti gli autenticati (memoria "Visibilità Globale Agenti"); INSERT autenticati; UPDATE solo `created_by` o admin; DELETE intercettato dal trigger soft-delete globale (memoria "No Physical Delete").
- Realtime abilitato sulla tabella per riflettere approvazioni live.
- Indice GIN su `tags` e indice su `status` per filtri rapidi.

## Iniezione KB nel contesto agente

Estendo `_shared/operativePromptsLoader.ts` (o, se più pulito, creo helper dedicato `_shared/finderApiKbLoader.ts`) per prependere alle messaggi di sistema le KB con `status='approved'` (top 20 per recency). Così l'agente Finder migliora **senza redeploy** ad ogni approvazione.

## Flusso "errore → propose KB"

1. Tool TMWE ritorna `ok=false` o l'AI marca il risultato come "non interpretabile".
2. L'agente costruisce un draft `{title, body, trigger_*}` e lo presenta nel canvas con due CTA: **Salva in KB** / **Scarta**.
3. Su Salva → INSERT in `finder_api_kb` con `status='pending'` via DAL `proposeKbEntry`.
4. Toast con link a `/v2/finder-api/kb` (lista pending → approve/archive). Pagina KB minimale opzionale **fuori scope di questa task** se vuoi limitare; alternativamente pannello laterale.

→ Domanda 1 (vedi sotto) per decidere.

## Routing

- `src/v2/routes.tsx`: aggiungo `<Route path="finder-api" element={guardedPage(FinderApiPage, "FinderAPI")} />`.
- Voce sidebar (`AppSidebar` v2) con icona `Search` o `Plug` accanto a Command.
- `conversation_kind = "finder_api"` in `useConversation` per separare la history dalle altre.

## Cosa NON tocco
- `tmwe-proxy`, `tmwe-oauth-*`, `_shared/tmweClient.ts` — già produttivi.
- `CommandPage` e cartella `command/` — niente fork, solo import dei componenti.
- `check-inbox`, `email-imap-proxy`, `mark-imap-seen` (memoria).
- Editorial review (non si producono email).

## Migrazione DB unica
1. CREATE TABLE `finder_api_kb` + RLS + trigger updated_at + realtime.
2. INSERT in `ai_scope_registry` (`finder_api`).
3. INSERT in `agents`, `agent_personas`, `agent_capabilities` per "Finder API".

## Verifiche prima di "fatto"
- /v2/finder-api renderizza identica a Command ✓
- Conversazione: query "tracking 123" → tool `tracking.byAwb` → canvas timeline ✓
- Errore TMWE → propone KB card, INSERT funziona ✓
- KB approvata appare nel prompt agente al turno successivo (verifica con re-run) ✓
- Whitelist hard guard: tentativo di usare tool fuori dai 7 → blocco + log ✓
- Log su `ai_interaction_log` con `scope=finder_api` ✓
- Nessun file `command/` modificato, nessuna regressione su `/v2/command` ✓
- TypeScript build verde, tipi `AiScope` aggiornati ✓

---

## Domande prima di partire

1. **Pagina di gestione KB approvazioni**: la includo nello stesso scope (mini-pannello in sidebar di Finder API) o la rimando a una task dedicata?
2. **Nome agente**: confermi "Finder API" o preferisci altro (es. "Findair Oracle", "API Sherpa")?
