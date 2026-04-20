
## Obiettivo
Trasformare Email Forge in un **Lab di Calibrazione AI** completo: oltre a editare i prompt, l'utente può ispezionare e migliorare TUTTE le fonti dati che alimentano l'AI (destinatario, deep search, KB, profilo mittente, dottrina) direttamente dalla pagina, con feedback visivo immediato dell'impatto.

## Layout target

```text
┌────────────────────────────────────────────────────────────────────────┐
│  HEADER · Email Forge — Lab AI                                         │
├──────────────┬──────────────────────────────┬─────────────────────────┤
│ ORACOLO+SEL. │   PROMPT ASSEMBLATO          │   RISULTATO             │
│ (sinistra)   │   (centro · editabile)       │   (destra)              │
│              │                              │                          │
│ • Picker     │   System Blocks              │   Subject + Body        │
│   contatto   │   User Blocks                │   Metriche              │
│   reale (Cerca│   [Rerun con modifiche]     │   Context Summary       │
│   Partner /  │                              │                          │
│   Contatto / │                              │                          │
│   BCA)       │                              │                          │
│ • Tipo email │                              │                          │
│ • Tono / KB  │                              │                          │
│ • Quality    │                              │                          │
│ • Goal       │                              │                          │
│ • [Genera]   │                              │                          │
├──────────────┴──────────────────────────────┴─────────────────────────┤
│  PANNELLO INFERIORE A TAB · "Cosa legge l'AI" (collassabile)          │
│  [Deep Search] [KB] [Profilo Mittente] [Dottrina] [Storico] [Docs]    │
└────────────────────────────────────────────────────────────────────────┘
```

## Cosa costruisco

### 1. Selettore destinatario REALE (sinistra)
Sostituisco i 3 input testo (Azienda/Nome/Paese) con un **picker compatto** che riusa `EmailComposerContactPicker` (già pronto, con tab Partner/Contatto/BCA, ricerca, country strip). 
- Modalità: tab "Partner WCA · Contatto importato · Biglietto da visita".
- Selezione singola → popola `partner_id` o `contact_id` reale, così `generate-email` carica davvero history, enrichment, BCA badges.
- Fallback "Destinatario fittizio" per test rapidi senza CRM.

### 2. Pannello inferiore "Cosa legge l'AI" (5 tab)
Barra inferiore espandibile con 5 schede, ognuna mostra esattamente cosa l'AI ha visto per QUESTA generazione + permette di intervenire:

**Tab A — Deep Search** 
Riusa `useDeepSearchRunner` + `DeepSearchCanvas` (in versione embedded inline).
- Mostra: ultimo `enrichment_data` del record selezionato (raw JSON + summary) e `deep_search_at`.
- 3 pulsanti: "Deep Search Partner", "Deep Search Contatto", "Deep Search BCA" (chiama `start([id], force=true, mode)` con il mode corretto).
- Risultati live + bottone "Re-genera mail con dati freschi".
- Indicatore "extension Partner Connect attiva/non disponibile".

**Tab B — Knowledge Base**
- Lista `kb_entries` filtrate per le `kb_categories` del tipo email selezionato (es. follow_up → vendita+negoziazione+email_modelli).
- Per ogni entry: title, category, priority, character count, toggle `is_active`, pulsante **"Modifica"** che apre dialog inline (textarea) e salva su DB.
- Bottone "Aggiungi entry" che inserisce nuova kb_entry nella categoria scelta.
- Badge "Inclusa nel prompt corrente" sulle entry effettivamente caricate da `fetchKbEntriesStrategic`.

**Tab C — Profilo Mittente** (`app_settings ai_*`)
- Form compatto su: `ai_contact_name`, `ai_contact_alias`, `ai_company_name`, `ai_company_alias`, `ai_contact_role`, `ai_email_signature`, `ai_knowledge_base` (textarea grande).
- Score readiness (sender/recipient/kb) come già calcolato in `generate-outreach`, mostrato come 3 barre.
- Salvataggio diretto su `app_settings` via DAL esistente (`upsertAppSetting`).

**Tab D — Dottrina & Procedure**
- Mostra le `kb_entries` di categoria `doctrine`/`system_doctrine`/`sales_doctrine`/`procedures` (memoria L3) caricate dall'assembler.
- Stesso pattern di Tab B (visualizza/modifica/toggle).

**Tab E — Storico interazioni**
- Per il record selezionato: ultime 10 email/chat (tabella `outreach_messages` + `channel_messages`), sender/direction, snippet 200ch.
- Read-only — serve solo a capire COSA l'AI vede nel blocco "History" del prompt.

### 3. Indicatori "in uso ora"
Sul prompt centrale, ogni blocco mostra già etichette (KB/CachedEnrichment/History…). Aggiungo un click su badge → scroll automatico al tab corrispondente del pannello inferiore evidenziato.

## Riuso massimo (zero duplicazione)
| Funzionalità | Componente esistente riusato |
|---|---|
| Picker destinatario | `EmailComposerContactPicker` + `useEmailContactPicker` |
| Deep search trigger | `useDeepSearchRunner` (già provider in AuthenticatedLayout) |
| Deep search visual | `DeepSearchCanvas` (inline, non modale) |
| Settings mittente | DAL `src/data/appSettings.ts` (`upsertAppSetting`) |
| KB CRUD | `supabase.from("kb_entries")` via nuovo piccolo hook DAL |
| Score readiness | porto formula da `generate-outreach/index.ts` lato client |

## File nuovi (8 piccoli)
- `src/v2/ui/pages/email-forge/ForgeRecipientPicker.tsx` (~80 LOC) — wrapper sul picker esistente con callback selezione singola.
- `src/v2/ui/pages/email-forge/LabBottomTabs.tsx` (~60 LOC) — shell tabs + collapse.
- `src/v2/ui/pages/email-forge/tabs/DeepSearchTab.tsx` (~120 LOC).
- `src/v2/ui/pages/email-forge/tabs/KnowledgeBaseTab.tsx` (~150 LOC).
- `src/v2/ui/pages/email-forge/tabs/SenderProfileTab.tsx` (~120 LOC).
- `src/v2/ui/pages/email-forge/tabs/DoctrineTab.tsx` (~100 LOC) — variante di KB filtrata.
- `src/v2/ui/pages/email-forge/tabs/HistoryTab.tsx` (~80 LOC).
- `src/v2/hooks/useForgeKb.ts` (~80 LOC) — list/update/toggle/insert kb_entries.

## File modificati (3)
- `src/v2/ui/pages/EmailForgePage.tsx` — aggiungo riga inferiore con `LabBottomTabs`, sposto config in `ForgeOraclePanel` riducendolo ai soli campi non-destinatario.
- `src/v2/ui/pages/email-forge/ForgeOraclePanel.tsx` — sostituisco i 3 input con `ForgeRecipientPicker`, espongo `partner_id`/`contact_id` reali.
- `src/v2/hooks/useEmailForge.ts` — passa `partner_id` reale al payload (oggi è sempre null).

## Out-of-scope (futura iterazione)
- Editing di `system_doctrine` cards complesse (solo list+toggle ora).
- Diff visivo tra due generazioni con setting diversi.
- A/B test automatico (genera 2 varianti e confronta).

## Effort stimato
~800 LOC frontend, zero migrazioni DB, zero edge function changes. Tutto leverage di codice già in produzione.
