

# Selezione Partner + Acquisizione Completa (Tutti)

## Problemi Identificati

1. **Nessuna selezione individuale**: I partner nella coda non hanno checkbox, quindi non si puo' scegliere quali processare
2. **Nessun "Acquisisci Tutti"**: Il bottone "Avvia Acquisizione" processa solo i partner **nuovi** (filtra via quelli gia' scaricati a riga 170), quindi non c'e' modo di ri-verificare/aggiornare quelli esistenti

## Modifiche Pianificate

### 1. Checkbox di selezione nella coda (`PartnerQueue.tsx`)

Aggiungere una checkbox accanto a ogni partner nella lista. Di default:
- Partner **nuovi**: selezionati
- Partner **gia' scaricati**: deselezionati (ma selezionabili)

Header della coda con "Seleziona tutti" / "Deseleziona tutti" e un contatore dei selezionati.

### 2. Modalita' "Acquisisci Tutti" (`AcquisizionePartner.tsx`)

Nella riga dei bottoni, aggiungere due azioni:
- **Avvia Acquisizione (Solo Nuovi)**: come oggi, processa solo i non-scaricati selezionati
- **Ri-Verifica Tutti**: processa TUTTI i partner selezionati (inclusi quelli gia' presenti), utile per aggiornare email/telefoni mancanti o arricchire dati

La pipeline a riga 170 usera' la lista dei partner selezionati (tramite un Set di `wca_id`) invece del filtro fisso `!q.alreadyDownloaded`.

### 3. Stato selezione

Nuovo state `selectedIds: Set<number>` nella pagina principale. Viene passato a `PartnerQueue` come prop insieme a un callback `onToggle(wcaId)`.

## Dettaglio Tecnico

| File | Modifiche |
|------|-----------|
| `src/components/acquisition/PartnerQueue.tsx` | Aggiungere checkbox per ogni item, header con "Seleziona tutti", props `selectedIds` e `onToggle` |
| `src/pages/AcquisizionePartner.tsx` | Nuovo state `selectedIds`, logica toggle, bottone "Ri-Verifica Tutti", pipeline usa `selectedIds` invece del filtro hardcoded |

### Flusso Utente

1. Scansiona directory -- appare la lista
2. I nuovi sono pre-selezionati, gli esistenti no
3. L'utente puo' cliccare "Seleziona Tutti" per incluere anche gli esistenti
4. Oppure selezionare/deselezionare singoli partner
5. "Avvia Acquisizione" processa solo i selezionati
6. Il conteggio nel bottone riflette la selezione attuale
