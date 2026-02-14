
# Piano: Selezione Cumulativa Contatti nella Pagina Jobs

## Problema attuale

Ora per lavorare sui contatti bisogna aprire un job alla volta, selezionare i contatti dentro la canvas, e ripetere per ogni azienda. Se hai 50 job, devi aprirli uno per uno.

## Soluzione: Lista contatti piatta a sinistra con selezione bulk

Trasformare la colonna sinistra da "lista di aziende" a "lista di contatti raggruppati per azienda". Ogni contatto e' una riga selezionabile con checkbox individuale. In alto, pulsanti per "Seleziona tutti", "Solo con email", "Deseleziona tutti". Cliccando su un contatto, la canvas a destra mostra i dettagli dell'azienda e del contatto selezionato. I contatti spuntati restano selezionati anche cambiando il focus sulla canvas.

### Colonna sinistra -- Lista contatti (con raggruppamento azienda)

La lista mostra tutti i contatti di tutti i job, raggruppati sotto l'header dell'azienda:

```text
--- Acme Logistics (Dubai, AE) ---
[x] Mr. Ahmed · CEO · ahmed@acme.ae · +971...
[ ] Ms. Fatima · Ops Mgr · fatima@acme.ae
--- Global Freight (Mumbai, IN) ---
[x] Mr. Raj · Director · raj@global.in
[ ] Ms. Priya · (no email)
```

- Checkbox su ogni contatto per selezione cumulativa
- Header azienda cliccabile per espandere/collassare
- Barra in alto con: "Seleziona tutti" / "Solo con email" / "Solo con telefono" / "Deseleziona"
- Contatore: "12 contatti selezionati su 45"
- I filtri esistenti (tipo, stato, ricerca) restano e filtrano a livello azienda

### Colonna destra -- Canvas (adattata)

Quando un contatto viene cliccato (non solo checkato), la canvas mostra:
- Info azienda (come ora)
- Dettaglio del contatto evidenziato
- Note e azioni per quel job specifico

Quando ci sono contatti selezionati (checkati), in alto nella canvas appare una **barra azioni bulk**:
- "Prepara Email per 12 contatti" -- imposta tutti i job collegati come tipo email
- "Programma Call per 12 contatti" -- imposta tutti come tipo call
- "Segna 12 come completati"
- Contatore visivo dei selezionati

### Flusso

1. L'utente apre la pagina Jobs
2. Vede la lista di tutti i contatti raggruppati per azienda
3. Seleziona con checkbox quelli che vuole (o usa "Seleziona tutti con email")
4. Nella canvas, usa le azioni bulk per gestirli tutti insieme
5. Oppure clicca su un singolo contatto per lavorarlo nella canvas

## Dettaglio tecnico

### File da modificare

**`src/components/campaigns/JobList.tsx`**
- Ristrutturare da lista piatta di job a lista raggruppata: header azienda + contatti sotto
- Ogni contatto ha una checkbox indipendente
- Lo stato di selezione viene gestito con un `Set<string>` di contact IDs, sollevato a livello di `CampaignJobs.tsx`
- Aggiungere toolbar in alto con pulsanti di selezione rapida (tutti, solo email, solo telefono, nessuno)
- Il click sulla riga seleziona il contatto per il focus nella canvas; la checkbox gestisce la selezione cumulativa

**`src/components/campaigns/JobCanvas.tsx`**
- Aggiungere una barra azioni bulk in alto quando `selectedContactIds.length > 0`
- La barra mostra contatore e azioni di massa (prepara email, programma call, completa)
- Il resto della canvas mostra il singolo contatto/job su cui si e' fatto click (focus)

**`src/pages/CampaignJobs.tsx`**
- Sollevare lo stato `selectedContactIds: Set<string>` qui
- Passare a JobList e JobCanvas le callback per gestire selezione
- Aggiungere le funzioni bulk: completare tutti i job dei contatti selezionati, cambiare tipo in massa

**`src/hooks/useCampaignJobs.ts`**
- Nessuna modifica necessaria: `useJobContacts` gia' carica tutti i contatti per partner_id

### Nessuna migrazione database necessaria

I dati sono gia' tutti disponibili nella tabella `partner_contacts`. La selezione e' puramente lato client.
