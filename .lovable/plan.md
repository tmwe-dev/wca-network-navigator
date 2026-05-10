
## Obiettivo

Rendere LinkedIn **e WhatsApp** istantanei (read + send) tenendo SEMPRE pronta una tab dedicata di servizio (`linkedin.com/messaging/` e `web.whatsapp.com/`), e — su LinkedIn — aprire automaticamente un nuovo thread quando il contatto non ne ha ancora uno.

Niente più cold-tab da 40-60s, niente più "Timeout 35s", niente più dipendenza dalla pagina che l'utente sta guardando.

---

## I problemi tecnici di oggi

### LinkedIn
1. **Nessuna tab persistente di lavoro.** `getLinkedInTabForRead` cerca match esatto del path. Se l'utente è su `/in/...`, nessun match → `chrome.tabs.create` cold. SPA load 8-20s + Optimus AI cold 3-8s + relearn 5-10s = 25-50s. Il client tagliava a 35s → "Nessun thread trovato".
2. **`getLinkedInTab` (send)** rischia di adottare la tab utente e navigarla via, oppure trovarla su un profilo invece che `/messaging/` → stesso cold path.
3. **Nessuna logica "apri thread da profilo"**. Se il contatto non ha mai scambiato messaggi, non esiste un thread `/messaging/thread/<id>/`. Oggi il sender prova a digitare nel box di una thread-list senza creare la nuova conversazione.
4. **Tab non viene mai pre-aperta.** Anche con LinkedIn chiuso, nessuno apre proattivamente `/messaging/`. La prima azione paga sempre il cold start.

### WhatsApp
1. **Stesso pattern**: `tab-manager.js` cerca/crea on-demand una tab `web.whatsapp.com`. Cold load WA Web include sync iniziale dei chat (5-15s), download history, init Service Worker WA → totale 10-25s.
2. **Se la tab non esiste** quando arriva una send/read, l'utente vede l'azione bloccata mentre WA fa boot.
3. **Nessuna pre-warm**: ogni "ciclo a freddo" della giornata paga il prezzo pieno.
4. **Differenza chiave vs LI**: WA non ha un equivalente di "apri thread da profilo URL" semplice — i thread si aprono per numero E.164 con `https://web.whatsapp.com/send?phone=<E164>`. Questo flow è già supportato; il problema è solo il cold start della tab base.

---

## La soluzione: Persistent Worker Tab (LI + WA)

Una tab di servizio per canale, in background, di proprietà dell'estensione, parcheggiata sulla rispettiva home messaging. L'utente non la vede, non gli "ruba" la tab, mai attivata.

### LinkedIn worker
- URL parcheggio: `https://www.linkedin.com/messaging/`
- Usata per read inbox e send (sia thread esistente sia nuovo).

### WhatsApp worker
- URL parcheggio: `https://web.whatsapp.com/`
- Usata per read chats, send a numero esistente, send a nuovo numero via deep link `?phone=<E164>`.

### Comportamento comune
```text
ping/init estensione
   └─> ensureWorkerTab(channel)
         ├─ Esiste owned tab su home messaging? → usa quella
         ├─ Esiste tab utente su quel dominio? → adottala (markOwned)
         └─ Altrimenti → chrome.tabs.create({ url, active:false })
                          └─ waitForLoad + warmup (1 volta)

readInbox / sendMessage
   └─ usa worker tab (già hot) → 2-6s invece di 25-50s
```

### LinkedIn — flusso send con composer
```text
sendMessage(profileUrl, body)
   ├─ worker tab già pronta su /messaging/
   ├─ cerca thread per profileUrl (URN o slug) nella lista
   ├─ TROVATO  → click thread → digita → send (verify 3.9.56)
   └─ NON TROVATO → openComposerForProfile(profileUrl):
         ├─ a) /messaging/?compose=true overlay → search recipient → select
         └─ b) Fallback: navigate worker → profile → click "Messaggia" → torna
```

### WhatsApp — flusso send
```text
sendMessage(phoneE164, body)
   ├─ worker tab già pronta su web.whatsapp.com
   ├─ Se chat per phoneE164 in sidebar → click → digita → send
   └─ Altrimenti → naviga worker tab a /send?phone=<E164>
                   → wait composer → digita → send → torna a "/"
```

### Self-healing
- Se l'utente chiude la worker tab → al prossimo ping ricreata.
- Heartbeat ogni 5 min: verifica esistenza e dominio corretto. Se navigata altrove (raro, è inactive), reindirizza alla home.
- Mai `tabs.update({ active: true })` sulla worker tab.
- Se rilevato `qr-code` su WA o `login` su LI → ping risponde con `requires_login:true`, niente tentativo di send.

---

## Modifiche puntuali

### LinkedIn (`public/linkedin-extension/`)
- **`tab-manager.js`** (nodo critico): aggiungo `ensureWorkerTab()` idempotente. `getLinkedInTabForRead` e `getLinkedInTab` per messaging → ritornano la worker tab. Comportamento esistente preservato per altri url. Storage: `li_worker_tab_id`.
- **`background.js`**: `ensureWorkerTab()` su `onInstalled`/startup (best-effort). Listener `tabs.onRemoved` invalida cache.
- **`actions.js`** (nodo critico): nuova funzione `openComposerForProfile(profileUrl)`. `sendMessage` invariato; chiama il composer SOLO se thread non trovato.
- Bump → `3.9.57`.

### WhatsApp (`public/whatsapp-extension/`)
- **`tab-manager.js`**: stesso pattern → `ensureWorkerTab()`. Storage: `wa_worker_tab_id`.
- **`background.js`**: pre-warm su startup, listener `tabs.onRemoved`.
- **`actions.js`**: in `sendMessage`, prima del flow attuale → assicura worker tab pronta. Logica deep-link `?phone=` resta com'è.
- Bump versione WA equivalente.

### UI test (`src/components/test-extensions/LinkedInTest.tsx` + `WhatsAppTest.tsx`)
- Log nuovi: `workerTabId`, `workerReady`, `threadFound|composerOpened`, `readMs`/`sendMs`.
- Pulsante "Pre-warm" esplicito per ciascun canale.

### Cosa NON tocco
AI verify, AI writer, schema selectors, `readInbox` parser, `check-inbox`, OCR, smart polling, edge functions, RLS, Email. Nessun refactor opportunistico.

---

## Edge case e rischi

| Caso | Comportamento |
|------|---------------|
| LI sessione scaduta | Ping → `requires_login:true`, nessun tentativo |
| WA QR scaduto | Ping → `requires_login:true`, mostra istruzione |
| Utente chiude worker tab | Ricreata al prossimo uso (1 cold start, poi hot) |
| Profilo LI blocca DM | `openComposerForProfile` ritorna `composerUnavailable`, warning |
| WA numero invalido / no account | Deep link mostra "Phone number shared via url is invalid" → catturato → `phoneInvalid` |
| LinkedIn cambia route compose | Fallback su click profilo → "Messaggia" |
| Browser riavviato | `onStartup` ricrea entrambe le worker tab |

---

## Risultati attesi

| Operazione | Oggi (cold) | Con worker tab |
|---|---|---|
| LI readInbox prima volta | 25-50s (timeout) | 8-15s (warmup unico) |
| LI readInbox successive | 5-10s | 2-5s |
| LI sendMessage thread esistente | 8-12s | 3-6s |
| LI sendMessage NUOVO contatto | inaffidabile | 6-10s |
| WA readInbox prima volta | 10-25s | 5-10s |
| WA readInbox successive | 4-8s | 1-3s |
| WA sendMessage numero nuovo | 8-15s | 4-7s |

---

## Domande aperte

1. **Pre-warm aggressivo all'install** di entrambe le estensioni (apre subito le 2 tab) o **lazy** (apre alla prima azione del canale)?
2. **LinkedIn composer**: preferisci `/messaging/?compose=true` (più veloce, URL non documentata ufficialmente) o sempre il path "vai su profilo → click Messaggia" (più lento ma più stabile)?
3. **WA worker su browser shutdown**: vuoi che a riavvio Chrome venga ricreata automaticamente (più reattivo) o solo on-demand (più discreto)?
