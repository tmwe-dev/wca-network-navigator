## Ho capito. Confermo le 3 regole tassative

1. **Una sola operazione per volta** in tutto il sistema WA/LinkedIn (no parallelismi, no tentativi sovrapposti).
2. **Tempi di attesa rispettati sempre**: cooldown tra ogni azione (ping, cookie sync, apertura tab, click thread, scroll, lettura, chiusura) leggendo i valori dal settings panel — mai hard-coded scavalcabili.
3. **Comportamento umano**: entra → aspetta → legge → aspetta → chiude → aspetta. Mai aperture multiple né retry immediati.

---

## A) Mutex globale "Single-Op Guard"

Nuovo modulo `src/lib/syncMutex.ts`:

- Coda FIFO globale per canale (`whatsapp` e `linkedin` separati, ma un solo job attivo per canale).
- API: `acquire(channel, opName)` → restituisce un token; `release(token)`.
- Se un secondo job tenta `acquire` mentre uno è attivo → viene **rifiutato** con toast: "Un'operazione è già in corso, attendi il completamento."
- Tutte le entry-points si serializzano qui:
  - bottone "Sincronizza" (manuale)
  - auto-sync (cron client-side)
  - test panel (diagnostica)
  - send-message (invio outbound)

Niente verrà più eseguito "in background mentre clicchi qualcos'altro". Stop.

## B) Throttle centralizzato — letto dai settings

Nuovo modulo `src/lib/syncThrottle.ts` che legge da `localStorage`/DB i valori:

| Step | Default | Setting key |
|---|---|---|
| Ping estensione | 5s | `sync.cooldownPing` |
| Cookie sync | 5s | `sync.cooldownCookie` |
| Apertura tab/thread | 4-6s jitter | `sync.cooldownOpen` |
| Lettura DOM | 2-3s jitter | `sync.cooldownRead` |
| Scroll back | 2-4s jitter | `sync.cooldownScroll` |
| Pausa tra thread | 15-20s jitter | `sync.cooldownBetweenThreads` |
| Chiusura/idle | 3s | `sync.cooldownClose` |

Helper `await throttle('open')` obbligatorio prima di **ogni** azione bridge. Niente `await Promise.all(...)` su azioni bridge: vietato a livello di lint.

## C) Icona "Poliziotto" — Indicatore Controllo Attivo

Nuovo componente `src/v2/ui/atoms/SyncGuardIndicator.tsx`:

- Badge animato con icona **`ShieldCheck`** di lucide-react (interpretata come "poliziotto/controllo") + label "Controllo tempi attivo".
- 3 stati visibili:
  - **idle** (grigio, statico): "Controllo pronto"
  - **active** (blu pulsante): "Controllo attivo — N° step in corso"
  - **waiting** (ambra pulsante): "In attesa Xs (cooldown)"
- Mostra mini countdown del prossimo step.
- Tooltip al hover: "Il sistema sta seguendo i tempi umani: nessuna sovrapposizione, una azione per volta."

**Posizionamento (ovunque esista un bottone download/sync WA o LI):**

- `LinkedInToolbar.tsx` — accanto al bottone Sincronizza
- `WhatsAppToolbar.tsx` — accanto al bottone Sincronizza
- `InArrivoTab.tsx` — header WA
- `LinkedInInboxView.tsx` — header
- Test panel diagnostica (entrambi i canali)
- Auto-sync widget globale (se presente nella sidebar/header)

L'indicatore è **collegato al mutex + throttle**: appena uno scatta, l'icona si accende. Se l'utente prova a cliccare un secondo Sincronizza, lampeggia rosso 1s + toast: "Aspetta, controllo in corso."

## D) Doppia verifica del flusso Sincronizza

Tutto il flusso descritto nel piano precedente (entra in ogni thread → confronta DB → backfill → pausa) viene **avvolto** in:

```text
mutex.acquire(channel)
try:
  for each step:
    await throttle(stepKind)   # mai sovrapposizioni
    indicator.setState('active', step)
    await runStep()
    indicator.setState('waiting', nextCooldown)
finally:
  mutex.release()
  indicator.setState('idle')
```

Vietato:
- chiamate bridge senza `await throttle()`
- `Promise.all` su azioni bridge
- retry immediato senza cooldown
- aprire una nuova tab mentre una è ancora aperta dal flusso

## E) Verifica finale

- Audit script `scripts/check-sync-serialization.ts` che fa grep di `bridge.` / `extension.` calls e verifica che siano preceduti da `await throttle(` e dentro `mutex.acquire(`. CI fallisce se trova violazioni.

---

**Riassunto**: una sola operazione per volta, sempre, su entrambi i canali. Tempi letti dai settings, mai bypassabili. Icona poliziotto visibile dovunque, accesa quando il controllo è attivo, tooltip che spiega all'utente cosa sta succedendo.
