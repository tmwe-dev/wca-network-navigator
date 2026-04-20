

## Obiettivo
Pagina di test `/v2/ai-staff/email-forge` con **3 pannelli affiancati** che mostrano in tempo reale come l'Oracolo costruisce il prompt e cosa produce.

## Layout

```text
┌────────────────────────────────────────────────────────────────────┐
│  HEADER: Email Forge — Lab pubblico del prompt                     │
│  [Partner picker] [Contatto] [Quality: fast/standard/premium] [▶]  │
├──────────────┬──────────────────────────────┬──────────────────────┤
│  ORACOLO     │   PROMPT ASSEMBLATO          │   RISULTATO          │
│  (sinistra)  │   (centro)                   │   (destra)           │
│              │                              │                      │
│  Riusa       │  ─ SYSTEM PROMPT             │  ─ Subject           │
│  OraclePanel │    (collapsible, syntax-hl)  │  ─ Body (HTML)       │
│  esistente   │  ─ USER PROMPT               │  ─ Preview rendered  │
│              │    16 blocchi ETICHETTATI    │  ─ Tab "Plain"       │
│  + chip      │    e collapsible:            │                      │
│  "Ricarica   │    • Mittente                │  ─ Footer:           │
│  con queste  │    • Partner                 │    Modello, tokens,  │
│  scelte"     │    • Contatto                │    credits, latency  │
│              │    • Interlocutor            │                      │
│              │    • Relationship            │  ─ Context Summary   │
│              │    • History                 │    (riusa            │
│              │    • Branch                  │    OracleContextPanel│
│              │    • MetInPerson             │    già esistente)    │
│              │    • CachedEnrichment        │                      │
│              │    • Documents               │                      │
│              │    • StylePrefs              │                      │
│              │    • EditPatterns            │                      │
│              │    • ResponseInsights        │                      │
│              │    • ConvIntel               │                      │
│              │    • CommercialBlock         │                      │
│              │    • Goal+BaseProposal       │                      │
│              │                              │                      │
│              │  [Copy] [Download .txt]      │                      │
└──────────────┴──────────────────────────────┴──────────────────────┘
```

## Implementazione (riuso massimo, no duplicazione)

### 1. Backend — debug mode non-breaking
**`supabase/functions/generate-email/index.ts`** (~10 LOC)
- Accetta param opzionale `_debug_return_prompt: true`.
- Quando attivo, ritorna nel JSON anche `_debug: { systemPrompt, userPrompt, blocks: [...labeled...] }`.
- Zero impatto su produzione (param opt-in).

**`supabase/functions/generate-email/promptBuilder.ts`** (~20 LOC)
- Refactor minimo: invece di concatenare direttamente le stringhe blocco-per-blocco, le accumula in un array `[{label, content}]` e poi le joina.
- Esporta sia il prompt finale sia l'array etichettato.
- Tutti i call-site esistenti continuano a funzionare (joina internamente).

### 2. Frontend — nuova pagina

**Nuovi file (3):**
- `src/v2/ui/pages/EmailForgePage.tsx` — layout 3 colonne (riusa `ResizablePanelGroup` shadcn).
- `src/v2/ui/pages/email-forge/PromptInspector.tsx` — pannello centrale: lista blocchi etichettati con accordion, syntax-highlight light, copy/download.
- `src/v2/ui/pages/email-forge/ResultPanel.tsx` — pannello destro: subject, body HTML preview, tab Plain, footer con metriche, riusa `OracleContextPanel`.

**Hook:**
- `src/v2/hooks/useEmailForge.ts` — chiama `generate-email` con `_debug_return_prompt: true`, gestisce loading/error, espone `prompt`, `result`, `debug`.

**Riuso diretto (zero modifiche):**
- `OraclePanel` (sinistra) — già pronto, accetta `onGenerate(config)`.
- `OracleContextPanel` (dentro ResultPanel) — già mostra warmth/playbook/KB sections.
- `RecipientSnapshotHeader` — opzionale, in header.

**Routing:**
- `src/v2/routes.tsx`: aggiungo `<Route path="ai-staff/email-forge" element={guardedPage(EmailForgePage, "EmailForge")} />`.
- Link nel menu AI Staff (icona `Wand2`, label "Email Forge").

## Flusso utente
1. Sceglie partner+contatto dal picker (oppure usa "Test partner generico").
2. Configura nel pannello sinistro: tipo email, tono, KB on/off, deep search, descrizione.
3. Clicca **Genera** → loader.
4. Pannello centrale popola: vede ogni blocco ETICHETTATO e può espanderlo per ispezionarne il contenuto reale (es. "History → 3 email passate, 250 char").
5. Pannello destro mostra subject + body renderizzato + metriche + context summary.
6. Modifica una scelta nell'Oracolo → rigenera → vede DIFFERENZE concrete nei blocchi (es. cambiando tipo da `primo_contatto` a `follow_up` la KB cambia categorie, l'history block compare).

## Out-of-scope
- Diff visuale tra due generazioni (futura iterazione).
- Editing inline del prompt e re-run con prompt modificato (futuro: "Prompt Playground").
- Improve flow (potrei aggiungerlo in step successivo).

## Effort stimato
- Backend: ~30 LOC
- Frontend: ~350 LOC distribuite su 3 file nuovi + 1 hook + 1 riga routing
- Zero migrazioni DB, zero breaking change

