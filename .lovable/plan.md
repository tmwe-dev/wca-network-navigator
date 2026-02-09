

# Piano: Re-download completo partner per recuperare contatti

## Situazione attuale

- 290 partner nel database, quasi tutti senza email/telefoni dei responsabili
- Solo ~21 partner hanno email dei contatti personali (7%)
- Causa: i dati dei contatti sono protetti ("Members only") e servono le credenziali WCA attive

## Cosa faremo

Creeremo una funzione "Re-sync Contatti" nella pagina Download Management che ri-scarica tutti i partner gia presenti nel DB, network per network, usando il cookie di sessione WCA per accedere ai dati riservati (email, telefoni diretti, cellulari).

## Flusso operativo

1. L'utente va in **Impostazioni** e incolla il cookie di sessione WCA (gia implementato)
2. Nella pagina **Download Management**, appare una nuova azione **"Aggiorna Contatti"**
3. L'utente seleziona uno o piu network WCA da aggiornare
4. Il sistema mostra per ogni network: quanti partner ci sono e quanti mancano di contatti completi
5. Click su **Avvia** -> il sistema ri-scarica ogni partner tramite il suo `wca_id`, sovrascrivendo i contatti con quelli completi
6. Il processo gira in background (stessa architettura `process-download-job`) e puo essere messo in pausa/ripreso

## Dettagli tecnici

### 1. Nuovo tipo di job: "resync"
Estendere la tabella `download_jobs` per supportare un nuovo tipo di operazione. Aggiungere una colonna `job_type` (default `'download'`, nuovi valori: `'resync'`).

### 2. Nuova sezione UI in Download Management
Aggiungere una terza opzione nella schermata iniziale: **"Aggiorna Contatti"** (icona RefreshCw), accanto a "Scarica Partner" e "Arricchisci".

La schermata di configurazione mostra:
- Lista dei network con checkbox
- Per ogni network: numero totale partner e numero con contatti mancanti
- Badge visivo verde/arancione per indicare la completezza
- Selezione della velocita (come per il download normale)

### 3. Logica di re-sync
- Recuperare tutti i `wca_id` dei partner nel DB, filtrati per network selezionati
- Creare un `download_job` con `job_type = 'resync'` e la lista di `wca_id`
- La edge function `process-download-job` chiama `scrape-wca-partners` come gia fa
- Lo scraper sovrascrive/aggiorna i contatti esistenti (upsert gia implementato)

### 4. Query per recuperare i WCA ID per network

```text
SELECT DISTINCT p.wca_id 
FROM partners p 
JOIN partner_networks pn ON pn.partner_id = p.id 
WHERE pn.network_name = 'WCA Inter Global'
AND p.wca_id IS NOT NULL
```

### 5. Prioritizzazione "senza contatti"
Opzione per scaricare prima i partner che non hanno ancora contatti completi, poi quelli da aggiornare:

```text
ORDER BY (
  EXISTS(SELECT 1 FROM partner_contacts pc 
         WHERE pc.partner_id = p.id 
         AND pc.email IS NOT NULL)
) ASC
```

### 6. Monitoraggio risultati
Durante il re-sync, il pannello di monitoraggio mostra:
- Contatore "Contatti trovati" (quanti partner hanno ricevuto email/telefoni)
- Contatore "Gia completi" (saltati perche avevano gia i dati)
- Barra di progresso con percentuale

### File da modificare/creare

| File | Azione |
|------|--------|
| `src/pages/DownloadManagement.tsx` | Aggiungere action "resync", schermata configurazione per network, schermata running |
| `supabase/functions/process-download-job/index.ts` | Nessuna modifica necessaria - gia gestisce liste di wca_id |
| Migrazione DB | Aggiungere colonna `job_type` a `download_jobs` |

### Prerequisito importante
Il cookie di sessione WCA deve essere salvato nelle Impostazioni prima di avviare il re-sync, altrimenti i contatti non saranno visibili e il download produrra gli stessi dati incompleti.
