
# Sincronizzazione attività, invii diretti e agenda

## Problemi identificati

### 1. Email inviate manualmente non creano attività
Tre punti di invio email NON creano un record nella tabella `activities` dopo l'invio:
- **`EmailCanvas.handleSend`** (workspace) — riga 117-131
- **`useAIDraftActions.handleSend`** (cockpit drafts) — riga 141-163
- **`SendEmailDialog.handleSend`** (dialog diretto da Network/BCA) — riga 30-51

Solo `useSortingJobs.useSendJob` crea correttamente l'attività (perché aggiorna un'attività esistente da pending a completed).

### 2. Invii diretti finiscono nelle Campagne
Il tab "Invii Diretti" (`Sorting.tsx`) mostra solo le activities con `status=pending` e `email_body IS NOT NULL`. Quando l'utente invia un'email direttamente (senza passare dal workspace), non esiste un'activity corrispondente, quindi la lista è vuota. Nel frattempo, se l'email è stata inviata tramite il flusso campagne (`email_campaign_queue`), appare nella tab Campagne — che è corretto. Il problema è che gli invii manuali non hanno una traccia da nessuna parte.

### 3. Agenda non aggiornata con attività del giorno
`useTodayActivities` filtra solo `status=completed` e `created_at >= oggi`. Ma le email inviate manualmente non generano activity → l'agenda resta vuota. Inoltre, le attività WhatsApp e LinkedIn dovrebbero comparire allo stesso modo.

## Piano di intervento

### A. Creare un hook centralizzato `useTrackActivity`
**Nuovo file**: `src/hooks/useTrackActivity.ts`

Hook riutilizzabile che:
1. Recupera `user_id` da `supabase.auth.getUser()`
2. Inserisce un record in `activities` con status `completed`, `completed_at = now()`, `sent_at = now()` per le email
3. Aggiorna `lead_status` del partner/contatto importato (escalation da `new` → `contacted`)
4. Crea un record in `interactions` o `contact_interactions`
5. Invalida le query: `today-activities`, `all-activities`, `worked-today`, `sorting-jobs`

### B. Integrare il tracking in tutti i punti di invio

| File | Modifica |
|------|----------|
| `src/components/workspace/EmailCanvas.tsx` | Dopo `send-email` OK → chiamare `trackActivity("send_email", ...)` |
| `src/hooks/useAIDraftActions.ts` | Dopo invio OK → chiamare `trackActivity("send_email", ...)` |
| `src/components/operations/SendEmailDialog.tsx` | Dopo invio OK → chiamare `trackActivity("send_email", ...)` |

Ogni chiamata passa: `activity_type`, `title`, `source_id` (partner_id o contact_id), `source_type`, `email_subject`, `description`.

### C. Separare "Invii Diretti" dalle "Campagne" nella tab In Uscita

**File**: `src/hooks/useSortingJobs.ts`
- Aggiungere filtro `.is("campaign_batch_id", null)` alla query — così mostra solo attività NON parte di una campagna batch

Questo garantisce che nel tab "Invii Diretti" si vedano solo le email generate singolarmente (workspace/cockpit), mentre le campagne batch restano nel tab "Campagne".

### D. Mostrare anche le attività completate (invii fatti) nella tab Invii Diretti

Attualmente il sorting mostra solo `status=pending`. Aggiungere una sezione "Inviati oggi" sotto la lista pending, con le attività `status=completed` e `sent_at >= oggi` e `campaign_batch_id IS NULL`, in modo che l'utente veda lo storico degli invii diretti della giornata.

### E. Agenda: includere tutte le attività del giorno

**File**: `src/hooks/useTodayActivities.ts`
- Rimuovere il filtro `.eq("status", "completed")` — mostrare tutte le attività del giorno (pending, in_progress, completed)
- Aggiungere il campo `status` al mapping per differenziare visivamente

**File**: `src/components/cockpit/TodayActivityCarousel.tsx`
- Aggiungere icona/badge per lo status (pending = cerchio, completed = check verde)

## File coinvolti

| File | Azione |
|------|--------|
| `src/hooks/useTrackActivity.ts` | Nuovo: hook centralizzato per tracciamento |
| `src/components/workspace/EmailCanvas.tsx` | Aggiungere tracking post-invio |
| `src/hooks/useAIDraftActions.ts` | Aggiungere tracking post-invio |
| `src/components/operations/SendEmailDialog.tsx` | Aggiungere tracking post-invio |
| `src/hooks/useSortingJobs.ts` | Filtrare `campaign_batch_id IS NULL` |
| `src/hooks/useTodayActivities.ts` | Rimuovere filtro status=completed, aggiungere status |
| `src/components/cockpit/TodayActivityCarousel.tsx` | Badge status nelle attività |

## Risultato atteso

Ogni email inviata (da qualsiasi punto del sistema) genera automaticamente un'attività completata, aggiorna lo status del contatto/partner, e appare immediatamente nell'agenda del giorno e nella sezione "Invii Diretti". Le campagne batch restano separate nel loro tab dedicato.
