

## Piano: File standalone con logica di Zoom del Globo

### Cosa contiene

Un singolo file TypeScript (`globe-zoom-controller.ts`) che racchiude tutta la logica di zoom e rotazione cinematografica usata nel globo 3D, pronto per essere copiato in qualsiasi progetto React Three Fiber.

### Logica inclusa

Il file esporta un hook `useGlobeZoom` che gestisce:

- **Zoom-in verso un punto** (lat/lng) con easing cubico
- **Zoom-out** con animazione di ritorno fluida (1.5 secondi)
- **Auto-rotazione** quando il globo e' in idle
- **Interruzione** quando l'utente interagisce manualmente (drag/scroll)
- **Reset cinematografico** dalla posizione corrente allo stato iniziale

### Parametri configurabili

| Parametro | Default | Descrizione |
|-----------|---------|-------------|
| defaultZoom | 2.8 | Distanza camera di default |
| zoomedIn | 1.6 | Distanza camera quando si zooma su un punto |
| rotationSpeed | 0.08 | Velocita' auto-rotazione (rad/s) |
| lerpFactor | 0.03 | Fattore di interpolazione rotazione |
| zoomLerpFactor | 0.04 | Fattore di interpolazione zoom |
| resetDuration | 1.5 | Durata animazione reset (secondi) |

### File da creare

**`public/globe-zoom-controller.ts`** - Il file scaricabile contenente:
- `useGlobeZoom()` hook principale
- Funzioni di easing (`easeInOutCubic`, `easeOutQuart`, `easeInOutSine`)
- Funzione helper `latLngToRotation()` per convertire coordinate in angoli di rotazione
- Tipi TypeScript per le opzioni di configurazione

### Come si usa nell'altro progetto

```typescript
import { useGlobeZoom } from './globe-zoom-controller';

function MyEarth() {
  const { zoomTo, resetZoom, applyFrame } = useGlobeZoom({
    defaultZoom: 2.8,
    zoomedIn: 1.6,
  });

  // Zoom verso Roma
  zoomTo({ lat: 41.9, lng: 12.5 });

  // Nel render loop
  useFrame((state, delta) => {
    applyFrame(earthRef, camera, state.clock.elapsedTime, delta);
  });
}
```

### Dipendenze richieste nel progetto di destinazione

- `three` (>=0.133)
- `@react-three/fiber` (^8.18)

Nessun'altra dipendenza necessaria. Il file e' completamente autonomo.

### Dettagli tecnici

**File nuovo:**
- `public/globe-zoom-controller.ts` - Hook standalone con tutta la logica di zoom

**Nessun file modificato** - Questo e' un export indipendente, non tocca il codice esistente.

Il file verra' reso disponibile come download diretto dalla cartella `public/`.
