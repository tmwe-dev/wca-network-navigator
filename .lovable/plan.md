## Obiettivo

Unificare tutte le "card informazione" dell'app (network, email, contatti, lead, agenda, BCA, conversazioni WA/LI…) su un unico template visivo derivato da `EntityRow` (quello già usato in Network), migliorato negli allineamenti. Prima applicazione concreta: le card delle email in Funnemail.

## Template canonico — `EntityRow v2`

Layout fisso a 5 colonne (allineamento verticale "centro" sulle bandiera/checkbox/azioni, "top" sui blocchi testuali multi-riga):

```text
┌────┬──────┬──────────────────────────────────────────┬─────────────────┬──────┐
│ ☑  │ 🏳   │ AZIENDA (UPPER, bold) [badge][badge]…   │ recency · città │  ⋯   │
│    │ ISO  │ Nome Persona · Ruolo · email/telefono   │ canali · score  │      │
│    │      │ ── (solo email) preview 2 righe ──      │ extra meta      │      │
│    │      │ extra rows opzionali (a sinistra,        │                 │      │
│    │      │ rientrate per allineamento)              │                 │      │
└────┴──────┴──────────────────────────────────────────┴─────────────────┴──────┘
  44     56                  flex (min 0)                     200          48
```

Regole:
- **Col 1 (checkbox)**: centrato verticalmente, stessa larghezza ovunque.
- **Col 2 (bandiera + ISO)**: centrata, cliccabile per filtro paese (già fatto in Network).
- **Col 3 — title block** (allineato a sinistra, può avere più righe rientrate):
  - Riga 1: **AZIENDA in MAIUSCOLO**, bold, troncata; a destra del nome i **badge** (WCA, BCA, Cliente, lead-status, urgency, "📅 In agenda", categoria suggerita…).
  - Riga 2: **Nome persona · Ruolo · email/telefono** in tono muted.
  - Riga 3 (solo dove ha senso, es. email): **preview 2 righe** del corpo / motivo del contatto, troncato con `line-clamp-2`.
  - Righe extra opzionali (es. tag, allegati, link), tutte rientrate sotto il titolo.
- **Col 4 (meta destra ma allineata a sinistra del proprio blocco)**: recency, città, canali, score, extra meta — più righe.
- **Col 5 (azioni)**: solo `⋯` centrato verticalmente, dropdown con azioni contestuali.

Tono colorato della striscia laterale già presente (`wca/crm/bca/neutral`) → estendere a `email` (primary), `lead`, `agenda`, `bca` mantenendo lo stesso pattern.

## Interventi

### 1. Hardening del template (`src/v2/ui/atoms/EntityRow.tsx`)
- Aggiungere slot opzionale `previewSlot` (2 righe `line-clamp-2`) sotto `subTitleSlot`, nella col 3.
- Aggiungere slot opzionale `extraRowsSlot` (lista di righe meta aggiuntive in col 3, rientrate).
- Allineamento: la col 1/2/5 restano `items-center`; la col 3 diventa `items-start` quando ci sono `previewSlot` o `extraRowsSlot` per evitare il "carattere fluttuante".
- Confermare le regole responsive `compact` esistenti.
- Estendere `EntityRowTone` con `email`, `lead`, `agenda` (colori dal design system: `primary`, `chart-2`, `chart-3`).

### 2. Nuova molecola `EmailCard` (`src/v2/ui/molecules/EmailCard/`)
- File: `EmailCard.tsx`, `types.ts`, `index.ts`.
- Logic-less: riceve un oggetto `EmailCardEntity` (mittente, azienda, paese, oggetto, preview, categoria, urgency, "in agenda", recency, canali, ecc.).
- Costruisce gli slot e usa `EntityRow` con `tone="email"`.
- Badge mostrati a destra del nome azienda:
  - **Categoria** (folder corrente) — colorata.
  - **AI suggested category** (dashed, se diversa).
  - **Urgency** (critical/high) — destructive/amber.
  - **📅 In agenda** se `goes_to_agenda`.
  - **Allegato 📎** se presente.
  - **Non letta** (pallino primary) se `unread`.
- Preview: prime 2 righe del corpo testo (clean, no quoted reply), `line-clamp-2`.
- Azioni `⋯`: Apri · Riclassifica · Segna come letto · Sposta in cartella · Risposta rapida · Aggiungi all'agenda.

### 3. Sostituzione progressiva delle card email
- Sostituire la riga lista in `FunnemailInboxPage` / `useFunnemailInbox` consumer con `EmailCard`.
- Mantenere `EmailDetailView` invariato (è il pannello destro di dettaglio, non una card di lista).
- Mappatura dati nel hook `useFunnemailInbox` (deriva azienda da partner, paese ISO da partner/contact, ecc.). Nessuna modifica al fetching, né a `check-inbox`, `email-imap-proxy`, `mark-imap-seen`, `journalistReview`, `operative_prompts`.

### 4. Refinement Network (Company/Contact card)
- `CompanyCard`: allineare i badge a destra del nome con gap uniforme; assicurare `name` sempre **uppercase visivo** via classe `uppercase tracking-wide` (mantenere il dato originale nel DOM). Rivedere centratura del `⋯`.
- `ContactSubCard`: stessa logica di col 1/2/3/5; collassare correttamente in `compact`.

### 5. Roadmap di adozione (NON in questo PR, solo elencata per visibilità)
Lasciate invariate ora, da migrare in step successivi sullo stesso template:
- Lead card (pipeline Kanban, lista lead).
- Agenda card (per azione).
- Conversazioni WhatsApp / LinkedIn.
- BCA card (Business Card Hub).
- Risultati ricerca (Sherlock).

## Vincoli & checklist

- Nessuna modifica a logica di business, edge functions, RLS, fetching o invii.
- Nessun colore hard-coded: solo token semantici (`primary`, `chart-2`, `chart-3`, `destructive`, `muted-foreground`, `emerald-500/amber-500` già usati nel design system).
- Mobile: i `compact` restano funzionanti; preview email passa a `line-clamp-1` sotto i 520px.
- Accessibilità: tutti i bottoni di filtro (paese/città) e azioni mantengono `aria-label` e `title`.
- Nessuna duplicazione di slot o rendering.

## File toccati

- `src/v2/ui/atoms/EntityRow.tsx` (slot `previewSlot`, `extraRowsSlot`, tono `email/lead/agenda`).
- `src/v2/ui/molecules/EmailCard/EmailCard.tsx` (nuovo).
- `src/v2/ui/molecules/EmailCard/types.ts` (nuovo).
- `src/v2/ui/molecules/EmailCard/index.ts` (nuovo).
- `src/v2/ui/pages/FunnemailInboxPage.tsx` (sostituzione riga lista → `EmailCard`).
- `src/v2/hooks/useFunnemailInbox.ts` (solo mapping `EmailCardEntity`, no logica nuova).
- `src/v2/ui/molecules/CompanyCardList/CompanyCard.tsx` (uppercase nome + allineamento badge/azioni).
- `src/v2/ui/molecules/CompanyCardList/ContactSubCard.tsx` (allineamento col 1/2/5).

## Domanda di conferma

Procedo con: (1) hardening `EntityRow`, (2) creazione `EmailCard` e adozione in Funnemail, (3) refinement allineamenti `CompanyCard`/`ContactSubCard`. Le card lead/agenda/WA/LI/BCA le migro in step successivi su tua richiesta esplicita.