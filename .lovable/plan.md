

# Fix: Invio WhatsApp dalla Inbox fallisce con "Contatto non trovato"

## Problema

Quando rispondi a un messaggio WhatsApp dalla inbox, il sistema passa il **nome del contatto** (es. "Jose Programmatore Cuba") alla funzione `sendWhatsApp`. L'estensione cerca quel nome nella barra di ricerca di WhatsApp Web, ma se non trova corrispondenza esatta e il nome non contiene cifre, restituisce "Contatto non trovato".

Il fallback via URL (`web.whatsapp.com/send?phone=...`) funziona solo se la stringa contiene almeno 6 cifre — un nome come "Jose Programmatore Cuba" non ne ha nessuna.

## Soluzione

Doppia strategia di invio nel componente `WhatsAppInboxView`:

1. **Estrarre il numero di telefono dal `raw_payload`** dei messaggi del thread (spesso contiene un campo `phone`, `jid` o un numero nel campo `contact`)
2. **Tentare prima con il nome** (ricerca nella chat list di WhatsApp Web)
3. **Se fallisce, ritentare con il numero di telefono** se disponibile
4. **Come ultimo fallback**, aprire `web.whatsapp.com/send?phone=...` se il numero e disponibile

## Modifiche

### 1. `src/components/outreach/WhatsAppInboxView.tsx`

- Aggiungere una funzione helper `extractPhoneFromThread(thread)` che scansiona `raw_payload` dei messaggi del thread per estrarre un numero di telefono (cerca campi `phone`, `jid`, `sender`, o pattern numerici nel campo `contact`)
- Modificare `handleSendReply`:
  - Prima tentativo con `sendWhatsApp(activeTab, text)` (nome contatto — cerca nella search bar)
  - Se fallisce con "Contatto non trovato", estrarre il telefono dal thread e ritentare con `sendWhatsApp(phone, text)`
  - Se anche il secondo tentativo fallisce, mostrare errore con suggerimento

### 2. `public/whatsapp-extension/actions.js`

- Migliorare la funzione `openChat`: se la ricerca per nome fallisce, provare anche a cercare con varianti del nome (solo il primo nome, senza cognome/suffissi)
- Abbassare la soglia minima per il fallback URL da 6 a 5 cifre per essere piu tolleranti con numeri corti

## Dettaglio tecnico

```text
handleSendReply flow:
  1. sendWhatsApp(contactName, text)
     ├─ extension searches WA Web → found → send → OK
     └─ "Contatto non trovato"
  2. extractPhone from thread's raw_payload
     ├─ phone found → sendWhatsApp(phone, text) → retry
     └─ no phone → show error with context
```

La funzione `extractPhoneFromThread` cercherà in ordine:
- `raw_payload.phone`
- `raw_payload.jid` (formato `391234567890@s.whatsapp.net`)
- `raw_payload.sender`
- Pattern numerico nel campo `contact` stesso (se contiene cifre come "+39...")

