

# Piano: Checkpoint unico come UNICA fonte di timing

## Problema identificato

Ci sono **DUE sistemi di timing in conflitto**:

1. **Il vecchio `abortableDelay`** (righe 514-521) — calcola un delay adattivo dopo ogni estrazione e aspetta
2. **Il nuovo checkpoint `waitForGreenLight`** (righe 272-276) — aspetta la zona verde prima dell'estrazione successiva

Il flusso attuale:
```text
Estrazione -> markRequestSent() -> vecchio delay (9-15s) -> ... prossima iterazione -> checkpoint (vede 10s+ trascorsi -> VERDE IMMEDIATO) -> Estrazione
```

Il checkpoint non serve a niente perche `markRequestSent()` viene chiamato PRIMA del vecchio delay. Quando il loop arriva al checkpoint, sono gia passati 10-15 secondi e il gate dice sempre "verde".

## Soluzione

Eliminare il vecchio sistema di delay adattivo e lasciare il checkpoint come **UNICA** fonte di timing. Il flusso diventa:

```text
Estrazione -> markRequestSent() -> log risultato -> torna in cima al loop -> checkpoint (aspetta fino a zona verde) -> Estrazione
```

## Modifiche tecniche

### 1. `src/hooks/useDownloadProcessor.ts`

- **Rimuovere** il blocco di delay adattivo alle righe 514-521 (il `abortableDelay` dopo ogni estrazione)
- **Rimuovere** anche il delay adattivo identico nelle righe 303-309 (caso "skipped")
- Il checkpoint `waitForGreenLight` alle righe 272-276 diventa l'UNICO gate temporale
- Spostare `markRequestSent()` DOPO l'estrazione (gia fatto, riga 289) — questo resta invariato
- Il log WAIT vecchio viene sostituito dai log GATE del checkpoint

### 2. `src/lib/wcaCheckpoint.ts`

- Aggiungere un log "AUTORIZZATO" quando il gate passa immediatamente (zona gia verde)
- Il threshold resta 15 secondi (sincronizzato col cruscotto SpeedGauge)

### 3. `src/components/download/SpeedGauge.tsx`

- Collegare il cruscotto al checkpoint importando `getLastRequestTimestamp` da `wcaCheckpoint.ts`
- In questo modo cruscotto e checkpoint leggono lo STESSO timestamp — sincronizzazione garantita

## Risultato

- Un solo sistema di timing, non due in conflitto
- Il cruscotto e il checkpoint leggono lo stesso dato
- Se il cruscotto non e verde, la chiamata NON parte — garantito
- I log nel terminale mostreranno chiaramente il gate in azione

