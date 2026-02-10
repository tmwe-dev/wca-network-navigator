

## Problema
Il bottone "Ottieni Cookie Automaticamente" resta disabilitato dentro l'editor Lovable perche' il proxy locale (`localhost:8001`) non e' raggiungibile dalla preview cloud. Il proxy funziona correttamente sul computer dell'utente.

## Soluzione
Aggiungere un **banner di avviso prominente** nella pagina Settings che appare quando il proxy non e' raggiungibile. Il banner:

1. Spiega in modo semplice che l'app va aperta in una **scheda separata del browser**
2. Include un **bottone "Apri in Nuova Scheda"** che apre automaticamente il link della preview pubblicata
3. Scompare automaticamente quando il proxy e' raggiungibile (cioe' quando l'utente sta gia' usando l'app dalla scheda separata)

## Modifiche

### 1. `src/components/settings/ProxySetupGuide.tsx`
- Aggiungere in cima alla guida un **Alert box giallo/arancione** visibile quando `isProxyOnline` e' `false`
- Il box contiene:
  - Testo: "Stai usando l'app dentro l'editor. Per far funzionare il proxy, apri questa pagina in una scheda separata del browser."
  - Bottone: "Apri in Nuova Scheda" che apre `window.open()` con l'URL della preview pubblicata + `/settings`
- L'alert scompare quando `isProxyOnline` diventa `true`

### 2. Nessuna modifica al backend
Non servono modifiche al database o alle edge functions.

## Dettagli tecnici
- L'URL della preview pubblicata verra' costruito usando `window.location.origin` per funzionare sia in ambiente Lovable che standalone
- Il componente Alert di shadcn/ui verra' usato per coerenza visiva
- Il bottone usera' `window.open(url, '_blank')` per aprire una nuova scheda

