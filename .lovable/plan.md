

# Piano: Inbox Multi-Operatore + Campagne Distribuite per Tutor

## 1. Inbox Multi-Operatore per Admin

### Problema attuale
La RLS su `channel_messages` filtra per `user_id = auth.uid()`. L'admin vede solo le proprie email.

### Soluzione

**Database** — Aggiornare la policy RLS SELECT su `channel_messages`:
```sql
-- L'admin vede tutti i messaggi, l'operatore solo i propri
user_id = auth.uid() OR public.is_operator_admin()
```

**UI** — Modificare `InArrivoTab.tsx`:
- Se `currentOp.is_admin`: mostrare una barra di tab orizzontali sopra il canale (Email/WA/LI) con il nome di ogni operatore attivo + tab "Tutti"
- Passare un filtro `operatorUserId` a `EmailInboxView` / `WhatsAppInboxView` / `LinkedInInboxView`
- Ogni messaggio mostra un piccolo badge con il nome del tutor proprietario

**Hook** — Modificare `useChannelMessages.ts`:
- Aggiungere parametro opzionale `operatorUserId?: string`
- Se presente, filtrare `.eq("user_id", operatorUserId)` invece di usare solo RLS
- Se "Tutti", non aggiungere filtro (la RLS admin permette già tutto)

### File coinvolti
| File | Modifica |
|------|----------|
| Migration SQL | Aggiornare policy RLS SELECT su `channel_messages` |
| `src/components/outreach/InArrivoTab.tsx` | Tab orizzontali per operatore (solo admin) |
| `src/hooks/useChannelMessages.ts` | Filtro `operatorUserId` opzionale |
| `src/components/outreach/EmailInboxView.tsx` | Accettare prop `operatorUserId`, mostrare badge tutor |

---

## 2. Campagne Multi-Tutor per Admin

### Logica
Quando il master lancia una campagna:
1. Seleziona i target (paesi, contatti, filtri)
2. Il sistema raggruppa i contatti per operatore assegnato (o per territorio se non assegnato)
3. Per ogni operatore crea batch separati di `campaign_jobs` con `assigned_to = operator.user_id`
4. L'outreach queue processa ogni batch usando le credenziali SMTP/WA/LI dell'operatore assegnato

### Struttura dati
`campaign_jobs` ha già `assigned_to` — verrà popolato con il `user_id` dell'operatore.
L'edge function `send-email` dovrà risolvere le credenziali SMTP dal `user_id` del job, non dall'utente che ha lanciato la campagna.

### File coinvolti
| File | Modifica |
|------|----------|
| `src/hooks/useCampaignJobs.ts` | Funzione di distribuzione contatti per operatore |
| Mission Builder (cockpit) | Aggiungere step "Distribuzione per Tutor" con preview della suddivisione |
| `supabase/functions/send-email/index.ts` | Risolvere credenziali SMTP da `assigned_to` (operator) invece che da auth.uid() |

---

## 3. Visibilità Campagne per Ruolo

- **Operatore normale**: vede solo i job con `assigned_to = proprio user_id`
- **Admin/Master**: vede tutti i job, raggruppati per operatore, con contatore per tutor

### Risultato
- L'admin naviga le inbox di tutti gli operatori con tab orizzontali
- Ogni messaggio mostra a chi appartiene (tutor + agente AI)
- Le campagne vengono distribuite automaticamente per operatore
- Ogni operatore usa le proprie credenziali per l'invio
- L'operatore normale continua a vedere solo i propri dati

