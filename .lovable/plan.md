
# Redesign Gestione Manuale — Card-centrico + layout asimmetrico

## Obiettivo
Spostare tutte le azioni dalle barre orizzontali (in alto e in basso) **dentro la sender card**, rendere la card molto più ricca, e ristrutturare il layout in modo asimmetrico per massimizzare lo spazio per le miniature email.

---

## 1. Eliminare componenti orizzontali

In `ManualGroupingTab.tsx`:
- **Rimuovere** il render di `<SenderActionBar>` (righe 330-349)
- **Rimuovere** il blocco "Prompt AI bar" stub in fondo (righe 420-435 circa)
- **Rimuovere** import/state non più necessari: `aiPromptDraft`, `Sparkles` se non più usato altrove
- I file `SenderActionBar.tsx` e `ExportSendersDialog.tsx` **restano** ma vengono richiamati direttamente dalla card (non più dalla barra)

---

## 2. Nuovo layout asimmetrico

Sostituire l'attuale struttura verticale (`header → action bar → sortbar → rail → split 35/65`) con:

```
┌──────────────────────────────────────────────────────────────┐
│  [↻ Refresh]  Email Intelligence              [+ Nuovo gruppo]│
├──────────────────────────────────────────────────────────────┤
│  SortBar: A-Z | N.email | AI smart  + counter pendenti      │
├───────────────────────┬──────────────────────────────────────┤
│                       │  [🔍 Cerca mittente...]              │
│  COLONNA SINISTRA     │  ── Carosello card sender ──────────│
│  (35%, full height)   │  [card] [card] [card] [card] →     │
│                       ├──────────────────────────────────────┤
│  ┌─────────────────┐  │                                      │
│  │ Lista miniature │  │    GRIGLIA GRUPPI                   │
│  │ email (subject  │  │    [Filtri A-D | E-L | M-P | Q-Z]  │
│  │ + data + 1 riga │  │                                      │
│  │ preview)        │  │    [gruppo] [gruppo]                │
│  │                 │  │    [gruppo] [gruppo]                │
│  │ click → apre    │  │    [gruppo] [gruppo]                │
│  │ dettaglio       │  │                                      │
│  │ inline sotto    │  │                                      │
│  └─────────────────┘  │                                      │
│                       │                                      │
└───────────────────────┴──────────────────────────────────────┘
```

**Modifiche concrete in `ManualGroupingTab.tsx`:**

```tsx
<div className="flex flex-col h-full gap-2">
  {/* Header compatto: refresh sx, titolo center, +nuovo gruppo dx */}
  <EmailIntelligenceHeader ... showSearch={false} refreshOnLeft />

  {/* SortBar (resta) */}
  <SortBar ... />

  {/* Container principale: colonna sx full-height + colonna dx con search/rail/grid */}
  <div className="flex flex-1 gap-3 min-h-0 overflow-hidden">
    {/* SX: Email preview panel a tutta altezza */}
    <div className="w-[35%] min-w-[280px] flex-shrink-0 flex flex-col border rounded-lg overflow-hidden">
      <SenderEmailPreviewPanel ... />
    </div>

    {/* DX: search + rail + griglia gruppi */}
    <div className="flex-1 min-w-0 flex flex-col gap-2 overflow-hidden">
      {/* Search inline sopra il rail */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Input placeholder="Cerca mittente..." value={searchQuery} onChange={...} className="flex-1 h-8 text-xs" />
      </div>

      {/* Rail orizzontale card */}
      <div className="border rounded-lg flex-shrink-0 overflow-hidden">
        <div className="overflow-x-auto" style={{scrollbarWidth: "thin"}}>
          <div className="flex gap-2 p-2 min-w-min">
            {sortedSenders.map(sender => (
              <div key={sender.email} className="w-[240px] flex-shrink-0">
                <SenderCard sender={sender} ...nuove props azioni... />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Griglia gruppi (resta) */}
      <GroupGridPanel ... className="flex-1" />
    </div>
  </div>
</div>
```

**Note:**
- Ricerca passa **dentro la colonna destra** sopra il carosello (non più in header)
- Header `EmailIntelligenceHeader` viene **semplificato** (rimosso campo search, refresh va a sinistra del titolo)
- Niente più prompt bar inferiore

---

## 3. Card sender ingrandita e arricchita

`SenderCard.tsx` — nuova larghezza **240px** (da 200, +20%) e altezza **circa 1.5×** corrente.

**Nuova struttura interna:**

```
┌───────────────────────────────────────┐
│ ☑  [logo] Nome Azienda            42  │  ← multi-sel checkbox + logo + nome + count
│    bandiera 🇮🇹 mail@dominio.com       │  ← bandiera + email
├───────────────────────────────────────┤
│ ✨ AI: Operativo  [→ associa]         │  ← chip AI + bottone "Associa subito"
│ ✓ Già in: Gruppo X                    │  ← se già classificato
├───────────────────────────────────────┤
│ 🕐 Ultima: 24 apr 26                  │  ← ultima email
├───────────────────────────────────────┤
│ [⚙] [📨] [🗑] [⬇] [🚫] [✨]            │  ← 6 icon-button azioni rapide
│ Regole Lette Elim Esp Blocca AI       │     (tooltip su hover)
└───────────────────────────────────────┘
```

**Props nuove da aggiungere a `SenderCardProps`:**
```typescript
onOpenRules?: (email: string) => void;          // apre RulesConfigurationDialog per QUESTO sender
onMarkRead?: (email: string) => void;           // bulkUpdateAutoAction mark_read
onDelete?: (email: string) => void;             // confirm + bulkUpdateAutoAction delete
onExport?: (email: string) => void;             // apre ExportSendersDialog per QUESTO sender
onBlock?: (email: string) => void;              // bulkSetBlocked true
onAnalyzeAI?: (email: string) => void;          // trigger analisi AI sender (stub toast iniziale)
onAcceptAiSuggestion?: (email: string, groupName: string) => void; // associa subito al gruppo suggerito
```

**Implementazione azioni nella card:**
- Le 6 icon-button (`Settings2`, `MailCheck`, `Trash2`, `Download`, `Ban`, `Sparkles`) sono `<Button size="icon" variant="ghost" className="h-7 w-7">` con `<Tooltip>` per il label
- Ogni handler chiama una callback fornita dal parent
- L'icona AI (`Sparkles`) è il **trigger di analisi**: apre stub toast "AI analizzerà mittente" (Fase 2)
- Se `sender.aiSuggestion` è presente, il chip AI mostra anche un mini-bottone `→` per associare immediatamente al gruppo suggerito (1-click)
- Click su icona ⚙ Regole → apre `RulesConfigurationDialog` con `selectedSenders=[sender.email]` (gestito dal parent via state `rulesDialogForSender`)

**Checkbox multi-selezione** già presente nella card (riga 110-117); resta dov'è ma **sempre visibile** (rimuovere condizione `multiSelectMode`) — il flag globale di multi-selezione nella SortBar diventa opzionale (può essere rimosso o mantenuto come "seleziona tutto"). **Decisione proposta**: rimuovere il toggle dalla SortBar e lasciare solo la checkbox per-card sempre attiva, semplificando il flusso.

**Dimensioni:**
- Larghezza container: `w-[240px]` (era 200)
- Padding interno card: `p-3` (era `p-2.5`)
- Aumentare altezza tramite contenuto + spacing (sezioni separate da `border-t border-border/40`)

---

## 4. Pop-up regole automatica al drop su gruppo

In `useDragAndDrop` / `handleDragEndLocal`:
- Dopo `assignToGroup(activeDrag, group.nome_gruppo, targetGroupId)` con successo
- **Aprire automaticamente** `RulesConfigurationDialog` con `selectedSenders=[activeDrag.email]`
- Aggiungere state in `ManualGroupingTab`: `const [rulesDialogSenders, setRulesDialogSenders] = useState<string[] | null>(null);`
- Nel dialog: titolo "Mittente associato a {groupName} — configura azioni automatiche"
- Pulsante "Salta" per chiudere senza configurare regole

**Lo stesso dialog si apre anche** dall'icona ⚙ sulla card (in qualsiasi momento).

---

## 5. Header semplificato

`EmailIntelligenceHeader.tsx`:
- Rimuovere campo Search (passa nella colonna destra)
- Riordinare: `[🔄 Refresh] [titolo Email Intelligence] ...spacer... [+ Nuovo gruppo]`
- Tutto su 1 riga compatta `h-9`

---

## 6. Miniature email (colonna sinistra full-height)

`SenderEmailPreviewPanel.tsx` è già funzionante ma in poco spazio. Con il nuovo layout (full-height a sinistra) ottiene:
- Più verticale → lista miniature visibile (15+ righe)
- Pannello dettaglio sotto resta `max-h-[45%]` ma proporzionalmente più grande
- **Nessuna modifica al componente**: il fix è solo strutturale (allocare full-height invece di metà inferiore)

---

## 7. File da modificare

| File | Cambio |
|---|---|
| `src/components/email-intelligence/ManualGroupingTab.tsx` | Rimuovi SenderActionBar e prompt bar; ristruttura layout asimmetrico; aggiungi state `rulesDialogSenders` per dialog auto-apertura post-drop; passa nuove callback alla SenderCard |
| `src/components/email-intelligence/management/SenderCard.tsx` | +240px width, +altezza, sezione icone azioni (6 icon-button con tooltip), bottone "associa AI suggestion 1-click", checkbox multi-sel sempre visibile |
| `src/components/email-intelligence/management/EmailIntelligenceHeader.tsx` | Rimuovi campo search, refresh a sinistra |
| `src/components/email-intelligence/manual-grouping/useDragAndDrop.ts` | (eventualmente) callback `onAfterDrop` per triggerare apertura dialog regole |

## File da NON toccare
- `SenderActionBar.tsx` — rimosso dal render ma **mantenuto** (potrebbe servire per multi-sel batch in futuro)
- `RulesConfigurationDialog.tsx` — riusato dalla card e dal drop
- `ExportSendersDialog.tsx` — riusato dalla card
- `SenderEmailPreviewPanel.tsx` — nessuna modifica
- `GroupDropZone.tsx`, `GroupGridPanel` — nessuna modifica
- DAL (`bulkUpdateAutoAction`, `bulkSetBlocked`) — riusati dalle nuove callback nella card

---

## 8. Domande aperte (decisione di default)

1. **Toggle multi-selezione nella SortBar**: rimuoverlo (la checkbox per-card è sempre visibile) ✅ default
2. **Bottone AI nella card**: stub toast "Funzionalità in arrivo" ✅ default (Fase 2 implementerà l'analisi reale via aiChat.ts)
3. **Prompt bar AI in fondo**: rimossa completamente ✅ default

Se vuoi diverso, dimmelo prima dell'approvazione, altrimenti procedo con i default.
