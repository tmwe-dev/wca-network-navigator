

# Piano: Isolamento Dati Personali per Operatore

## Architettura attuale — cosa è già isolato e cosa no

### GIA' ISOLATO per user_id (RLS `user_id = auth.uid()`)
- `channel_messages` (email, WhatsApp, LinkedIn) — ogni utente vede solo i suoi
- `activities` — ogni utente vede solo le sue
- `outreach_queue` — ogni utente vede solo la sua coda
- `email_sync_state`, `email_sync_jobs` — configurazione IMAP per utente
- `operators` — credenziali IMAP/SMTP/WhatsApp/LinkedIn per operatore

### CONDIVISO (tutti vedono tutto) — corretto, da mantenere
- `partners` — database aziendale condiviso
- `business_cards` — BCA condivisa (select = `true`)
- `imported_contacts` — contatti condivisi
- `partner_contacts` — contatti dei partner condivisi

### PROBLEMA: Circuito di attesa (Holding Pattern)
Il hook `useHoldingPatternList` carica partners/prospects/contatti in stati attivi (`contacted`, `in_progress`, `negotiation`) **senza filtrare per operatore**. Questo significa che un operatore vede nel circuito anche contatti lavorati da un collega.

## Cosa va modificato

### 1. Circuito di Attesa — filtrare per operatore
Il circuito deve mostrare solo i contatti che **l'operatore corrente ha effettivamente contattato**. La logica: un contatto appare nel mio circuito solo se esiste almeno un'attività (`activities`) mia (`user_id = auth.uid()`) per quel source_id.

**File:** `src/hooks/useHoldingPattern.ts`
- Dopo aver caricato i partner/prospect/contatti in stati attivi, cross-referenziare con `activities` dell'utente corrente
- Filtrare: mostra solo quelli per cui esiste almeno un record in `activities` con `user_id = auth.uid()` e `source_id = item.id`

### 2. Contatore messaggi non letti — già OK
`useUnreadCounts` interroga `channel_messages` che ha RLS su `user_id` — ogni operatore vede solo i suoi non letti.

### 3. Inreach (inbox) — già OK
`useChannelMessages` interroga `channel_messages` con RLS `user_id = auth.uid()` — ogni operatore vede solo la propria inbox.

### 4. Nessuna modifica RLS necessaria
Le policy RLS esistenti sono già corrette. Il problema è solo lato frontend nel circuito di attesa.

## Limiti del sistema attuale

1. **Partner condivisi ma lead_status globale**: se operatore A mette un partner in `contacted`, operatore B lo vede in quello stato. Il `lead_status` è una proprietà del partner, non dell'operatore. Questo è corretto per un CRM aziendale condiviso.

2. **Account "Global/Master"**: per il futuro, il master dovrà bypassare il filtro sul circuito. Si implementerà con un flag `is_admin` sull'operatore — se admin, non applica il filtro `activities.user_id`.

3. **Attività cross-operatore**: se operatore A crea un'attività per un partner e poi operatore B ne crea un'altra, entrambi vedranno quel partner nel proprio circuito — comportamento corretto.

## File coinvolti

| File | Modifica |
|------|----------|
| `src/hooks/useHoldingPattern.ts` | Aggiungere filtro: mostra solo item per cui l'utente ha almeno un'attività propria |

## Risultato
- Email/WhatsApp/LinkedIn: ogni operatore vede solo i propri messaggi (già funzionante)
- Circuito di attesa: ogni operatore vede solo i contatti che ha lavorato personalmente
- Partners/BCA/Contatti: restano condivisi (dati aziendali)
- Futuro account master: vedrà tutto senza filtro

