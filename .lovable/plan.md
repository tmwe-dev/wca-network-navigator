
## Rifattorizzazione Operations Center - Fix Critici e Miglioramenti

### Problemi identificati

**1. Job Afghanistan bloccato su "pending"**
Il job di download (3 indirizzi) e' rimasto in stato "pending" perche' il sistema di download si basa interamente sul frontend + Chrome Extension per processare i profili. Il job viene creato nel database con status "pending", ma nessun componente nell'Operations Center lo prende in carico per avviare il processing. Nella vecchia maschera DownloadManagement, il JobMonitor era sempre visibile e il loop di processing veniva gestito dalla pagina. Nella nuova Operations, il JobMonitor e' nascosto dentro la tab "Scarica" e non viene mostrato quando l'utente e' sulla tab "Partner".

**2. Visibilita' persa sui job attivi**
Il JobMonitor appare solo in due posizioni:
- Nella vista "nessun paese selezionato" (overview globale)
- Dentro la tab "Scarica" quando un paese e' selezionato

Se l'utente seleziona un paese e resta sulla tab "Partner", non vede nulla dei job in corso. Serve un indicatore di job attivi sempre visibile, indipendentemente dalla tab selezionata.

**3. Pulsanti con sfondo bianco e rosso brutti**
I pulsanti Stop/Annulla usano il tema `btnStop` che in light mode produce `border-red-400 text-red-600 hover:bg-red-50` su sfondo bianco. Sono visivamente sgradevoli e poco integrati con il design glassmorphism. Tutti i pulsanti di azione del JobMonitor e dell'ActionPanel devono essere rivisitati per coerenza con l'estetica command-center.

**4. Pagina che salta alla pagina WCA durante lo scroll**
Il problema e' causato dall'iframe nella tab "Acquisisci" (linea 224 di Operations.tsx) che carica `/acquisizione`. Quando l'utente scrolla e l'iframe cattura il focus/eventi, la navigazione del router puo' interferire. Inoltre, se il contenuto overflow dell'Operations non e' gestito correttamente, lo scroll puo' uscire dai confini del pannello.

---

### Piano di implementazione

**Fase 1: Job Monitor sempre visibile**
- Aggiungere un mini-indicatore di job attivi sotto l'header delle tab (sopra il contenuto), visibile su tutte le tab
- Mostra una barra compatta con: numero job attivi, ultimo profilo processato, progress bar, pulsanti Pausa/Stop
- Cliccabile per espandere i dettagli completi del JobMonitor

**Fase 2: Rimuovere l'iframe di Acquisizione**
- Eliminare l'iframe che carica `/acquisizione` dalla tab "Acquisisci"
- Sostituirlo con un messaggio informativo che rimanda alla pagina dedicata, oppure integrare i componenti inline
- Questo risolve il problema dello scroll che salta alla pagina WCA

**Fase 3: Fix scroll e contenimento**
- Aggiungere `overflow-hidden` e `overscroll-behavior: contain` sul container principale
- Assicurarsi che ogni tab abbia `overflow-auto` solo sul proprio contenuto interno
- Prevenire la propagazione dello scroll fuori dal pannello

**Fase 4: Rivisitazione grafica pulsanti**
- Ridefinire `btnStop` per usare colori piu' morbidi e integrati (rosso/rosa con trasparenza, non bordi netti su bianco)
- Uniformare tutti i pulsanti di azione (Pausa, Stop, Riprendi, Dati, Settings) con lo stile glassmorphism
- In light mode: sfumature delicate con backdrop-blur invece di bordi netti su bianco

---

### Dettagli Tecnici

**File modificati:**

1. `src/pages/Operations.tsx`
   - Aggiungere componente `ActiveJobBar` compatto sopra il contenuto delle tab, sempre visibile quando ci sono job attivi
   - Rimuovere l'iframe da AcquisitionEmbed, sostituire con link/componenti inline
   - Aggiungere `overscroll-contain` al container principale

2. `src/components/download/JobMonitor.tsx`
   - Creare variante compatta `JobMonitorCompact` per la barra sempre visibile
   - Aggiornare le classi dei pulsanti per coerenza con il tema glassmorphism

3. `src/components/download/theme.ts`
   - Aggiornare `btnStop` per light mode: sfumature piu' morbide (es. `bg-rose-50/80 border-rose-200/60 text-rose-600`)
   - Aggiornare `btnPause`, `btnTest` per coerenza
   - Aggiungere nuovi token per pulsanti glassmorphism

4. `src/components/download/ActionPanel.tsx`
   - Verificare che i pulsanti usino i nuovi token tema
