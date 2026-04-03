

# Piano: Barra di Progresso Download Email in Tempo Reale

## Problema
Quando si preme "Scarica Tutto", l'unico feedback è un toast in basso che si aggiorna. L'utente non vede:
- Quante email sono già in database
- Il progresso in tempo reale nella UI principale
- L'ultima email scaricata

## Soluzione

Aggiungere una **barra di stato sync** visibile sopra la lista email durante il download, con contatori live e lista che si aggiorna in tempo reale.

### 1. Barra di progresso sync nell'EmailInboxView
Quando `isSyncing` è true, mostrare un pannello fisso tra toolbar e lista con:
- **Contatore totale**: "📬 42 email scaricate" (dal `progress.downloaded`)
- **Blocco corrente**: "Blocco 7..." (dal `progress.batch`)
- **Ultimo soggetto**: troncato, l'ultima email scaricata
- **Contatore DB**: numero totale email in database (da `messages.length` o query count separata)
- **Barra animata** (indeterminata, visto che non sappiamo il totale)

### 2. Hook useEmailCount
Nuovo hook leggero che fa `SELECT count(*) FROM channel_messages WHERE channel='email'` con polling ogni 3s durante il sync, per mostrare il contatore DB reale.

### 3. Realtime già attivo
Il realtime subscription su `channel_messages` (INSERT) già invalida la query, quindi le email appaiono nella lista man mano. Ma il `PAGE_SIZE=50` e l'ordinamento fanno sì che le nuove appaiano in cima — questo già funziona.

### 4. Lista che si aggiorna live
La query `useChannelMessages` viene già invalidata ad ogni batch nel loop sync. Le email dovrebbero già apparire. Verificheremo che il realtime INSERT trigger funzioni correttamente.

### File da modificare
- **`src/components/outreach/EmailInboxView.tsx`**: aggiungere pannello progresso sync tra toolbar e ScrollArea
- **`src/hooks/useEmailSync.ts`**: esporre `progress` più ricco (aggiungere `totalInDb`)
- **Nuovo `src/hooks/useEmailCount.ts`**: hook con polling count per il contatore DB totale

### Risultato visivo
```text
┌─────────────────────────────────────────┐
│ [Nuove] [Stop (42)] [Reset] [🔍 Cerca] │
├─────────────────────────────────────────┤
│ 📬 Sincronizzazione in corso...         │
│ ██████████░░░░░░  42 scaricate          │
│ 📊 156 email in database                │
│ 📄 "Re: Quotation for shipment..."      │
├─────────────────────────────────────────┤
│ ✉ Email 1 (appare in tempo reale)      │
│ ✉ Email 2                              │
│ ...                                     │
└─────────────────────────────────────────┘
```

