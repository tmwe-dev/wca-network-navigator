

## Piano di fix: Circuito — selezione messaggi e feedback utente

### Problema
Quando l'utente seleziona un messaggio nel Circuito, il pannello destro non si aggiorna perché:
1. `useHoldingStrategy.analyze()` fallisce silenziosamente se non trova un agente attivo
2. Non c'è feedback di errore — il pannello resta su "Seleziona un messaggio"
3. Possibili messaggi duplicati da import IMAP

### Modifiche previste

**1. Fix feedback errore in `useHoldingStrategy.ts`**
- Aggiungere uno stato `error` al hook
- Quando non si trova un agente attivo, settare un messaggio di errore visibile invece di fallire silenziosamente
- Quando l'edge function fallisce, mostrare l'errore

**2. Fix pannello destro in `HoldingPatternCommandCenter.tsx`**
- Aggiungere un ramo per lo stato `error`: mostrare un messaggio chiaro ("Nessun agente AI configurato" o "Errore nell'analisi")
- Mostrare comunque l'header del messaggio selezionato e il corpo originale, anche se l'AI non risponde — così l'utente vede che la selezione ha funzionato
- Separare il concetto "messaggio selezionato" dal concetto "strategia disponibile"

**3. Deduplicazione messaggi nel pannello sinistro**
- In `useHoldingMessages.ts`, aggiungere un filtro di deduplicazione basato su `message_id_external` o combinazione `subject + from_address + email_date` per evitare di mostrare lo stesso messaggio due volte

### Dettagli tecnici

```text
useHoldingStrategy.ts
├── Aggiungere: error state (string | null)
├── Se nessun agente → setError("Nessun agente AI attivo")
└── Se edge function fallisce → setError(err.message)

HoldingPatternCommandCenter.tsx
├── Leggere error da useHoldingStrategy
├── Mostrare corpo messaggio originale nel tab Risposta anche senza AI
└── Mostrare errore con icona AlertTriangle se presente

useHoldingMessages.ts
└── Deduplicare per message_id_external prima del grouping
```

### Risultato
- Il click sul messaggio mostra sempre il contenuto nel pannello destro
- Se l'AI non è disponibile, l'utente vede un messaggio chiaro invece del silenzio
- Niente più messaggi duplicati

