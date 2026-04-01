

# Due Canali Bidirezionali: WhatsApp Inbox + Email Inbox

## Stato attuale

| Canale | Invio | Ricezione/Lettura |
|--------|-------|-------------------|
| **WhatsApp** | ✅ Via estensione Chrome (web.whatsapp.com) | ❌ Nessuna lettura risposte |
| **Email** | ✅ SMTP Aruba (send-email, process-email-queue) | ❌ Nessuna lettura inbox |
| **LinkedIn** | ✅ Via estensione Chrome | ❌ Nessuna lettura risposte |

Entrambi i canali sono **solo uscita**. Non c'è modo di sapere se un contatto ha risposto, nè di leggere o rispondere dal sistema.

---

## 1. WhatsApp — Lettura risposte e conversazione

### Problema
L'estensione attuale apre una tab web.whatsapp.com, invia il messaggio e la chiude. Non monitora le risposte.

### Soluzione: WhatsApp Business API (Cloud API)
Lo scraping di web.whatsapp.com per leggere messaggi è fragile e viola i ToS. L'unica via affidabile è la **WhatsApp Business API** (Meta Cloud API), che fornisce webhook per i messaggi in arrivo.

**Flusso:**
1. L'utente configura un numero WhatsApp Business (tramite Meta Business Manager)
2. Meta invia un webhook a una Edge Function `whatsapp-webhook` per ogni messaggio ricevuto
3. La Edge Function fa match del numero mittente con `partner_contacts.mobile`, `imported_contacts.phone`, `prospects.phone`
4. Il messaggio viene salvato in una nuova tabella `channel_messages`
5. La UI mostra una inbox WhatsApp con le conversazioni raggruppate per contatto
6. L'utente può rispondere direttamente — il messaggio parte via Cloud API (non più via estensione)

**Prerequisiti:** Account Meta Business, numero WhatsApp Business verificato, token API. Costo: gratuito per i primi 1000 messaggi/mese, poi ~$0.05/messaggio.

**Alternativa senza API:** Estendere l'estensione Chrome per fare polling periodico su web.whatsapp.com e leggere i messaggi non letti. Più fragile, funziona solo a browser aperto, ma zero costi e zero setup esterno.

### 2. Email — Lettura inbox e match con contatti

### Problema
Il sistema invia email via SMTP Aruba ma non legge le risposte. Non c'è modo di sapere chi ha risposto.

### Soluzione: IMAP Polling via Edge Function
Aruba supporta IMAP. Una Edge Function `check-inbox` si connette periodicamente alla casella, legge le email nuove, fa match del mittente con i contatti nel circuito di attesa.

**Flusso:**
1. Edge Function `check-inbox` (cron ogni 5 minuti) si connette via IMAP alla casella configurata
2. Legge le email non lette (UNSEEN)
3. Per ogni email: match `From:` con `partners.email`, `partner_contacts.email`, `imported_contacts.email`, `prospects.email`
4. Se match trovato → salva in `channel_messages` con riferimento al contatto
5. Aggiorna `last_interaction_at` e `interaction_count` del contatto
6. La UI mostra l'inbox con le conversazioni raggruppate
7. L'utente può rispondere — il messaggio parte via SMTP (sistema già esistente)

### DB: Tabella unificata `channel_messages`

```
channel_messages:
  id, user_id, channel (whatsapp|email|linkedin|sms),
  direction (inbound|outbound),
  source_type (partner|contact|prospect|business_card|manual),
  source_id,
  partner_id (nullable),
  from_address, to_address,
  subject (nullable, solo email),
  body_text, body_html (nullable),
  message_id_external (message-id email o wa message id),
  in_reply_to (nullable, per threading),
  read_at (nullable),
  created_at
```

Questa tabella unifica TUTTI i messaggi in/out su tutti i canali. Permette di vedere la cronologia completa di comunicazione con ogni contatto.

### UI: Tab "Messaggi" nell'Outreach

Nuovo sotto-tab nell'area Outreach con:
- Lista conversazioni raggruppate per contatto, ordinate per ultimo messaggio
- Badge con conteggio messaggi non letti
- Filtro per canale (WhatsApp / Email / Tutti)
- Click su conversazione → thread completo con possibilità di rispondere
- Match automatico: ogni messaggio mostra il nome del contatto/partner associato e il suo status nel circuito di attesa

---

## Domanda chiave prima di procedere

Per WhatsApp ci sono due strade molto diverse. Per email, IMAP è l'unica via pratica con Aruba.

---

## File coinvolti

| File | Cosa |
|------|------|
| Migration | Tabella `channel_messages` + indici |
| `supabase/functions/check-inbox/index.ts` | IMAP polling, match contatti, salvataggio |
| `supabase/functions/whatsapp-webhook/index.ts` | Webhook Meta per messaggi in arrivo (se Cloud API) |
| `src/components/outreach/InboxView.tsx` | UI inbox con conversazioni |
| `src/components/outreach/ConversationThread.tsx` | Thread singola conversazione |
| `src/hooks/useChannelMessages.ts` | Hook per lettura/invio messaggi |
| Cockpit/ContactCard | Badge messaggi non letti per contatto |

## Ordine consigliato

1. **Email Inbox** (IMAP) — usa infrastruttura SMTP già configurata, nessun setup esterno
2. **WhatsApp** — richiede decisione su approccio (API vs estensione)

