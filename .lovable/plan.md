

# Piano: Fix Lettura Inbox LinkedIn (0 threads)

## Problema
L'estensione LinkedIn è connessa e autenticata, ma `readInbox` restituisce 0 thread. Il log diagnostico mostra:
- AX Tree: 0 thread (fallback)
- Structural fallback: 0 thread
- La pagina è su `/messaging/thread/...` (una conversazione specifica), non su `/messaging/` (lista conversazioni)

Il problema ha due cause probabili:
1. **LinkedIn ha cambiato il DOM**: i selettori CSS (`a[href*='/messaging/thread/']`, `h3`, `[class*='msg-conversation-listitem']`) non matchano più la struttura attuale
2. **Il body è solo 8966 chars**: la pagina potrebbe non essere completamente caricata (5s di attesa potrebbe non bastare) o LinkedIn usa rendering lazy/virtualized che non mostra tutti gli elementi nel DOM

## Soluzione

### 1. Aggiornare `actions.js` — readInbox con selettori aggiornati e wait più intelligente

- **Aumentare il wait da 5s a 8s** con un check di readiness (aspettare che almeno un elemento della lista conversazioni sia presente nel DOM)
- **Aggiungere Strategy 0**: prima di tutto, provare `document.querySelectorAll('[class*="msg-conversation-card"], [class*="msg-convo-wrapper"], [data-control-name*="conversation"]')` — selettori più moderni usati da LinkedIn nel 2025-2026
- **Aggiungere Strategy 4**: se tutto fallisce, fare un parsing generico di tutti i `<a>` che contengono nomi + `href` con `/messaging/` 
- **Forzare navigazione a `/messaging/`**: il `getLinkedInTab` deve navigare alla lista, non restare su un thread specifico

### 2. Aggiornare `actions.js` — migliorare `getLinkedInTab` per forzare navigazione

Attualmente `getLinkedInTab("https://www.linkedin.com/messaging/", false)` con `false` (non forzare navigazione) potrebbe restare sul thread corrente. Cambiare a `true` oppure verificare che l'URL sia esattamente `/messaging/` e non `/messaging/thread/...`.

### 3. Aggiungere diagnostica strutturale nel fallback

Se tutti i metodi falliscono, restituire informazioni utili nel campo `diagnostics`:
- Conteggio di `<a>`, `<li>`, `<h3>`, `<img>` trovati
- URL corrente della pagina
- Lunghezza `document.body.innerHTML`
- Primi 500 chars del body text

### 4. Aggiornare `ax-tree.js` — readInbox con filtri meno restrittivi

Il filtro AX Tree cerca solo link con `role="link"` e poi verifica `/messaging/thread/`. Aggiungere anche ricerca per `role="listitem"` nella lista conversazioni.

## File coinvolti

| File | Modifica |
|------|----------|
| `public/linkedin-extension/actions.js` | readInbox: forzare nav a `/messaging/`, wait intelligente, nuovi selettori Strategy 0, diagnostica migliorata |
| `public/linkedin-extension/ax-tree.js` | readInbox: aggiungere ricerca per listitem, filtri meno restrittivi |
| `public/linkedin-extension/tab-manager.js` | Verificare che `getLinkedInTab` navighi effettivamente alla URL richiesta se la tab è su un path diverso |

## Risultato
- L'estensione naviga sempre alla lista conversazioni (`/messaging/`) prima di leggere
- Selettori aggiornati per il layout LinkedIn attuale
- Diagnostica dettagliata se comunque fallisce, per debug rapido

