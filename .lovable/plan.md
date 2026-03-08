

## Piano: AI Command Bar intelligente nel Cockpit

### Problema attuale
La Command Bar usa un `setTimeout` + `string.includes()` per parsare i comandi. Riconosce solo keyword statiche (italiano, priorità, linkedin, email, lista, card). **Non può eseguire operazioni** come Deep Search, Alias, selezione multipla o lancio outreach.

### Soluzione
Sostituire il parser locale con una chiamata a un **edge function AI** (come già fatto per `contacts-assistant`) che interpreta il linguaggio naturale e restituisce comandi strutturati.

### Comandi supportati

| Comando naturale | Azione |
|---|---|
| "Filtra solo italiani" | Applica filtro lingua IT |
| "Seleziona tutti quelli ad alta priorità" | `selection.selectWhere(c => c.priority >= 7)` |
| "Lancia deep search sui selezionati" | Trigger `onBulkDeepSearch()` |
| "Genera alias per Marco Bianchi" | Trigger `onSingleAlias(id)` |
| "Prepara email per tutti gli italiani" | Filtra → Seleziona → Drop su email |
| "Mostra in lista" | Cambia viewMode |
| "Seleziona tutti" / "Deseleziona" | Toggle selezione |

### Architettura

```text
TopCommandBar → Edge Function "cockpit-assistant"
                    ↓
              AI (Gemini Flash) con tool-calling
                    ↓
              Risposta strutturata: ---COMMAND--- JSON
                    ↓
              Cockpit.tsx interpreta e esegue
```

### Formato risposta AI

```json
{
  "actions": [
    { "type": "filter", "filters": [{"id": "lang-it", "label": "🇮🇹 Italiano", "type": "language"}] },
    { "type": "select_where", "criteria": "priority >= 7" },
    { "type": "bulk_action", "action": "deep_search" },
    { "type": "view_mode", "mode": "list" },
    { "type": "single_action", "action": "alias", "contactName": "Marco Bianchi" }
  ],
  "message": "Ho filtrato i contatti italiani e lanciato Deep Search sui 2 trovati."
}
```

### File da creare/modificare

1. **`supabase/functions/cockpit-assistant/index.ts`** (nuovo) — Edge function con Gemini Flash, riceve il comando + lista contatti correnti, restituisce azioni strutturate
2. **`src/components/cockpit/TopCommandBar.tsx`** — Sostituire `setTimeout` con chiamata alla edge function; passare callback per tutte le azioni (filter, select, bulk actions, view change)
3. **`src/pages/Cockpit.tsx`** — Esporre nuovi callback al TopCommandBar: `onSelectWhere`, `onBulkDeepSearch`, `onBulkAlias`, `onAutoOutreach`; gestire l'esecuzione sequenziale delle azioni restituite dall'AI

### Dettagli edge function

- Modello: Gemini 2.5 Flash (via Lovable AI, no API key)
- System prompt con lista contatti correnti (nomi, paesi, priorità, canali)
- Tool definitions per ogni azione disponibile
- Parsing della risposta con delimitatore `---COMMAND---` + JSON
- Fallback: se l'AI non genera comandi validi, mostra il messaggio come toast informativo

### Flusso UX

1. Utente scrive "filtra italiani e lancia deep search"
2. Spinner nella command bar
3. AI restituisce 2 azioni: filter + bulk_action
4. Cockpit esegue in sequenza: applica filtro → seleziona i filtrati → lancia deep search
5. Toast di conferma con il messaggio AI

