

## Piano: Aggiungere selettore Goal e Proposte predefiniti nel GoalBar

### Problema
Il GoalBar mostra solo textarea vuote per Goal e Proposta. Non c'è nessun selettore per scegliere tra i goal e le proposte predefiniti salvati in `app_settings` (`custom_goals` e `custom_proposals`). L'utente non può riutilizzare i contenuti gia configurati nella sezione Impostazioni > Contenuti.

### Soluzione
Aggiungere un menu a tendina sopra ciascuna textarea (Goal e Proposta) che carica i contenuti da `app_settings` usando `useAppSettings()`, con fallback a `DEFAULT_GOALS` / `DEFAULT_PROPOSALS`.

### Modifiche

**`src/components/workspace/GoalBar.tsx`**
- Importare `useAppSettings` e `DEFAULT_GOALS` / `DEFAULT_PROPOSALS`
- Nel tab "Goal": aggiungere un `Select` sopra la textarea che elenca tutti i goal predefiniti (nome). Al click, popola la textarea con il testo del goal selezionato
- Nel tab "Proposta": stessa cosa con le proposte predefinite
- I dati vengono letti da `app_settings.custom_goals` (JSON string) con parse, fallback a `DEFAULT_GOALS` se non presente
- Il selettore mostra il nome dell'item, il click scrive il testo nella textarea corrispondente

### Layout risultante per ogni tab
```text
┌─────────────────────────────────┐
│ [▼ Seleziona goal predefinito ] │  ← Select dropdown
├─────────────────────────────────┤
│                                 │
│   Textarea (goal text)          │  ← viene popolata al click
│                                 │
└─────────────────────────────────┘
```

### Dati utilizzati
- `useAppSettings()` → `settings.custom_goals` (JSON array di `{name, text}`)
- `useAppSettings()` → `settings.custom_proposals` (JSON array di `{name, text}`)
- Fallback: `DEFAULT_GOALS` e `DEFAULT_PROPOSALS` da `src/data/defaultContentPresets.ts`

