
# Semplificazione Download Management

## Problemi attuali
- Troppi bottoni confusi nella Fase 1 ("Salva solo lista ID", "Riscansiona", "Aggiorna tutti") senza spiegare cosa fanno
- La verifica della sessione WCA e' separata in un'altra pagina -- l'utente deve ricordarsi di andarci
- Il flusso a 4 step (Paesi -> Network -> Fase 1: Lista -> Fase 2: Dettagli) e' macchinoso, con terminologia tecnica ("Fase 1", "Fase 2", "directory_cache")
- 4 azioni nella home ("Scarica Partner", "Aggiorna Contatti", "Arricchisci dal Sito", "Analisi Network") sono troppe per un utente non tecnico

## Cosa cambia

### 1. Verifica sessione WCA integrata nel flusso download
Prima di avviare qualsiasi download, il sistema verifica automaticamente la sessione WCA. Se scaduta, mostra un banner con il link al bookmarklet e blocca l'avvio. L'utente non deve piu' andare nella pagina WCA separatamente.

### 2. Flusso semplificato a 3 step con nomi chiari
Il wizard passa da 4 a 3 step con nomi comprensibili:
- **Step 1: "Scegli Paesi"** (invariato, funziona bene)
- **Step 2: "Scegli Network"** (invariato)
- **Step 3: "Avvia Download"** -- unifica Fase 1 (lista) e Fase 2 (dettagli) in un unico step automatico

Al posto di mostrare la lista ID e chiedere cosa fare, il sistema:
1. Controlla se esiste gia' una scansione in cache
2. Se si': mostra quanti partner mancano e propone "Scarica X mancanti" oppure "Aggiorna tutti"
3. Se no: avvia la scansione automaticamente, e al termine propone il download
4. Un unico bottone principale: **"Avvia Download"**

### 3. Bottoni ridotti e rinominati
- "Salva solo lista ID" viene rimosso (il salvataggio in cache avviene sempre automaticamente)
- "Riscansiona" diventa "Aggiorna lista dalla directory" e viene messo in un menu secondario
- "Aggiorna tutti" diventa piu' chiaro: "Ri-scarica profili esistenti (aggiorna dati)"

### 4. Home page semplificata
Le 4 card diventano 2 azioni principali + 1 secondaria:
- **Scarica Partner** (azione primaria) -- il flusso principale
- **Aggiorna Contatti** (azione secondaria) -- per chi ha gia' partner senza email
- "Arricchisci dal Sito" e "Analisi Network" vanno in un menu "Strumenti avanzati" collassabile

### 5. Indicatore sessione WCA nella barra superiore
Un piccolo semaforo (pallino verde/rosso) visibile sempre nella barra del Download Management, con tooltip che spiega lo stato e un click che apre le istruzioni per il bookmarklet.

## Dettagli tecnici

### File modificati
- `src/pages/DownloadManagement.tsx` -- riscrittura principale (~2165 righe attuali, obiettivo ~1500)

### Componenti da modificare

**StepChoose**: ridurre da 4 a 2 card principali + sezione collassabile "Strumenti". Aggiungere indicatore sessione WCA in alto.

**DownloadWizard**: ridurre da 4 sub-step a 3. Unificare `DirectoryScanner` e `Phase2Config`:
- Se cache esiste e non e' vecchia: mostrare direttamente il riepilogo con bottone "Avvia Download"
- Se cache non esiste: avviare la scansione automaticamente, poi mostrare il riepilogo
- Rimuovere il bottone "Salva solo lista ID"
- Rinominare "Ri-scansiona" in "Aggiorna lista" e metterlo come azione secondaria

**Barra superiore**: aggiungere il pallino sessione WCA importando `useWcaSessionStatus` con un `Popover` per le istruzioni del bookmarklet.

### Verifica sessione automatica
Prima di creare un `download_job`, il sistema chiama `check-wca-session` e se lo stato non e' "ok", mostra un dialog bloccante con:
- Stato attuale della sessione
- Link al bookmarklet (stesso della pagina WCA)
- Bottone "Riprova" che ri-verifica

### Nessuna modifica backend
Le edge functions e le tabelle restano invariate.
