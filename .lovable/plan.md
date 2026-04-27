# Correzione tab "Gestione Manuale" — allineamento al design approvato

## Diagnosi (cosa NON corrisponde al design)

Confrontando lo stato attuale (`ManualGroupingTab.tsx`, `SenderCard.tsx`, `GroupDropZone.tsx`) con il documento di design:

1. **SenderCard** mostra ancora `<Select> "Assegna gruppo…"`, pulsante `"Più opzioni / Meno opzioni"` con sezione espandibile (PromptTemplateSelector + RulesConfiguration + BulkEmailActions). Devono essere **rimosse dalla card** — sono già nella `SenderActionBar`.
2. **Card grigie/oscurate**: `opacity-45` viene applicata a TUTTI i sender già classificati (e nella prima schermata sono la stragrande maggioranza). L'utente legge male i nomi → da rimuovere, sostituire con un marker più sottile (badge "✓ classificato" o ring colorato del gruppo, ma testo leggibile al 100%).
3. **Sort/filter row** ha 3 dropdown (`Volume`, `Sort`, `Tutti`) + pulsante "Aggiorna conteggi" → design vuole **ToggleGroup segmented** `A-Z | N. email | AI smart` + checkbox `Multi-selezione` + counter `N da smistare · N classificati` a destra. Niente "Aggiorna conteggi" (resta solo nella TabsList badge).
4. **Auto-selezione del primo sender mancante**: il preview panel parte vuoto ("Seleziona un mittente…"). Deve **auto-selezionare il primo sender del rail** al primo render (e quando si applica un filtro/sort che cambia la lista).
5. **Preview panel troppo povero**: mostra solo subject + data. Deve mostrare anche **direzione (in/out), canale (icona email/WA/LI), preview corpo 2 righe nella lista**, e nel dettaglio in basso **mittente + destinatario + canale + ID/badge di stato**. L'utente nello screenshot dice "dobbiamo mostrare molto di più delle mail in arrivo nel dettaglio sotto". Il filtro corrente è `channel='email'` con `from_address ILIKE %senderEmail%` che include anche outbound — già ok per direzione, va solo reso visibile.
6. **Griglia gruppi**: oggi ha solo dropdown `A-Z / Per contatti` + barra alfabetica A-Z singola lettera. Design vuole **pill segmented** `Tutti | A-D | E-L | M-P | Q-Z` (range, non singola lettera).
7. **Prompt AI bar in basso mancante**: design vuole una barra fissa a fondo pagina con input + "Analizza" (stub toast).
8. **AI smart sort già presente** in `useFilterAndSort` ma il dropdown lo etichetta solo "AI smart" → ok logica, va portato dentro il segmented.
9. **Header sopra-tab ("menu in alto non riparato")**: l'`EmailIntelligencePage` ha un header con icona+titolo+sottotitolo + 4 tab. L'utente lamenta che la pagina ha **doppio header** (quello dell'`EmailIntelligencePage` *e* quello dell'`EmailIntelligenceHeader` interno al tab) → la `EmailIntelligenceHeader` deve **rimuovere il proprio titolo "Gestione Manuale"** e l'icona BrainCircuit (duplicano quanto già nella TabsList) e diventare una semplice **toolbar di tab** (ricerca + counter + Nuovo gruppo).

---

## Modifiche file per file

### 1. `src/components/email-intelligence/management/SenderCard.tsx`
- **Rimuovere** dal render:
  - blocco `<Select> "Assegna gruppo…" + Check`
  - pulsante `Più opzioni / Meno opzioni`
  - tutta la sezione `isExpanded && addressRule && (…)` (PromptTemplateSelector + RulesConfiguration + BulkEmailActions + BackfillButton)
  - import e state inutilizzati di conseguenza (`isExpanded`, `addressRule`, `isLoadingRule`, `isSavingRule`, `loadAddressRule`, `toggleExpanded`, `handlePromptChange`, `handleRulesChange`, `selectedGroupId`, `isAssigning`, `handleGroupSelection`, import di `Select…`, `PromptTemplateSelector`, `RulesConfiguration`, `BulkEmailActions`, `BackfillButton`, `ChevronDown`, `ChevronUp`, `Loader2`, `Check`, `sb`).
- **Rimuovere** la classe `opacity-45` su sender classificati. Sostituire con:
  - sottile badge in alto a destra `<Badge variant="secondary" className="text-[9px]">✓ {currentGroup.nome_gruppo}</Badge>` (quando `isClassified` e c'è un nome gruppo, altrimenti solo `✓`).
  - bordo sinistro che resta colorato per volume (già presente).
- Card resta **draggable** e **clickabile** per selezione preview (gestione click già nel parent).
- Larghezza fissa: contenitore del parent passa già `w-[260px]` → **ridurre a `w-[200px]`** (vicino ai 195px del design) per avere più card visibili nel rail.
- Avatar iniziali: già implementato, verificare resa quando favicon fallisce.
- Chip AI: già implementato come `<button><Badge>AI: {…}</Badge></button>` → ok.
- Props da rimuovere dall'interfaccia: `groups`, `onAssignGroup`, `onAddressRuleUpdated` (non più usati).

### 2. `src/components/email-intelligence/ManualGroupingTab.tsx`
- **Sort/filter row** (righe 209-259): sostituire con:
  - `ToggleGroup type="single"` shadcn con 3 item: `A-Z` → `name-asc`, `N. email` → `count-desc`, `AI smart` → `ai_group`. Mappa a `sortOption`/`setSortOption` esistenti.
  - Checkbox `Multi-selezione` (label "Multi-selezione", sostituisce "Tutti"). Quando ON abilita la modalità: passa `multiSelectMode` come nuovo prop a `SenderCard` per mostrare la checkbox; quando OFF, click sulla card resta solo "seleziona per preview" (sostituisce la selezione precedente con la singola card).
  - Counter a destra: `<span className="text-xs text-muted-foreground ml-auto">{senders.length} da smistare · {classifiedSenders.length} classificati</span>`.
  - **Rimuovere**: `Select` Volume, `Select` Sort, badge "visibili", badge totale email, pulsante `Aggiorna conteggi`. (Il volume filter resta nello state ma non più esposto qui — lo si può lasciare a `"all"` di default.)
- **Auto-selezione primo sender**:
  - Aggiungere `useEffect` che quando `previewSender == null && sortedSenders.length > 0` → `setPreviewSender(sortedSenders[0])`.
  - Quando cambia `sortOption`/`searchQuery` e il `previewSender` corrente non è più nella lista visibile → fallback al primo.
- **Stato `multiSelectMode`**: nuovo `useState(false)`. Click sulla card:
  - se `multiSelectMode=true` → `toggleSenderSelection(sender.email)` + `setPreviewSender(sender)` (così il preview segue l'ultimo cliccato).
  - se `multiSelectMode=false` → solo `setPreviewSender(sender)` (selezione singola visiva, no checkbox sender selezionati).
  - La `SenderActionBar` resta visibile solo se `selectedSenders.size > 0` (in single-mode rimane nascosta finché non si attiva multi-selezione).
- **`SenderCard` props passate**: rimuovere `groups` e `onAssignGroup` (drag&drop e bulk-assign sono gli unici percorsi).
- **Width contenitore card**: `w-[260px]` → `w-[200px]`.
- **Filtro alfabetico griglia gruppi** (righe 337-367): sostituire con pill segmented `Tutti | A-D | E-L | M-P | Q-Z`. Passare un nuovo state `letterRange: 'all' | 'A-D' | 'E-L' | 'M-P' | 'Q-Z'` a `useFilterAndSort` (vedi punto 4). Il dropdown groupSort `A-Z / Per contatti` resta accanto come oggi.
- **Prompt AI bar in fondo**: aggiungere alla fine del JSX (sotto la sezione split):
  ```tsx
  <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border rounded-md bg-card">
    <Sparkles className="h-4 w-4 text-primary" />
    <Input placeholder="Chiedi all'AI di analizzare un mittente…" className="flex-1 h-8" value={aiPromptDraft} onChange={…}/>
    <Button size="sm" disabled={!aiPromptDraft} onClick={() => toast.info("Funzionalità in arrivo")}>Analizza</Button>
  </div>
  ```
  state locale `aiPromptDraft`.
- **`handleSelectAll` + checkbox "Tutti"** corrente: rimossi (sostituiti da Multi-selezione che non seleziona automaticamente — l'utente clicca le card che vuole). Mantenere però `selectAll` nell'hook per uso futuro.
- **Bug TabsList header doppio**: vedi punto 4 sotto.

### 3. `src/components/email-intelligence/management/EmailIntelligenceHeader.tsx`
- **Rimuovere** il blocco `<div className="flex items-center gap-2"><div BrainCircuit/>… <h2>Gestione Manuale</h2><p>countLabel</p></div>` perché duplica l'header di `EmailIntelligencePage`.
- Ridurre il componente a una **toolbar orizzontale**: `[Search input flex-1] [Counter testo "N da smistare · N classificati"] [Button "+ Nuovo gruppo"]`. Il `countLabel` viene comunque passato e mostrato a destra del search prima del bottone.
- L'header esterno (titolo "Email Intelligence") resta in `EmailIntelligencePage` invariato.

### 4. `src/components/email-intelligence/manual-grouping/useFilterAndSort.ts`
- Aggiungere supporto al **range alfabetico** per i gruppi:
  - nuovo state `letterRange: 'all' | 'A-D' | 'E-L' | 'M-P' | 'Q-Z'` (default `'all'`).
  - nel `useMemo sortedGroups` filtrare per range invece che singola lettera. (Mantieni `activeLetterFilter` per back-compat se usato altrove, ma il consumer principale userà `letterRange`.)
  - export di `letterRange`, `setLetterRange`, `LETTER_RANGES = [{value:'all', label:'Tutti'}, {value:'A-D', label:'A-D'}, …]`.
- Helper `inRange(letter, range)`: per `'A-D'` → `letter >= 'A' && letter <= 'D'`, `'#'` (non alpha) sempre incluso solo in `all`.

### 5. `src/components/email-intelligence/management/SenderEmailPreviewPanel.tsx`
- **Lista email**: ogni item mostra:
  - riga 1: icona direzione (frecce esistenti) + icona canale (Mail/MessageCircle/Linkedin) + subject (bold, truncate).
  - riga 2: data formattata (già presente).
  - riga 3: anteprima corpo `body_text` 1 riga truncate (es. `text-[10px] text-muted-foreground line-clamp-1`).
- **Pannello dettaglio in basso** (current selezionato): mostrare anche
  - `Da: {from_address}` `→` `A: {to_address}`
  - badge canale + badge direzione (`inbound` / `outbound`)
  - poi il preview corpo 6 righe (già presente).
- Query: ampliare il SELECT con `channel` (oltre a quanto già c'è). Filtro `channel='email'` resta (attualmente la pagina è solo email; in futuro `OR channel IN (email,whatsapp,linkedin)` se serve).
- **Header pannello** già `Email da {companyName}` + frecce → ok.

### 6. `src/components/email-intelligence/management/GroupDropZone.tsx`
- Nessuna modifica strutturale. Solo verificare che il pulsante `+ Associa N` sia ben visibile quando `selectedCount > 0` (già presente) e che il glow `isHighlighted` sia tarato a 2.5s (già nel parent).

### 7. `src/v2/ui/pages/EmailIntelligencePage.tsx`
- Nessuna modifica funzionale richiesta. L'header è ok; resta confermato che `EmailIntelligenceHeader` interno al tab non duplica più il titolo.

---

## Riepilogo nuovi/rimossi

**Nessun nuovo file.** Tutto è modifica di file esistenti.

**Stato della SenderCard dopo refactor (~150 righe vs 449 attuali):**
- Avatar (favicon o iniziali)
- Nome azienda + email
- Conteggio email + bandiera
- Chip AI (se suggerimento)
- Badge "✓ classificato" se `isClassified`
- Checkbox solo se `multiSelectMode`
- **Niente dropdown, niente "Più opzioni", niente sezione espandibile.**

---

## Vincoli rispettati
- Zero nuovi `any`.
- Schema DB: nessuna nuova migration.
- Nessuna modifica a `check-inbox` / `email-imap-proxy`.
- Soft-delete invariato.
- DAL invariato (le bulk action già passano da `bulkUpdateAutoAction` / `bulkSetBlocked`).
- `from_address` (non `from_email`), `channel_messages`, `email_address`, `onConflict: 'user_id,email_address'` → tutto già rispettato dal codice esistente.

---

## Test post-implementazione (manuali)
1. La prima sender card è auto-selezionata e il preview panel mostra le sue email.
2. I nomi delle card già classificate sono **leggibili** (non grigi); compare un piccolo badge `✓`.
3. Click su chip AI → il gruppo target nella griglia 65% destra fa glow per 2.5s.
4. Toggle `Multi-selezione` ON → compaiono checkbox; selezionando 2 card appare la `SenderActionBar` con label `2 mittenti selezionati`.
5. Sort `AI smart` raggruppa i sender per `aiSuggestion.group_name`.
6. Filtro `A-D` mostra solo gruppi con iniziale A-D.
7. La barra prompt AI in basso esiste e cliccando "Analizza" mostra toast "Funzionalità in arrivo".
8. La SenderCard non ha più dropdown "Assegna gruppo…" né "Più opzioni".
9. Build TypeScript pulita (no nuovi `any`, no errori).