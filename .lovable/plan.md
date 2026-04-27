# Reset "Gestione Manuale" — allineamento 1:1 al design ASCII

## Cosa vedi tu nello screenshot vs cosa manca

Il layout c'è già (rail orizzontale + split 35/65 + pill alfabetiche). Quello che **manca o è sbagliato** rispetto al design ASCII che mi hai dato:

| Problema | Causa tecnica | Fix |
|---|---|---|
| **Header pagina "Email Intelligence + Flusso completo…" occupa 80px inutili** | `EmailIntelligencePage.tsx` ha titolo + sottotitolo sopra i tab | Rimuovere il titolo della pagina (resta solo nei tab) o ridurlo a una riga |
| **Counter "1199 da smistare · 9 classificati" duplicato** (header + sortbar) | `EmailIntelligenceHeader` mostra `countLabel` E la sortbar lo rimostra a destra | Tenerlo solo nella sortbar |
| **SenderActionBar invisibile** ("non vedo le icone delle azioni") | Si attiva solo con `selectedSenders.size > 0`, ma l'auto-focus della prima card aggiorna solo `previewSender` | **Mostrarla sempre** quando c'è un `previewSender` (il sender corrente) — etichetta "Azioni per {nome}:" |
| **Chip AI invisibili sulle card visibili** (Airlogisticsgroup, Agorafreight, TMWE…) | Nel DB quei sender NON hanno `ai_suggested_group` popolato | È **dato reale**, non bug. Però devo: (a) rendere il chip più visibile quando c'è, (b) mostrare un placeholder discreto "Nessun suggerimento AI" così sai che il sistema non li ha ancora analizzati |
| **Manca badge "Selezionato" sopra la card** (come nel mockup precedente) | Mai implementato | Aggiungere small ribbon "● selezionato" sopra la card con `isFocused` |
| **Card sender un po' "spoglia"** | Solo riga avatar+nome+conteggio + chip AI | Aggiungere sotto: ultima email ricevuta (data), e icona canale (📧/💬/💼) — info utili |
| **Pannello opzioni "Più opzioni" rimasto da qualche parte?** | Già rimosso da `SenderCard` nel refactor precedente | ✅ niente da fare, era già fatto |

## Modifiche puntuali (5 file, ~150 LOC modificate)

### 1. `src/v2/ui/pages/EmailIntelligencePage.tsx`
- Compattare l'header: rimuovere il sottotitolo "Flusso completo…" (ridondante con i tab)
- Ridurre l'icona Brain da `h-9 w-9` a `h-7 w-7`, titolo `text-base` invece di `text-xl`
- Risparmio: ~50px verticali → più spazio per le card

### 2. `src/components/email-intelligence/management/EmailIntelligenceHeader.tsx`
- Rimuovere il `countLabel` dall'header (resta nella sortbar)
- Aggiungere icona "Refresh" / pulsante "Aggiorna mittenti" (popolamento) accanto a "Nuovo gruppo" — utile quando il counter sembra fermo

### 3. `src/components/email-intelligence/ManualGroupingTab.tsx`
- **SenderActionBar SEMPRE visibile** quando esiste `previewSender` (anche senza multi-select). 
  - Se 0 selezionati ma c'è preview: agisce sul singolo `previewSender.email`
  - Se ≥1 selezionati: agisce sui selezionati (comportamento attuale)
- Etichetta dinamica: "Azioni per **{nome azienda}**" (singolo) o "Azioni per **N mittenti selezionati**" (multi)

### 4. `src/components/email-intelligence/management/SenderCard.tsx`
- Aggiungere **ribbon "Selezionato"** sopra la card quando `isFocused === true` (chip primary piccolo che sporge)
- Rendere il **chip AI più prominente** quando esiste: padding maggiore, sfondo pieno (non outline), animazione hover
- Quando NON c'è `aiSuggestion`: mostrare un mini-placeholder testo `"Nessun suggerimento AI"` in `text-[9px] text-muted-foreground/60` (così l'utente capisce perché)
- Aggiungere riga 3 con: data ultima email + canale (📧 inbound count)

### 5. `src/components/email-intelligence/manual-grouping/useGroupingData.ts`
- Esporre anche `lastSeen` formattato (già caricato da `last_email_at`) per la nuova riga della card

## File NON toccati
- `GroupDropZone.tsx` — già conforme al design (icona, conteggio, "+ Associa", azioni edit/list/trash)
- `SenderEmailPreviewPanel.tsx` — già conforme (frecce ‹ ›, lista email, dettaglio)
- `ExportSendersDialog.tsx`, `SenderActionBar.tsx` (logica) — già conformi
- `useFilterAndSort.ts`, `useDragAndDrop.ts`, `useGroupAssignment.ts` — invariati

## Risultato atteso (verticale, dall'alto al basso)

```
┌────────────────────────────────────────────────────────────┐
│ 🧠 Email Intelligence                          ← compatto │  (-50px)
├────────────────────────────────────────────────────────────┤
│ [Tab Gestione] [AI] [Auto-class] [Regole]                 │
├────────────────────────────────────────────────────────────┤
│ 🔍 Cerca…    [↻ Aggiorna] [+ Nuovo gruppo]                │  ← header
├────────────────────────────────────────────────────────────┤
│ Azioni per Airlogisticsgroup: ✏Regole ☑Lette 🗑 ↑ ⊘ 💬   │  ← SEMPRE visibile
├────────────────────────────────────────────────────────────┤
│ [A-Z] [N. email] [AI smart] ☐ Multi-sel  1199·9 classif. │
├────────────────────────────────────────────────────────────┤
│ ┌─[●Selezionato]──┐ ┌────────┐ ┌────────┐ →scroll        │
│ │ 🟢 Airlog.   35 │ │ Agora  │ │  TMWE  │                │
│ │ ✨ AI: Operativo│ │ no AI  │ │ no AI  │                │
│ │ 📧 21 apr · 35 │ │ 21 apr │ │ 19 apr │                │
│ └─────────────────┘ └────────┘ └────────┘                │
├──────────────────────┬─────────────────────────────────────┤
│ Email da Airlog.     │ Gruppi (14)        [A→Z ▾]         │
│ ‹ 1/20 ›             │ Tutti A-D E-L M-P Q-Z             │
│ ▸ Subject…       21  │ ┌─Amministrativo─┐ ┌─Commerciale─┐│
│ ▸ Subject…       19  │ │📊 (0)         │ │💼 (0)        ││
│ Da: …                │ │Trascina sender│ │Trascina sender││
│ A: …                 │ └───────────────┘ └──────────────┘│
└──────────────────────┴─────────────────────────────────────┘
[🤖 Chiedi all'AI…                              [Analizza]]
```

## Note importanti
- **Il chip AI mancante NON è un bug** — è dato vuoto in `email_address_rules.ai_suggested_group` per quei sender. Il tab "Suggerimenti AI" (fase 2) è quello che genera i suggerimenti tramite AI; finché non lo lanci, i chip restano vuoti. Aggiungerò un pulsante "✨ Genera suggerimenti AI" nell'header che reindirizza al tab giusto.
- **No nuove dipendenze**, no nuove tabelle DB, no edge function. Solo refactor UI.
- Build TS già clean (l'errore segnalato era cache stale).