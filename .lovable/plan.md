# Email Intelligence — Redesign tab "Gestione Manuale" (Fase 1)

Riprogettazione del tab `ManualGroupingTab.tsx` come orchestratore modulare. Le altre 3 fasi (AI Suggestions, Smart Inbox, Rules & Actions) **non vengono toccate**.

---

## Decisioni confermate

| Tema | Decisione |
|------|-----------|
| **Prompt AI bar** | **Rimandata** — niente componente, niente input AI in questa fase. |
| **Esporta CSV** | **Dialog con scelta**: "Solo indirizzi email" oppure "Tutte le email (subject, data, from, to, body preview)". |
| **Blocca** | **`auto_action='spam'` + flag booleano `is_blocked`** su `email_address_rules`. Richiede migration. |

---

## Migration DB (1 sola)

```sql
ALTER TABLE public.email_address_rules
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_email_address_rules_is_blocked
  ON public.email_address_rules (is_blocked) WHERE is_blocked = true;
```

Nessun cambio RLS (eredita policy esistenti). Nessun trigger nuovo.

---

## Layout del tab

```
┌──────────────────────────────────────────────────────────┐
│ EmailIntelligenceHeader (titolo + ricerca + Nuovo gruppo)│
├──────────────────────────────────────────────────────────┤
│ SenderActionBar  (visibile solo se selectedSenders > 0)  │
│ Regole · Segna lette · Elimina · Esporta · Blocca · Prompt│
├──────────────────────────────────────────────────────────┤
│ Sort bar + multi-selezione + contatore                   │
│ A-Z · N.email · AI smart · ☐ Multi · "N da smistare · N classificati" │
├──────────────────────────────────────────────────────────┤
│ Sender cards rail (scroll orizzontale, card 195px)       │
├──────────────────────────────────────────────────────────┤
│ ┌──────────────┬───────────────────────────────────────┐ │
│ │ Preview email│ Griglia gruppi (2 col + filtro alfab.)│ │
│ │  35%         │  65%                                   │ │
│ └──────────────┴───────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

Niente barra Prompt AI in basso (rimandata).

---

## File NUOVI (4)

### 1. `src/components/email-intelligence/management/EmailIntelligenceHeader.tsx`
Header con titolo, `Input` ricerca debounce 200ms, pulsante `+ Nuovo gruppo` che apre il `CreateCategoryDialog` esistente.

### 2. `src/components/email-intelligence/management/SenderActionBar.tsx`
Barra azioni contestuale visibile solo quando `selectedSenders.length > 0`.

6 pulsanti icona+testo:
- **Regole** → apre `RulesConfiguration` esistente sul primo sender (o batch se multi)
- **Segna lette** → batch update `auto_action_params.also_mark_read = true` via DAL
- **Elimina tutte** → `AlertDialog` conferma, poi `auto_action='delete'`
- **Esporta** → apre `ExportSendersDialog`
- **Blocca** → `auto_action='spam'` + `is_blocked=true` (UPDATE atomica)
- **Prompt** → **disabilitato** con tooltip "In arrivo" (placeholder)

Riusa la mutation logic di `BulkEmailActions.tsx` esistente.

### 3. `src/components/email-intelligence/management/SenderEmailPreviewPanel.tsx`
Versione inline (non-dialog) di `SenderEmailsDialog.tsx`. Pannello 35% sinistra.
- Header: "Email da {companyName}" + frecce prev/next
- Lista scrollabile: subject (bold), data, preview corpo 2 righe
- Query: `channel_messages` filtrato per `from_address` + `channel='email'`, ordinato `received_at` desc, limit 20

### 4. `src/components/email-intelligence/management/ExportSendersDialog.tsx`
Dialog leggero con `RadioGroup`:
- "Solo indirizzi email" → CSV 1 colonna
- "Tutte le email" → CSV 5 colonne (subject, date, from, to, body_preview) da `channel_messages`

CSV generato client-side con `Blob` + download.

---

## File da MODIFICARE (estendere, non duplicare)

### 5. `src/components/email-intelligence/ManualGroupingTab.tsx` — riscrittura
**Obiettivo: ≤220 righe**, solo orchestratore.

State globale:
```ts
const [selectedSenders, setSelectedSenders] = useState<Set<string>>(new Set());
const [multiSelectMode, setMultiSelectMode] = useState(false);
const [highlightedGroupName, setHighlightedGroupName] = useState<string | null>(null);
const [previewSender, setPreviewSender] = useState<SenderAnalysis | null>(null);
```

Compone: `EmailIntelligenceHeader` → `SenderActionBar` (condizionale) → sort bar → rail orizzontale `SenderCard` → split 35/65 (`SenderEmailPreviewPanel` + griglia `GroupDropZone`).

Mantiene tutti gli hook esistenti (`useGroupingData`, `useFilterAndSort`, `useDragAndDrop`, `useGroupAssignment`, `useSelectionState`).

### 6. `src/components/email-intelligence/management/SenderCard.tsx` — estensione
Nuove props:
```ts
aiSuggestion?: { group_name: string; confidence: number };
isClassified?: boolean;
onAiChipClick?: (groupName: string) => void;
multiSelectMode?: boolean;
```

Aggiunte UI:
- **Avatar**: cerchio iniziali (2 lettere uppercase) come fallback al favicon
- **Chip AI** in basso: badge colorato `"AI: {group_name}"` + tooltip confidence. Click → `onAiChipClick`. Non renderizzato se `aiSuggestion` assente.
- **Opacità 0.45** quando `isClassified=true`
- **Larghezza fissa ~195px** per il rail orizzontale

**Conservare**: drag-drop HTML5, dropdown gruppo, espansione regole, `BackfillButton`.

### 7. `src/components/email-intelligence/management/GroupDropZone.tsx` — estensione
Nuove props:
```ts
isHighlighted?: boolean;
selectedSenders?: string[];
onAssociate?: (groupId: string, groupName: string) => Promise<void>;
```

Aggiunte UI:
- **Bordo glow animato** (`ring-2 ring-primary animate-pulse`) quando `isHighlighted=true`
- **Pulsante "+ Associa"** visibile solo se `selectedSenders.length > 0`
- **Layout responsive griglia 2 colonne** (parent usa `grid-cols-2`)

**Conservare**: drop-zone drag, modifica/elimina gruppo, conteggio regole, real-time subscription.

Mutation "+ Associa" (riusa pattern `useGroupAssignment.bulkAssignGroup` con `operator_id`):
```ts
const rules = senderEmails.map(email => ({
  email_address: email,
  group_id: groupId,
  group_name: groupName,
  user_id: user.id,
  operator_id: operatorId,
}));
await supabase
  .from('email_address_rules')
  .upsert(rules, { onConflict: 'user_id,email_address' });
```

### 8. `src/components/email-intelligence/manual-grouping/useGroupingData.ts` — estensione
1. Estendere SELECT su `email_address_rules` per includere: `ai_suggested_group`, `ai_suggestion_confidence`, `ai_suggestion_accepted`, `is_blocked`
2. Aggiungere caricamento `classifiedSenders: SenderAnalysis[]` in parallelo agli uncategorized
3. Esportare `classifiedSenders` dal hook

Mappare nuovo campo opzionale `aiSuggestion` in `SenderAnalysis`.

### 9. `src/components/email-intelligence/manual-grouping/useFilterAndSort.ts` — estensione
- Aggiungere `SortOption = 'ai_group'` (alfabetico per `aiSuggestion?.group_name`, sender senza suggerimento in fondo)
- Combinare `senders + classifiedSenders` per il rail con flag `isClassified`
- Ritornare `{ pendingCount, classifiedCount }` per la label "N da smistare · N classificati"

### 10. `src/types/email-management.ts` — estensione minima
Aggiungere a `SenderAnalysis`:
```ts
aiSuggestion?: { group_name: string; confidence: number; accepted: boolean };
isBlocked?: boolean;
```
Aggiungere `'ai_group'` a `SortOption`.

### 11. `src/data/emailAddressRules.ts` — DAL helpers
Aggiungere:
- `bulkUpdateAutoAction(emails: string[], action: string, params?: Record<string, unknown>)`
- `bulkSetBlocked(emails: string[], blocked: boolean)` (set `auto_action='spam'` + `is_blocked=blocked` atomicamente)

Tutti gli UPDATE filtrati per `user_id` (non `operator_id` che è spesso NULL).

---

## File da NON toccare

- `EmailIntelligencePage.tsx` (shell tab)
- `AISuggestionsTab`, `SmartInboxView`, `RulesAndActionsTab` (Fasi 2 e 3)
- `MultiSelectBulkBar`, `CreateCategoryDialog`, `BulkEmailActions`, `RulesConfiguration`, `SenderEmailsDialog` (riusati)
- Hook `useDragAndDrop`, `useGroupAssignment`, `useSelectionState` (compatibili)
- Edge function `apply-email-rules` (vincolo email integrity, fix preesistente fuori scope)

---

## Interazione chip AI ↔ griglia

1. La sender card mostra chip "AI: Operativo" (da `email_address_rules.ai_suggested_group`)
2. Click sul chip → `handleAiChipClick('Operativo')` → `setHighlightedGroupName('Operativo')`
3. La `GroupDropZone` di "Operativo" riceve `isHighlighted=true` → bordo `ring-2 ring-primary animate-pulse` per 2.5s
4. Utente decide manualmente: drag-drop / dropdown card / pulsante "+ Associa"

3 vie → 1 sola riga in `email_address_rules` con `group_id` + `group_name`.

---

## Multi-selezione

1. Checkbox "Multi-selezione" attiva `multiSelectMode=true`
2. Le card mostrano un `Checkbox`
3. Click su card → toggle in `selectedSenders`
4. `SenderActionBar` cambia label: "Azioni per N sender selezionati"
5. "+ Associa" sulla `GroupDropZone` opera su tutti i selezionati
6. Tutte le azioni batch resettano la selezione al completamento

Riusa la logica esistente di `useSelectionState`.

---

## Type safety & vincoli

- Zero nuovi `any`
- Ogni INSERT/UPSERT su `email_address_rules` popola sia `user_id` sia `operator_id`
- `onConflict: 'user_id,email_address'` su tutti gli upsert
- Soft-delete sui gruppi (trigger DB invariato)
- Nessuna nuova chiamata diretta a `supabase.from()` in UI: passa per il DAL `src/data/emailAddressRules.ts`

---

## Riepilogo file impattati

| Tipo | File | Note |
|------|------|------|
| Migration | `email_address_rules.is_blocked` | nuova colonna boolean |
| NEW | `EmailIntelligenceHeader.tsx` | header pagina |
| NEW | `SenderActionBar.tsx` | barra azioni contestuale |
| NEW | `SenderEmailPreviewPanel.tsx` | preview inline 35% |
| NEW | `ExportSendersDialog.tsx` | dialog scelta CSV |
| MOD | `ManualGroupingTab.tsx` | riscrittura ≤220 righe |
| MOD | `management/SenderCard.tsx` | +avatar, +chip AI, +isClassified |
| MOD | `management/GroupDropZone.tsx` | +isHighlighted, +"+Associa", +griglia 2 col |
| MOD | `manual-grouping/useGroupingData.ts` | +AI fields, +classifiedSenders |
| MOD | `manual-grouping/useFilterAndSort.ts` | +SortOption 'ai_group', +contatori |
| MOD | `types/email-management.ts` | +aiSuggestion, +isBlocked, +'ai_group' |
| MOD | `data/emailAddressRules.ts` | +bulkUpdateAutoAction, +bulkSetBlocked |

---

## Verifica post-implementazione

1. Build TypeScript (`tsc --noEmit`)
2. `ManualGroupingTab` non supera 220 righe
3. Rail orizzontale non causa overflow pagina (`overflow-x: auto` solo sul rail)
4. Test manuale: chip AI → highlight → "+ Associa" → riga in `email_address_rules` con `user_id` + `operator_id` corretti
5. Test "Blocca": verifica `auto_action='spam'` AND `is_blocked=true` simultanei
6. Test export CSV: entrambe le opzioni generano file scaricabile

---

## Fuori scope (segnalato a parte)

- Bug `apply-email-rules` filtro `operator_id` NULL (preesistente, vincolo email integrity)
- `SenderAIPromptBar` (rimandato per scelta esplicita)
- Modifiche a Fase 2 e Fase 3