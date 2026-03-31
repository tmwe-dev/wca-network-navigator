

# Coda Outreach AI → Esecuzione Automatica Frontend

## Architettura

L'agente AI (server-side) inserisce messaggi in una tabella `outreach_queue`. Il frontend li consuma automaticamente tramite le estensioni Chrome (WhatsApp/LinkedIn) o invio email diretto.

```text
Agent AI (edge function)
  └─ tool: queue_outreach
       └─ INSERT INTO outreach_queue (channel, recipient, message, status='pending')

Frontend (polling ogni 5s)
  └─ useOutreachQueue hook
       ├─ Legge record status='pending'
       ├─ WhatsApp → useWhatsAppExtensionBridge.sendWhatsApp()
       ├─ LinkedIn → useLinkedInExtensionBridge.sendDirectMessage()
       ├─ Email → supabase.functions.invoke('send-email')
       └─ UPDATE status='sent'/'failed' + result
```

## Implementazione

### 1. Nuova tabella `outreach_queue`

```sql
CREATE TABLE outreach_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email','linkedin','whatsapp','sms')),
  recipient_name TEXT,
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_linkedin_url TEXT,
  partner_id UUID,
  contact_id TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_by TEXT DEFAULT 'manual'
);
ALTER TABLE outreach_queue ENABLE ROW LEVEL SECURITY;
-- RLS: user_id = auth.uid()
ALTER PUBLICATION supabase_realtime ADD TABLE outreach_queue;
```

### 2. Nuovo tool `queue_outreach` in `agent-execute/index.ts`

Aggiungere alla lista ALL_TOOLS:
- Parametri: channel, recipient_name, recipient_email, recipient_phone, recipient_linkedin_url, partner_id, subject, body, priority
- Esecuzione: INSERT nella tabella outreach_queue con user_id e created_by='agent'
- L'agente puo' accodare singoli o batch di messaggi

### 3. Nuovo hook `src/hooks/useOutreachQueue.ts`

- Sottoscrive la tabella `outreach_queue` via Supabase Realtime (INSERT events)
- Quando arriva un record `pending`:
  - Verifica che l'estensione del canale sia disponibile
  - Aggiorna status a `processing`
  - Esegue l'invio tramite il bridge appropriato
  - Aggiorna status a `sent` o `failed` con timestamp e errore
- Retry automatico fino a `max_attempts`
- Delay configurabile tra invii (rate limiting: 5s WhatsApp, 10s LinkedIn)
- Toast notification per ogni messaggio inviato/fallito

### 4. Componente indicatore coda in `AIDraftStudio.tsx`

- Badge con contatore messaggi in coda
- Mini-lista dei prossimi messaggi da inviare
- Bottoni pausa/riprendi coda
- Log degli ultimi invii (successo/errore)

### 5. Integrazione in `AppLayout.tsx`

- Il hook `useOutreachQueue` viene montato a livello layout (sempre attivo)
- Indicatore nella header accanto alle icone connessione

## File coinvolti

| File | Azione |
|------|--------|
| Migration SQL | Nuova tabella `outreach_queue` + RLS |
| `supabase/functions/agent-execute/index.ts` | Tool `queue_outreach` + executor |
| `src/hooks/useOutreachQueue.ts` | Nuovo — consumer realtime |
| `src/components/cockpit/AIDraftStudio.tsx` | Badge coda + mini-monitor |
| `src/components/layout/AppLayout.tsx` | Mount hook globale |
| `src/components/layout/ConnectionStatusBar.tsx` | Indicatore coda attiva |

