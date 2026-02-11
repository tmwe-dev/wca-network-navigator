
# Piano: Ottimizzazione Download — Salta Partner Completi, No Logout, Auto-Detect Network

## Stato attuale verificato

- **Job US in corso**: 3 job attivi, uno a index 63/1030 con 29 contatti trovati e 34 mancanti — funziona
- **211 partner US** nel database, di cui 10 con email
- **Nessun codice di auto-login** viene chiamato dal frontend o dai job in background — il commento in `check-wca-session` lo conferma: "Never call wca-auto-login from here"
- **`network_configs`** ha dati errati: quasi tutti i flag `has_contact_emails/phones` sono `false`, ma i dati reali mostrano che TUTTI i network principali hanno centinaia di contatti con email
- Il download attuale ri-scarica TUTTI gli ID, inclusi quelli gia' completi di contatti

## Modifiche

### 1. Skip partner gia' completi nel job processor

**File**: `supabase/functions/process-download-job/index.ts`

Prima di chiamare `scrape-wca-partners` per ogni WCA ID, verificare se il partner esiste gia' con contatti completi (email + telefono in `partner_contacts`). Se completo, saltarlo e avanzare l'indice senza fare la richiesta HTTP.

Logica:
```text
Per ogni wcaId:
  1. Cerca partner con quel wca_id
  2. Se esiste, cerca in partner_contacts se ha almeno un contatto con email E (direct_phone O mobile)
  3. Se completo -> skip, aggiorna current_index, segna come "skipped_complete"
  4. Se incompleto o non esiste -> scarica normalmente
```

Questo risparmia tempo e richieste HTTP per i partner gia' acquisiti correttamente.

### 2. Opzione "Scarica solo incompleti" nell'ActionPanel e nella Dashboard

**File**: `src/components/download/ActionPanel.tsx`

Aggiungere un checkbox "Salta partner con contatti completi" (attivo per default). Quando attivo, il job esclude dalla lista `wca_ids` quelli gia' completi prima ancora di creare il job. Cosi' il job parte gia' con la lista filtrata.

**File**: `src/hooks/useDownloadJobs.ts`

Aggiungere al `useCreateDownloadJob` un parametro opzionale `skipComplete: boolean` che, se true, filtra gli ID prima di inserirli nel job.

### 3. Auto-aggiornamento `network_configs` con dati reali

**File**: `supabase/functions/process-download-job/index.ts`

Al completamento di un job, dopo la verifica di completezza, aggiornare automaticamente la riga corrispondente in `network_configs` con i flag corretti basati sui dati reali estratti (conteggio email, telefoni, nomi nei `partner_contacts` per quel network).

### 4. Verifica assenza di logout involontario

Ho analizzato tutto il codice server-side e client-side:
- **`wca-auto-login`** esiste ma NON viene mai chiamato dal frontend ne' dai job (confermato: zero riferimenti in `src/`)
- **`check-wca-session`** ha un commento esplicito: "Never call wca-auto-login from here"
- **Nessuna funzione** esegue logout o invalida il cookie

Il sistema NON fa logout. La perdita di sessione avviene naturalmente quando il cookie `.ASPXAUTH` scade lato server WCA (tipicamente dopo alcune ore). Non c'e' codice da rimuovere.

### 5. Aggiornamento `network_configs` con dati corretti

**Migrazione SQL**: Aggiornare i flag `has_contact_emails`, `has_contact_names`, `has_contact_phones` con i dati reali gia' presenti nel database. Tutti i network WCA principali hanno contatti — i flag attuali sono errati.

## File modificati

| File | Modifica |
|------|----------|
| `supabase/functions/process-download-job/index.ts` | Skip partner completi + aggiornamento network_configs a fine job |
| `src/components/download/ActionPanel.tsx` | Checkbox "Salta completi" + filtro pre-job |
| `src/hooks/useDownloadJobs.ts` | Supporto parametro `skipComplete` |
| Migrazione SQL | Aggiornamento flag `network_configs` con dati reali |
