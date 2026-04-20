# Piano-Master: Context-Aware Oracle Mentality — Multi-Superficie

## Obiettivo
Replicare la "mentalità Oracle context-aware" introdotta nell'Email Composer su tutte le superfici di interazione con i lead: Composer Email (chiusura), Composer WhatsApp, Composer LinkedIn, Partner Detail WCA, Biglietti da Visita (BCA). Tutte devono offrire: (1) Deep Search manuale on-demand, (2) Pannello "Cosa sa il sistema", (3) Coerenza Tipo+Descrizione, (4) Improve/Generate context-aware con history+commercial state.

---

## Principi architetturali (riusabili)

### A. Edge function unificata `assistant-context-summary`
Nuova edge function che restituisce il `_context_summary` per qualsiasi entità (partner_id o contact_id), riutilizzabile da:
- OracleContextPanel (Email)
- WAContextPanel (WhatsApp Composer)
- LIContextPanel (LinkedIn Composer)
- PartnerDetailContextPanel (WCA)
- BCAContextPanel (Business Card)

Ritorna: KB sezioni attive, history multicanale, warmth/touch_count, deep search status, met-in-person, playbook attivo, last interactions, suggested next action.

### B. Hook unificato `useDeepSearchTrigger`
Già creato per Composer Email. Estendiamo perché funzioni con qualsiasi `partner_id` indipendentemente dalla superficie chiamante.

### C. Componente `<ContextAwarePanel />` riusabile
Wrapper UI generico con accordion espandibile, ciuffo "stato attuale" (warmth + touch + last contact), CTA "Esegui Deep Search". Si specializza via prop `surface: 'email' | 'whatsapp' | 'linkedin' | 'partner' | 'bca'`.

### D. Generate/Improve context-aware su WA/LI
- `generate-whatsapp-message` e `generate-linkedin-message` allineate al pattern di `generate-email`: caricano partner+contact+history+commercial state+KB filtrata per canale
- `improve-whatsapp-message` e `improve-linkedin-message` (nuove edge functions) speculari a `improve-email`
- KB strategica filtrata per `kb_categories` specifiche del canale (es. `whatsapp_brevita`, `linkedin_no_subject`)

---

## Fasi implementative

### FASE 1 — Chiusura Email Composer (residua)
**File**: `EmailComposer.tsx`, `useEmailComposerState.ts`
- Wiring corretto di `recipientPartnerId` e `contextSummary` nel `EmailAIPanel`
- Snapshot destinatario nell'header (chip 🌡️ Cold/Warm + 📊 N touch + ⏱️ giorni ultimo contatto)
- Test deep search trigger end-to-end

### FASE 2 — Edge function unificata `assistant-context-summary`
**Nuovi file**: `supabase/functions/assistant-context-summary/{index.ts, contextLoader.ts}`
- Input: `{ partner_id?, contact_id?, surface: 'email'|'whatsapp'|'linkedin'|'partner'|'bca', email_type_id? }`
- Output: `_context_summary` standardizzato
- Riusa la logica di `generate-email/contextAssembler.ts` ma in modalità "solo metadata" (no LLM call)

### FASE 3 — Componente UI `ContextAwarePanel` riusabile
**Nuovi file**: `src/components/context/ContextAwarePanel.tsx`, `useContextSummary.ts`
- Sostituisce `OracleContextPanel.tsx` (che diventa thin wrapper)
- Props: `partnerId`, `contactId?`, `surface`, `emailTypeId?`
- Mostra: KB attiva, history, warmth, deep search status, playbook, met-in-person, CTA azioni

### FASE 4 — WhatsApp Composer parity
**File**: 
- `src/pages/WhatsAppComposer.tsx` (o equivalente V2)
- `supabase/functions/generate-whatsapp-message/index.ts` (refactor in stile generate-email)
- `supabase/functions/improve-whatsapp-message/index.ts` (nuovo)
**Cosa cambia**:
- OraclePanel-equivalent con: Tipo messaggio (saluto, follow-up, reminder, conferma meeting), Tono, KB toggle, Deep Search button, customGoal
- Prompt builder con vincoli WA: niente HTML, max ~600 char raccomandati, no link spam
- Coerenza Tipo+Descrizione adattata al canale
- ContextAwarePanel sotto i bottoni

### FASE 5 — LinkedIn Composer parity
**File**:
- `src/pages/LinkedInComposer.tsx` o equivalente
- `supabase/functions/generate-linkedin-message/index.ts` (refactor)
- `supabase/functions/improve-linkedin-message/index.ts` (nuovo)
**Vincoli LI specifici**:
- Niente subject (LI è inMail/messaggio)
- Hard limit 300 caratteri (rispetto policy LI memo)
- KB strategica con categorie `linkedin_specifico`, `cold_outreach`, `network_espresso`
- Stesso ContextAwarePanel + Deep Search

### FASE 6 — Partner Detail WCA: Pannello "Cosa sa il sistema"
**File**: `src/pages/PartnerDetail.tsx` o `src/v2/ui/pages/PartnerDetailPage.tsx`
- Aggiunta tab/accordion "🧠 Cosa sa il sistema" che monta `<ContextAwarePanel surface='partner' />`
- Pulsante Deep Search visibile in header partner (non solo dentro il Composer)
- Sotto deep search status: link rapidi "Genera Email / WA / LI con questo contesto"

### FASE 7 — Biglietti da Visita: 1-click follow-up post-fiera
**File**: 
- `src/pages/BusinessCards.tsx` o equivalente
- `src/components/business-cards/BCAContextDrawer.tsx` (nuovo)
**Funzionalità**:
- Su ogni card: pulsante "🚀 Genera follow-up post-fiera" che apre drawer con:
  - ContextAwarePanel `surface='bca'` (mostra evento, met_in_person, deep search)
  - Preview email pre-generata con `email_type='follow_up_bca'` (nuovo tipo)
  - Pulsante "Apri nel Composer" o "Invia subito"
- Nuovo tipo email `follow_up_bca` in `defaultEmailTypes.ts` con prompt specifico

### FASE 8 — Hardening & telemetria
- Cache `assistant-context-summary` 60s lato client (React Query)
- Tutti i `_context_summary` loggati in `ai_request_log` con metadata canale+surface
- Test suite: scenari per ogni surface (Composer Email/WA/LI cold start, Partner Detail con history, BCA fresca)

---

## Sequenza esecuzione consigliata
1. **FASE 1** (chiusura Email) — atomica, sblocca tutto il resto
2. **FASE 2 + 3** (edge unificata + componente riusabile) — fondamenta
3. **FASE 6** (Partner Detail) — riusa direttamente FASE 2+3, alto valore
4. **FASE 7** (BCA 1-click) — riusa FASE 2+3, valore commerciale altissimo
5. **FASE 4** (WhatsApp parity) — più lavoro backend
6. **FASE 5** (LinkedIn parity) — analogo a WA
7. **FASE 8** (hardening)

---

## Stima complessità (per fase)
| Fase | LoC stimati | File toccati | Edge function |
|---|---|---|---|
| 1 | ~150 | 3 | 0 |
| 2 | ~400 | 3 nuovi | 1 nuova |
| 3 | ~250 | 3 | 0 |
| 4 | ~600 | 6 | 2 (refactor + nuova) |
| 5 | ~600 | 6 | 2 (refactor + nuova) |
| 6 | ~200 | 2 | 0 |
| 7 | ~350 | 4 | 0 |
| 8 | ~200 | 5+ | 0 |

**Totale**: ~2750 LoC, 8 fasi distribuite su iterazioni successive.

---

## Decisioni utente registrate
- **Ordine**: tutto in parallelo, piano-master multi-superficie ✅
- **WA/LI parity**: completa (Deep Search + contesto + coerenza + improve) ✅
- **Deep Search**: sempre on-demand via pulsante (mai automatico in generazione) ✅
- **Improve**: sempre attivo, context-aware, con goal commerciale fisso ✅
- **Pannello contesto**: sempre presente come accordion (non nascosto dietro icona) ✅
- **Coerenza Tipo+Descrizione**: warning client-side soft (chip giallo) ✅

---

## Out of scope (esplicitamente NON in questo piano)
- Modifica estensione browser (capture URL active tab) — già confermato out-of-scope
- Voice/audio composer
- Generazione documenti allegati AI
- Modifica `check-inbox`/`email-imap-proxy` (vincolo assoluto integrità email)
