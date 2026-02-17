
# Modalita "Directory + Download" automatica

## Cosa cambia

Aggiungere una nuova modalita nell'ActionPanel: **"Directory + Download"**. Quando attivata, il sistema:

1. Scarica la directory fresca del paese selezionato (come fa gia la modalita "Solo Directory")
2. Confronta gli ID trovati con quelli gia nel database (con profilo completo)
3. Crea automaticamente un job di download SOLO per gli ID mancanti/incompleti
4. Il tutto con un singolo click

## Comportamento attuale vs nuovo

```text
OGGI (2 click manuali):
  Click 1: "Solo Directory ON" --> scansiona directory --> STOP
  Click 2: "Solo Directory OFF" --> seleziona modalita --> avvia download

NUOVO (1 click):
  Click: "Directory + Download" --> scansiona directory --> confronta DB --> avvia download automatico
```

## Dettaglio tecnico

### File: `src/components/download/ActionPanel.tsx`

1. Aggiungere un terzo stato al toggle "Solo Directory":
   - OFF = download normale (usa cache esistente)
   - Solo Directory = solo scansione (come oggi)
   - **Directory + Download** = scansione fresca + download automatico dei mancanti

2. Implementazione: quando l'utente clicca "Avvia" in modalita "Directory + Download":
   - Esegue `handleStartScan()` normalmente (scarica tutte le pagine della directory)
   - Al completamento della scansione, invece di fermarsi, calcola automaticamente gli `idsToDownload` dai risultati freschi
   - Verifica la sessione WCA
   - Crea i job di download solo con gli ID effettivamente mancanti

3. Questo viene implementato aggiungendo un flag `autoDownloadAfterScan` che, quando la scansione termina (`scanComplete = true`), triggera automaticamente `executeDownload()` con i nuovi dati.

### Flusso nel codice

- Nuovo state: `const [dirThenDownload, setDirThenDownload] = useState(false)`
- Il toggle attuale "Solo Directory" diventa un selettore a 3 opzioni (o un secondo toggle "Auto-download dopo directory")
- Quando `dirThenDownload` e attivo e la scansione si completa, un `useEffect` chiama `handleStartDownload()` automaticamente
- Il confronto con il DB avviene come gia fa il codice attuale (usa `dbWcaSet` e `noProfileWcaSet` per filtrare)

### UI

Il toggle "Solo Directory" resta, e sotto appare un nuovo toggle:
- **"Scarica dopo scansione"** — visibile solo quando "Solo Directory" e ON
- Quando attivo, il pulsante cambia testo da "Avvia scansione" a "Scansiona e scarica"
- Dopo la scansione, mostra un breve riepilogo ("Trovati 1092, da scaricare: 255") e poi parte automaticamente

### Migrazione SQL: pulizia duplicati US

Eseguire una query per unificare i `country_name` duplicati:
```text
UPDATE partners 
SET country_name = 'United States of America' 
WHERE country_code = 'US' AND country_name = 'US';
```

### Nessuna modifica al processore

Il processore (`useDownloadProcessor.ts`) non cambia. Il fix agisce a monte nell'ActionPanel, assicurando che i job partano con dati freschi e filtrati.
