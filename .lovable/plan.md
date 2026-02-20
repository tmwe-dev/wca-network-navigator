
# Sezione Email nelle Impostazioni + Test Invio

## Situazione attuale

Il sistema usa già **Resend** (API key già configurata) per inviare email tramite la funzione backend `send-email`. Attualmente il mittente è fisso su `onboarding@resend.dev` (fallback di default), oppure viene passato manualmente ad ogni richiesta.

Manca completamente una sezione nelle Impostazioni per configurare le credenziali email (indirizzo mittente + nome mittente) e testare l'invio.

## Vincolo importante: Resend e domini personalizzati

Resend non permette di inviare email da un dominio arbitrario senza prima verificarlo. Esistono due scenari:

1. **Dominio verificato su Resend** (es. `tmwe.it`) — permette di inviare da `luca@tmwe.it`
2. **Dominio non verificato** — Resend blocca l'invio con errore 422

Per `luca@tmwe.it`, il dominio `tmwe.it` deve essere aggiunto e verificato nel pannello Resend con record DNS (SPF, DKIM). Questo è un passaggio che l'utente deve fare direttamente su resend.com.

Nel frattempo, la sezione email mostrerà:
- Campo "Email mittente" (es. `luca@tmwe.it`)
- Campo "Nome mittente" (es. `Luca - TMWE`)
- Badge stato (Configurato / Non configurato)
- Pulsante **Salva**
- Card separata con pulsante **Invia Email di Test** a `luca@tmwe.it`
- Avviso informativo sul requisito di verifica dominio Resend

## Modifiche da apportare

### 1. `src/pages/Settings.tsx`
Aggiungere una nuova tab **Email** (con icona `Mail`) tra Generale e WCA contenente:
- Card "Mittente Email" con:
  - `Input` email mittente (si salva in `app_settings` con chiave `default_sender_email`)
  - `Input` nome mittente (si salva in `app_settings` con chiave `default_sender_name`)
  - Badge stato configurazione
  - Pulsante **Salva Impostazioni Email**
- Card "Test Invio" con:
  - `Input` pre-compilato con l'email mittente
  - Pulsante **Invia Email di Test** che chiama la funzione backend `send-email`
- Alert informativo su Resend e verifica dominio

### 2. `supabase/functions/send-email/index.ts`
Aggiornare la funzione per leggere anche `default_sender_name` e costruire il campo `from` nel formato corretto Resend: `"Nome <email@dominio.it>"`.

## Layout nuova tab Email

```text
┌─────────────────────────────────────────────────────┐
│  ✉️  Mittente Email                [✓ Configurato]  │
│  Email e nome che appariranno come mittente          │
├─────────────────────────────────────────────────────┤
│  Email mittente                                      │
│  [luca@tmwe.it_____________________]                │
│                                                      │
│  Nome mittente (opzionale)                           │
│  [Luca - TMWE______________________]                │
│                                                      │
│  [Salva Impostazioni Email]                          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  ⚠️  Verifica dominio Resend                         │
│  Per inviare da luca@tmwe.it devi verificare         │
│  il dominio tmwe.it su resend.com → Domains          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  🧪 Test Invio                                      │
├─────────────────────────────────────────────────────┤
│  Invia un'email di test a:                           │
│  [luca@tmwe.it_____________________]                │
│                                                      │
│  [Invia Email di Test]                               │
└─────────────────────────────────────────────────────┘
```

## File da modificare

| File | Modifica |
|------|---------|
| `src/pages/Settings.tsx` | Aggiungere tab "Email" con card configurazione mittente e test invio |
| `supabase/functions/send-email/index.ts` | Leggere `default_sender_name` e costruire `from` come `"Nome <email>"` |

## Dettagli tecnici

**Settings.tsx:**
- Aggiungere `emailSender`, `emailName`, `testEmailTo`, `savingEmail`, `sendingTest` come nuovi state
- `useEffect` esistente: aggiungere lettura di `default_sender_email` e `default_sender_name`
- Handler `handleSaveEmail`: salva entrambe le chiavi in `app_settings`
- Handler `handleTestEmail`: chiama `supabase.functions.invoke("send-email", { body: { to: testEmailTo, subject: "Test Email", html: "...", from: emailName ? "${emailName} <${emailSender}>" : emailSender } })`
- Importare `Mail`, `Send`, `AlertCircle` da lucide-react

**send-email/index.ts:**
- Se `default_sender_name` è presente in `app_settings`, costruire `from` come `"Nome <email>"` (formato corretto Resend)
- Nessun impatto sulle chiamate esistenti — backward compatible
