## Causa del rallentamento iniziale

Nel sync WhatsApp (e LinkedIn), prima ancora di chiamare l'estensione, il codice fa una pausa cooldown obbligatoria di **5 secondi fissi** (step `ping` in `syncGuard`):

```ts
// useWhatsAppAdaptiveSync.ts riga 193
await throttle("whatsapp", "ping", "Ping estensione");
const sidebarRes = await listSidebarChats();
```

`syncGuard.DEFAULTS.ping = { min: 5000, max: 5000 }` → 5s morti all'inizio di ogni download, prima che parta qualunque azione visibile. Stessa cosa per LinkedIn (riga 101 di `useLinkedInSync.ts` e 72 di `useLinkedInBackfill.ts`).

È esattamente il "molto rallentato all'inizio" che hai notato: prima questo cooldown non c'era / non bloccava lo start, ora sì.

Il resto della sequenza (open chat, read, pausa tra chat) è invariato e va lasciato così — è quello che protegge da ban WA/LI.

## Fix proposto (minimo, locale, reversibile)

Solo 2 modifiche, niente refactor, niente tocchi a invio/dedup/DB/auth:

1. **`src/lib/syncGuard.ts`** — abbassare il default del solo step `ping` da `5000` a `300` ms (jitter min/max uguali). Resta uno step tracciato (l'indicatore "poliziotto" continua a vederlo), ma non blocca più l'avvio.
   - Nessuna modifica agli altri step (open, read, betweenThreads, scroll, close): le protezioni anti-ban restano identiche.
   - L'utente può comunque alzarlo via `localStorage.sync_guard_settings_v1` (la regola "mai sotto i default" continua a valere col nuovo default più basso).

2. **Nessuna modifica all'estensione Chrome** (no nuovo ZIP, no reinstallazione richiesta). Il fix è 100% lato app.

## Cosa NON tocco

- `useWhatsAppAdaptiveSync` (logica sync, cursor, dedup, salvataggio)
- `useLinkedInSync` / `useLinkedInBackfill`
- estensione WhatsApp v5.10.10 e LinkedIn v3.9.10 (restano installate, nessun re-deploy)
- `tab-manager.js`, `actions.js`, `background.js` dell'estensione
- throttle `betweenThreads` (15-20s tra chat) — fondamentale anti-ban, lasciato com'è
- throttle `open`/`read` per ogni chat — invariati

## Verifica dopo il fix

- Il primo download parte entro ~300ms invece che 5s.
- I tempi tra una chat e l'altra restano gli stessi di adesso.
- Il pannello "syncGuard" continua a mostrare lo step "Ping estensione" (solo molto più breve).
- Nessun cambio di comportamento su invio messaggi, lettura, dedup.