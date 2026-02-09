
# Fix: Selezione multipla dei Network nel Download Wizard

## Problema
Nella schermata "Quale network?" del Download Wizard, cliccando su un singolo network (es. "China Global") il sistema avanza immediatamente alla fase successiva, impedendo di selezionare piu network contemporaneamente. Solo "Tutti i Network" funziona per coprire piu gruppi.

## Soluzione
Trasformare `PickNetwork` da selezione singola (click = avanza) a selezione multipla con checkbox, come gia fatto per la selezione paesi.

## Modifiche

### 1. Componente `PickNetwork` (DownloadManagement.tsx, righe 610-642)
- Cambiare la prop `onSelect: (n: string) => void` in `onConfirm: (networks: string[]) => void`
- Aggiungere uno stato interno `selected: Set<string>` per i network selezionati
- Ogni network diventa un toggle (con checkbox visiva) invece di un click diretto
- Aggiungere un pulsante "Continua" in basso (come per i paesi)
- Mantenere "Tutti i Network" come opzione che seleziona/deseleziona tutto

### 2. Stato nel `DownloadWizard` (righe 272-365)
- Cambiare `network` da `string` a `string[]` (array di network selezionati)
- Aggiornare il passaggio a `DirectoryScanner` e `Phase2Config` per gestire array di network
- Se l'array e vuoto o contiene tutti, comportamento invariato (cerca tutto)

### 3. Componenti a valle (`DirectoryScanner`, `Phase2Config`)
- Aggiornare la prop `network` da `string` a `string[]`
- Nella query al `directory_cache`, usare `.in("network_name", networks)` invece di `.eq("network_name", network)`
- Nel job di download, passare i network come stringa concatenata (come gia fatto nel resync)

## Risultato
L'utente potra selezionare "China Global" + "Dangerous Goods" (o qualsiasi combinazione) e poi cliccare "Continua" per procedere alla scansione directory con tutti i network selezionati.
