
# Integrazione Resend per Invio Email Diretto

## Cosa faremo

Sostituiremo il pulsante `mailto:` con un invio email diretto tramite Resend API, usando una Edge Function come backend. L'email partira' dal vostro dominio personalizzato, senza passare dal client di posta locale.

## Prerequisiti

Prima di procedere, servira':
1. **Creare un account Resend** su [resend.com](https://resend.com) (gratuito, 100 email/giorno)
2. **Verificare il dominio** dal pannello Resend (aggiungere i record DNS indicati da Resend)
3. **Generare una API Key** dal pannello Resend
4. La API Key verra' salvata in modo sicuro nel backend di Lovable Cloud

## Componenti da creare/modificare

### 1. Salvare la API Key di Resend

Useremo lo strumento di gestione segreti per richiedere la chiave `RESEND_API_KEY`.

### 2. Creare Edge Function `send-email`

File: `supabase/functions/send-email/index.ts`

La funzione:
- Riceve `to`, `subject`, `html`, `from` (opzionale), `partner_id` (opzionale)
- Chiama l'API Resend (`https://api.resend.com/emails`)
- Logga l'interazione nella tabella `interactions` (tipo `email`, con subject e destinatario)
- Restituisce successo/errore con CORS headers

Configurazione in `supabase/config.toml`:
```toml
[functions.send-email]
verify_jwt = false
```

### 3. Aggiornare il pulsante in `PartnerListPanel.tsx`

Il pulsante "Invia email":
- Apre un piccolo dialog/popover inline con:
  - Destinatario (pre-compilato, read-only)
  - Oggetto (pre-compilato, editabile)
  - Corpo messaggio (textarea)
  - Pulsante "Invia"
- Al click su "Invia", chiama la Edge Function `send-email`
- Mostra toast di successo/errore
- L'interazione viene salvata automaticamente nel database

### 4. Creare componente `SendEmailDialog.tsx`

File: `src/components/operations/SendEmailDialog.tsx`

Dialog modale compatto con:
- Campo "A" (read-only, email del contatto)
- Campo "Oggetto" (pre-compilato con "Contatto da {company_name}")
- Textarea "Messaggio"
- Select opzionale per template (futuro)
- Pulsanti "Annulla" e "Invia"
- Stato di caricamento durante l'invio
- Supporto tema chiaro/scuro (`isDark`)

## Flusso Utente

```text
1. Hover su partner nella lista Operations
2. Click sull'icona busta (Send)
3. Si apre dialog con destinatario pre-compilato
4. Utente scrive oggetto e messaggio
5. Click "Invia"
6. Edge Function invia via Resend + salva in DB
7. Toast "Email inviata con successo"
8. Dialog si chiude
```

## Dettagli Tecnici

### Edge Function `send-email`

```text
POST /send-email
Body: { to, subject, html, from?, partner_id? }

1. Legge RESEND_API_KEY da env
2. POST https://api.resend.com/emails con { from, to, subject, html }
3. Se partner_id presente, INSERT in interactions (tipo email)
4. Ritorna { success, messageId } o { error }
```

### Mittente predefinito

Il campo `from` usera' un indirizzo predefinito configurabile (es. `noreply@vostrodominio.com`). Potra' essere personalizzato nella tabella `app_settings` con chiave `default_sender_email`.

## File coinvolti

| File | Azione |
|------|--------|
| `supabase/functions/send-email/index.ts` | Nuovo |
| `supabase/config.toml` | Aggiungere sezione send-email |
| `src/components/operations/SendEmailDialog.tsx` | Nuovo |
| `src/components/operations/PartnerListPanel.tsx` | Modificare pulsante Send |

## Ordine di esecuzione

1. Richiedere la `RESEND_API_KEY` all'utente
2. Creare la Edge Function `send-email`
3. Creare il componente `SendEmailDialog`
4. Aggiornare `PartnerListPanel` per usare il dialog invece del `mailto:`
