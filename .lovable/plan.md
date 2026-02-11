
# Semaforo Contatti, Conteggio Qualita' e Deep Search Parallelo

## Modifiche Pianificate

### 1. Semaforo verde/rosso per qualita' contatti nel Canvas

Nella sezione Contatti del `PartnerCanvas`, accanto a ogni contatto aggiungere un indicatore visivo:
- **Cerchio verde** se il contatto ha almeno email E (telefono diretto O mobile)
- **Cerchio arancione** se ha solo email OPPURE solo telefono
- **Cerchio rosso** se manca sia email che telefono

In cima alla sezione Contatti, un badge riassuntivo: "3/5 completi" con colore verde se tutti completi, arancione se parziale.

### 2. Conteggio qualita' nel Cestino Acquisiti

Nel componente `AcquisitionBin`, mostrare sotto il contatore principale:
- **Completi**: N partner con almeno 1 contatto con email + telefono (badge verde)
- **Incompleti**: N partner senza contatti completi (badge arancione/rosso)

Nuove props: `completeCount` e `incompleteCount`, calcolati nella pagina principale al completamento di ogni partner in base ai dati del canvas.

### 3. Deep Search attivo di default

Cambiare il valore iniziale di `includeDeepSearch` da `false` a `true` (riga 30 di `AcquisizionePartner.tsx`).

### 4. Enrichment e Deep Search in parallelo dopo il download

Attualmente la pipeline e' sequenziale: Download -> Enrich -> Deep Search. Modificare per lanciare Enrich e Deep Search in parallelo con `Promise.all` subito dopo il download:

```text
PRIMA (sequenziale):
  Download (15s) -> Enrich (10s) -> Deep Search (8s) = 33s totali

DOPO (parallelo):
  Download (15s) -> [Enrich + Deep Search in parallelo] (max 10s) = 25s totali
```

La fase nel canvas mostrera' "Arricchimento + Deep Search" durante l'esecuzione parallela, e i risultati aggiornano il canvas man mano che arrivano (chi finisce prima aggiorna subito).

## Dettaglio Tecnico

| File | Modifiche |
|------|-----------|
| `src/components/acquisition/PartnerCanvas.tsx` | Semaforo verde/arancione/rosso accanto ai contatti, badge riassuntivo qualita' |
| `src/components/acquisition/AcquisitionBin.tsx` | Props `completeCount` e `incompleteCount`, mostrare sotto il contatore |
| `src/pages/AcquisizionePartner.tsx` | `includeDeepSearch` default `true`, pipeline parallela con `Promise.all`, tracciamento qualita' contatti per il bin |

### Logica qualita' contatto

Un contatto e' "completo" se ha:
- `email` non vuoto E
- (`direct_phone` non vuoto OPPURE `mobile` non vuoto)

Un partner e' "completo" se ha almeno 1 contatto completo.

### Pipeline parallela (pseudocodice)

```text
// Dopo il download:
const promises = [];
if (includeEnrich && website) {
  promises.push(enrich().then(updateCanvas));
}
if (includeDeepSearch) {
  promises.push(deepSearch().then(updateCanvas));
}
setCanvasPhase("enriching"); // fase unica per entrambi
await Promise.all(promises);
setCanvasPhase("complete");
```
