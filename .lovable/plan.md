

# Tracciamento Network e Esclusione Dinamica durante l'Acquisizione

## Obiettivo

Durante l'acquisizione, monitorare in tempo reale quali network WCA danno contatti (email/telefono) e quali no. Mostrare le statistiche per network in un banner e permettere di escludere al volo i network che non producono risultati, saltando i partner associati solo a quei network.

## Come funziona

Ogni partner estratto ha gia' i network associati (il codice li carica da `partner_networks` a riga 164-166). Dopo l'estrazione dei contatti, il sistema aggiorna un contatore per-network:
- Partner con contatti: network X -> successo +1
- Partner senza contatti: network X -> vuoto +1

Se un network ha 0% di successo dopo N partner, viene evidenziato in rosso con un pulsante per escluderlo. Escluderlo salta automaticamente i partner rimanenti nella coda che appartengono SOLO a quel network.

## Modifiche

### 1. Stato network stats in `AcquisizionePartner.tsx`

Aggiungere uno stato per tracciare le performance per network:

```typescript
const [networkStats, setNetworkStats] = useState<Record<string, { success: number; empty: number }>>({});
const [excludedNetworks, setExcludedNetworks] = useState<Set<string>>(new Set());
```

### 2. Aggiornare il loop di estrazione

Nel `runExtensionLoop`, dopo aver determinato se un partner ha contatti o no (riga 290), aggiornare le stats per ciascun network del partner:

```text
Per ogni partner processato:
  networks = canvas.networks (gia' caricati da partner_networks)
  hasContacts = canvas.contacts.some(c => c.email || c.phone || c.mobile)
  
  Per ogni network del partner:
    if hasContacts: networkStats[network].success++
    else: networkStats[network].empty++
```

### 3. Saltare partner di network esclusi

All'inizio di ogni iterazione del loop, prima di processare il partner, controllare se TUTTI i suoi network sono nella lista esclusi. Se si', saltarlo:

```text
// All'inizio del loop, dopo il check pausa:
if (excludedNetworks.size > 0) {
  // Carica i network del partner dal DB o dalla cache
  // Se TUTTI i network del partner sono esclusi -> skip
  // Se ha almeno UN network non escluso -> procedi
}
```

Per efficienza, pre-caricare i network di tutti i partner nella coda durante la scansione iniziale e salvarli nella `QueueItem`.

### 4. Aggiungere campo `networks` a QueueItem

**File**: `src/components/acquisition/PartnerQueue.tsx`

```typescript
export interface QueueItem {
  wca_id: number;
  company_name: string;
  country_code: string;
  city: string;
  status: QueueItemStatus;
  alreadyDownloaded?: boolean;
  networks?: string[];  // NUOVO: network di appartenenza
}
```

### 5. Popolare i network nella coda durante la scansione

In `handleScan` (riga 596), dopo aver caricato i membri dalla directory_cache, fare un batch query su `partner_networks` per i partner gia' nel DB e associare i network alla `QueueItem`. Per i partner nuovi, i network verranno caricati al momento dell'estrazione.

### 6. Banner Network Performance nella toolbar

Aggiungere un nuovo componente `NetworkPerformanceBar` che appare sopra la Live Stats bar quando ci sono dati:

```text
+---------------------------------------------------------------------+
| Network Performance:                                                |
| WCA Inter Global: 12/15 (80%) [verde]                              |
| Lognet: 0/8 (0%) [rosso] [Escludi]                                |
| WCA First: 5/6 (83%) [verde]                                       |
| CGLN: 1/10 (10%) [giallo] [Escludi]                               |
+---------------------------------------------------------------------+
```

- Verde: >50% successo
- Giallo: 10-50% successo  
- Rosso: <10% successo (con pulsante "Escludi")
- Il pulsante "Escludi" aggiunge il network a `excludedNetworks` e i partner rimanenti nella coda con SOLO quel network vengono automaticamente marcati come "skipped"

### 7. Indicatore network esclusi nei partner saltati

Nella `PartnerQueue`, i partner saltati per network escluso mostrano un badge grigio "Network escluso" invece del loader.

## File modificati

| File | Modifica |
|------|----------|
| `src/pages/AcquisizionePartner.tsx` | Stato networkStats + excludedNetworks, logica di skip nel loop, aggiornamento stats dopo ogni partner, banner performance |
| `src/components/acquisition/PartnerQueue.tsx` | Campo `networks` in QueueItem, badge "Network escluso" per partner saltati |
| `src/components/acquisition/AcquisitionToolbar.tsx` | Nessuna modifica (il banner va nella pagina principale) |

## Flusso risultante

```text
1. Scansione directory -> carica partner + loro network
2. Pipeline parte
3. Partner 1 (WCA Inter Global, Lognet) -> contatti trovati -> stats aggiornate
4. Partner 2 (Lognet solo) -> nessun contatto -> Lognet: 0/1
5. Partner 3 (Lognet solo) -> nessun contatto -> Lognet: 0/2
6. ...
7. Partner 8 (Lognet solo) -> nessun contatto -> Lognet: 0/5 -> BANNER ROSSO
8. Utente clicca "Escludi Lognet"
9. Partner 9-15 che hanno SOLO Lognet -> saltati automaticamente
10. Partner 16 (WCA First + Lognet) -> processato normalmente (ha WCA First che non e' escluso)
```

