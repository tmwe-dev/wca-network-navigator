

# Verifica Timing e Stato WhatsApp/LinkedIn

## Stato Attuale

### Timing nella Coda di Produzione (`useOutreachQueue.ts`) — OK
I delay tra invii esistono già e sono corretti:
- **WhatsApp**: 5 secondi tra un messaggio e l'altro
- **LinkedIn**: 10 secondi tra un messaggio e l'altro
- **Email**: 2 secondi
- La coda processa max 5 item per ciclo, con pausa tra ognuno

### Maschera Test (`TestExtensions.tsx`) — PROBLEMA
La maschera test **non ha alcun delay tra le azioni**. Ogni pulsante è manuale, ma nulla impedisce di cliccare rapidamente in sequenza (Ping → Sessione → SyncCookie → AutoLogin → Search → Inbox). Questo genera 6+ interazioni con LinkedIn in pochi secondi — esattamente il comportamento rischioso.

### WhatsApp — FUNZIONA
Dai log: sessione autenticata, 67 chat visibili, invio messaggi operativo.

### LinkedIn — FUNZIONA PARZIALMENTE
- Ping, sessione, syncCookie, autoLogin, searchProfile: **tutti OK**
- Inbox (`readLinkedInInbox`): **restituisce 0 thread** — i selettori DOM dell'estensione non trovano le conversazioni (problema nell'estensione, non nel codice webapp)

## Fix Proposti

### 1. Aggiungere delay obbligatorio nella maschera Test
Dopo ogni azione LinkedIn nella maschera test, disabilitare i pulsanti per **5 secondi** con countdown visibile. Impedisce clic rapidi in sequenza.

```
// Concetto: dopo ogni azione LinkedIn
setRunning(true);
// ... esegui azione ...
log("⏳ Cooldown 5s...", "info");
await new Promise(r => setTimeout(r, 5000));
setRunning(false);
```

### 2. Aggiungere contatore azioni LinkedIn nell'ora
Mostrare nella maschera test un badge: "Azioni LI nell'ultima ora: N". Serve come indicatore visuale di rischio.

### File coinvolti

| File | Modifica |
|------|----------|
| `src/pages/TestExtensions.tsx` | Cooldown 5s dopo ogni azione LinkedIn, badge contatore |

## Risultato
- La maschera test non può più generare burst di richieste LinkedIn
- Il codice di produzione (outreach queue) già rispetta i delay
- WhatsApp funziona
- LinkedIn funziona (tranne inbox che è un problema di selettori nell'estensione)

