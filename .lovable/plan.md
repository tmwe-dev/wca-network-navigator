

# Piano Integrazione Sistema Import Interno

## Analisi Comparativa: TMWEngine vs Progetto Attuale

### Cosa fa TMWEngine (Import Templates)

```text
┌──────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌──────────────┐
│  Upload CSV  │───▶│  import_logs      │───▶│ process-ai-import│───▶│ imported_    │
│  (file →     │    │  (tracciamento)   │    │ (AI normaliz.)  │    │ contacts     │
│   storage)   │    │                   │    │                 │    │ (temp table) │
└──────────────┘    └──────────────────┘    └─────────────────┘    └──────┬───────┘
                                                                          │
                    ┌──────────────────┐    ┌─────────────────┐           │
                    │ import_errors    │◀───│ Error Monitor   │           │
                    │ (AI correction)  │    │ (batch fix)     │           │
                    └──────────────────┘    └─────────────────┘           │
                                                                          ▼
                    ┌──────────────────┐    ┌─────────────────┐    ┌──────────────┐
                    │ email_campagne_  │◀───│ Crea Attività/  │◀───│ Selezione    │
                    │ queue (invio     │    │ Campagna        │    │ contatti     │
                    │ progressivo)     │    │                 │    │ (checkbox)   │
                    └──────────────────┘    └─────────────────┘    └──────────────┘
```

### Cosa ha già il progetto attuale

```text
┌──────────────┐    ┌──────────────────┐
│  CSVImport   │───▶│  partners        │   ← Import diretto, nessun staging
│  (Settings)  │    │  (tabella finale)│
└──────────────┘    └──────────────────┘

┌──────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Workspace   │───▶│  activities      │───▶│  Sorting        │   ← "Dogana" per review
│  (AI email)  │    │  (email_body)    │    │  (approv./invio)│
└──────────────┘    └──────────────────┘    └─────────────────┘
```

---

## Cosa Manca e Cosa Serve

### 1. Sistema di Import a 2 Fasi (ALTA PRIORITA)
L'attuale `CSVImport` inserisce direttamente in `partners` senza staging, validazione AI, o gestione errori. Serve:

- **Tabella `import_logs`** — traccia ogni upload (file, righe totali, stato, errori)
- **Tabella `imported_contacts`** — staging temporaneo pre-validazione
- **Tabella `import_errors`** — log errori con supporto correzione AI
- **Storage bucket `import-files`** — per conservare i file originali
- **Edge function `process-ai-import`** — normalizzazione AI batch (Gemini Flash) con mapping colonne intelligente
- **Componente `ImportProgressMonitor`** — polling real-time del progresso
- **Pagina/sezione dedicata** — non più nascosta in Settings, ma accessibile dalla sidebar

### 2. Da Staging a Partner/Attività (MEDIA PRIORITA)
Una volta validati i contatti importati:

- Selezionare contatti dallo staging e creare **attività** (send_email, phone_call) — che finiscono nel Sorting
- Oppure creare una **campagna** (batch di attività con `campaign_batch_id`)
- Trasferimento opzionale in `partners` + `partner_contacts`

### 3. Coda Email Progressiva (BASSA PRIORITA — gia parzialmente coperta)
Il Workspace + Sorting già gestiscono il flusso email AI → review → invio. TMWEngine aggiunge la tabella `email_campagne_queue` per invio temporizzato (intervallo minuti). Questo è un miglioramento futuro del Sorting.

---

## Compatibilita con l'Architettura Esistente

| Componente TMWEngine | Equivalente attuale | Compatibile? | Azione |
|---|---|---|---|
| `import_logs` | Nessuno | Da creare | Nuova tabella |
| `imported_contacts` (staging) | `CSVImport` → `partners` diretto | Da creare | Nuova tabella staging |
| `import_errors` | Nessuno | Da creare | Nuova tabella |
| `process-ai-import` (edge fn) | Nessuno | Da creare | Nuova edge function con Lovable AI |
| `attivita` (TMW) | `activities` (nostro) | Gia compatibile | I campi sono mappabili |
| `email_campagne_queue` | `activities` + Sorting | Parzialmente coperto | Il Sorting fa gia da "coda" |
| `rubrica` (TMW) | `partners` + `partner_contacts` | Gia compatibile | Mapping diretto |
| Template email (TMW) | `email_templates` | Gia presente | Nessuna modifica |

---

## Piano Lavori Dettagliato

### Fase 1: Database — Tabelle di Staging e Log
Creare le migrazioni per:

1. **`import_logs`** — `id, user_id, file_name, file_url, file_size, total_rows, imported_rows, error_rows, status (pending/processing/completed/failed), normalization_method (column_mapping/ai), processing_batch, total_batches, created_at, completed_at`
2. **`imported_contacts`** — `id, import_log_id, row_number, company_name, name, email, phone, mobile, country, city, address, zip_code, note, origin, company_alias, contact_alias, is_selected, is_transferred, raw_data (jsonb), created_at`
3. **`import_errors`** — `id, import_log_id, row_number, error_type, error_message, raw_data (jsonb), corrected_data (jsonb), status (pending/corrected/dismissed), attempted_corrections, ai_suggestions (jsonb), created_at`
4. **Storage bucket** `import-files` (pubblico per download)
5. RLS policies per tutte le tabelle (auth.uid() IS NOT NULL)

### Fase 2: Edge Function — AI Import Processing
Creare `process-ai-import` che:
- Legge batch di record da `imported_contacts` (raw_data)
- Chiama Lovable AI (Gemini 2.5 Flash) per normalizzazione
- Aggiorna i record con dati normalizzati
- Logga errori in `import_errors`
- Aggiorna progresso in `import_logs`

### Fase 3: UI — Pagina Import Interna
Creare una nuova pagina `/import` (o sezione in Settings) con:
- Upload file (CSV/Excel) → salva in storage + crea `import_log`
- Selezione modalita: mapping colonne manuale vs AI
- Monitor progresso real-time
- Visualizzazione record importati con filtri
- Selezione multipla → "Crea Attivita" o "Crea Campagna"
- Trasferimento a `partners`/`partner_contacts`

### Fase 4: Monitor Errori
- Visualizzazione errori per import
- Correzione AI batch (25 record alla volta)
- Prompt personalizzabile
- Tracking token/costi

### Fase 5: Integrazione con Flusso Esistente
- I contatti importati che diventano attivita `send_email` → finiscono automaticamente nel **Sorting**
- Le campagne create da import usano lo stesso `campaign_batch_id` dell'Agenda
- Il Workspace puo generare email AI anche per contatti importati

---

## Sidebar — Nuova Voce

Aggiungere nella sezione "Gestione" della sidebar:
- **"Import"** con icona `Upload` — rotta `/import`

---

## Vantaggi dell'Implementazione

1. **Tracciabilita completa** — ogni file importato e loggato con stato e progresso
2. **Qualita dati** — normalizzazione AI elimina errori di formato, aggiunge prefissi telefonici, standardizza paesi
3. **Gestione errori** — invece di perdere righe, gli errori sono recuperabili con AI
4. **Flusso unificato** — import → staging → attivita/campagna → Sorting → invio, tutto nella stessa piattaforma
5. **Compatibilita** — si appoggia sulle tabelle `activities` e `partners` esistenti senza rompere nulla

