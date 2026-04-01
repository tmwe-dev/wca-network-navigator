

# Aggiornamento Card in Tempo Reale nel Cockpit

## Problema

Quando trascini un contatto su LinkedIn, il sistema scrapa il profilo e mostra i dati estratti solo nell'**AIDraftStudio** (pannello destro). La **card del contatto nella lista** (pannello sinistro) rimane statica con i dati originali — non mostra mai il profilo LinkedIn trovato, l'headline, la bandiera aggiornata, etc. L'utente non vede il valore dell'arricchimento sulla card stessa.

## Soluzione

### 1. Aggiornare la CockpitContactCard con stato "attivo/arricchito"

**File: `src/components/cockpit/CockpitContactCard.tsx`**

- Aggiungere prop `enrichmentState` opzionale con i dati live:
  - `linkedinProfile` (name, headline, location, connectionStatus)
  - `scrapingPhase` (idle, visiting, extracting, enriching, reviewing, generating)
  - `isActive` (se è il contatto attualmente in lavorazione)
- Quando `isActive`:
  - Bordo animato (pulse) per indicare elaborazione in corso
  - Mostra fase corrente sotto il nome (es. "🔍 Estrazione profilo...")
- Quando `scrapingPhase === "reviewing"` o messaggio generato:
  - Mostra headline LinkedIn sotto il ruolo
  - Badge "✓ LinkedIn" se profilo trovato
  - Badge connectionStatus (Connesso/Non connesso)
  - Disabilita drag (card già in uso)

### 2. Passare draftState alla card attiva

**File: `src/pages/Cockpit.tsx`**

- Nel rendering di `ContactStream` / lista card, confrontare `contact.id === draftState.contactId`
- Se match, passare `enrichmentState={{ scrapingPhase: draftState.scrapingPhase, linkedinProfile: draftState.linkedinProfile, isActive: true }}`

### 3. Indicatore visivo per il tasto di invio

**File: `src/components/cockpit/AIDraftStudio.tsx`**

- Il tasto "Invia" / "Connetti su LinkedIn" resta disabilitato finché:
  - `scrapingPhase !== "idle"` (ancora in elaborazione)
  - `body` è vuoto (messaggio non generato)
- Aggiungere stato visivo "pronto" con check verde quando tutti i dati sono disponibili e il messaggio è generato

### Flusso Risultante

```text
1. Drag card su LinkedIn
2. Card nella lista: bordo animato + "🔍 Visita profilo..."
3. Card aggiorna: "📋 Estrazione dati..." → mostra headline
4. Card mostra: badge LinkedIn ✓ + connectionStatus
5. AIDraftStudio: review panel con dati + tasto "Genera"
6. Dopo generazione: tasto Invia si attiva
```

### Dettagli Tecnici

- Nessuna nuova query DB — usa solo `draftState` già disponibile in memoria
- Le modifiche toccano 3 file: `CockpitContactCard.tsx`, `Cockpit.tsx`, `AIDraftStudio.tsx`
- Il tasto invio in AIDraftStudio è già parzialmente gated (controlla `draft.body`), va solo reso esplicito con stati visivi

