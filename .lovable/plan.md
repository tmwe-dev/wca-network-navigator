

## Piano: Reset e Risincronizzazione Partners

### Contesto

Attualmente la tabella locale `partners` contiene **12.193 record** scaricati dalla tabella sbagliata (`partners` nell'esterno, che non esiste come tabella separata — i dati sono stati mappati da `wca_directory`). La fonte corretta è **`wca_partners`** nel DB esterno (2.687 record già processati dal software esterno).

### Dati da cancellare (tabella locale)

| Tabella | Record attuali |
|---|---|
| `partners` | 12.193 |
| `partner_contacts` | 7.114 |
| `partner_networks` | 19.869 |
| `partner_services` | 0 |
| `partner_certifications` | 0 |
| `partner_social_links` | 8 |

### Step 1 — Svuotare tabelle locali (migrazione)

Eseguire un `TRUNCATE CASCADE` sulle tabelle partner e dati associati:

```sql
TRUNCATE TABLE partner_contacts, partner_networks, partner_services, 
  partner_certifications, partner_social_links, partners_no_contacts CASCADE;
TRUNCATE TABLE partners CASCADE;
```

Questo rimuove anche i dati di deep search, alias, etc. che sono colonne nella tabella `partners` stessa (`enrichment_data`, `company_alias`, `enriched_at`, `ai_parsed_at`).

### Step 2 — Correggere la Edge Function `sync-wca-partners`

Cambiare la sorgente dati da `"partners"` a **`"wca_partners"`** nel DB esterno. Questo riguarda:

- **Riga 70**: conteggio — `.from("partners")` → `.from("wca_partners")`
- **Riga 93**: fetch batch — `.from("partners")` → `.from("wca_partners")`
- **Riga 145**: fetch contatti — `.from("partner_contacts")` → verificare se esiste nell'esterno o se i contatti sono dentro `wca_partners`
- **Riga 164**: fetch networks — `.from("partner_networks")` → verificare se esiste nell'esterno

I campi di `wca_partners` potrebbero avere una struttura diversa da `partners`, quindi dovrò verificare lo schema e rimappare di conseguenza.

### Step 3 — Deploy e risincronizzazione

1. Deploy della Edge Function corretta
2. L'utente seleziona i paesi dalla UI Network e lancia il sync
3. I dati vengono importati da `wca_partners` (2.687 record)

### Dettagli tecnici

- Le tabelle con `partner_id` come FK (activities, campaign_jobs, channel_messages, cockpit_queue, etc.) non vengono toccate direttamente — il TRUNCATE CASCADE gestirà le dipendenze
- Il vincolo di unicità su `wca_id` resta attivo per futuri upsert
- Dopo il sync, i conteggi dovrebbero corrispondere esattamente al DB esterno

