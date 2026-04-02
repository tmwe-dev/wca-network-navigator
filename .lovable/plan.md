

# Ristrutturare la Sezione Messaggi: Tab Separati Email e WhatsApp

## Situazione attuale

- `InboxView.tsx` è un componente unico che mostra tutti i canali insieme con un filtro tab (Tutti/Email/WA)
- Il tab "Messaggi" in Outreach carica direttamente `InboxView`
- La tabella `channel_messages` è vuota ma pronta per entrambi i canali
- L'hook `useWhatsAppExtensionBridge.readUnread()` esiste ma non è collegato a nessuna UI
- `useCheckInbox` (email IMAP) funziona ed è collegato al pulsante "Scarica Posta"

## Piano

### 1. Sostituire il tab "Messaggi" con due tab separati nella barra verticale

Nella `VerticalTabNav` di Outreach, il tab "Messaggi" viene sostituito da:
- **Email** (icona Mail, badge unread email)
- **WhatsApp** (icona MessageCircle, badge unread WA)

### 2. Creare `EmailInboxView.tsx` — Vista dedicata Email

Layout master-detail (lista a sinistra, dettaglio a destra):
- Pulsante "Scarica Posta" (usa `useCheckInbox` esistente)
- Barra ricerca
- Lista messaggi email filtrata per `channel = 'email'`
- Dettaglio messaggio con subject, mittente, destinatario, body, badge associazione CRM
- Stile coerente con il resto della piattaforma

### 3. Creare `WhatsAppInboxView.tsx` — Vista dedicata WhatsApp

Layout chat-style (lista contatti a sinistra, conversazione a destra):
- Pulsante "Leggi WhatsApp" che chiama `readUnread()` dall'estensione
- Indicatore stato estensione (connessa/disconnessa)
- I messaggi ricevuti vengono salvati in `channel_messages` con `channel: 'whatsapp'`
- Lista contatti con ultimo messaggio e conteggio non letti
- Vista conversazione raggruppata per contatto (stile chat bubbles)

### 4. Creare hook `useWhatsAppInbox.ts`

Hook che:
- Usa `useWhatsAppExtensionBridge().readUnread()` per leggere i messaggi
- Salva ogni messaggio in `channel_messages` (upsert, dedup su `message_id_external` = hash contatto+ora+testo)
- Invalida le query per aggiornare la lista
- Ritorna stato (loading, count importati, errori)

### 5. Aggiornare conteggi unread separati

Modificare `useUnreadCount` per supportare filtro per canale, così ogni tab mostra il proprio badge.

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/outreach/EmailInboxView.tsx` | **Nuovo** — Vista email dedicata |
| `src/components/outreach/WhatsAppInboxView.tsx` | **Nuovo** — Vista WhatsApp stile chat |
| `src/hooks/useWhatsAppInbox.ts` | **Nuovo** — Hook lettura + salvataggio WA |
| `src/hooks/useChannelMessages.ts` | Aggiungere `useUnreadCountByChannel` |
| `src/pages/Outreach.tsx` | Sostituire tab Messaggi con Email + WhatsApp, 7 tab totali |

## Risultato

Due sezioni dedicate nella barra verticale di Outreach: Email con layout classico inbox, WhatsApp con layout conversazione stile chat. Ognuna con il proprio pulsante di sync e badge unread indipendente.

