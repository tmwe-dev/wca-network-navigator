## Cosa è successo (diagnosi)

Il send funziona (3 invii consecutivi OK). A fallire è **`readInbox`**, non il click. Il log dice tutto:

```
04:02:26  📨 Lettura inbox LinkedIn (30s timeout)...
04:03:01  ⚠️ {"success": false, "error": "Timeout 35s"}   ← 35 secondi netti
```

**Il "Timeout 35s" è del client** (`liMsg(..., 35000)` in `LinkedInTest.tsx:197`), non dell'estensione. L'estensione probabilmente ha completato dopo, ma noi avevamo già abbandonato l'attesa.

### Perché prima andava e adesso no
Le 3 volte che ha funzionato, la tab LinkedIn era **già su `/messaging/`** → `getLinkedInTabForRead` faceva *reuse exact-match* (riga 309 di `tab-manager.js`), letture in 5-8s.

Adesso il banner dice "📌 Destinatario FISSO LinkedIn: …/in/gianfranco-cristiano…". L'unica tab LinkedIn aperta è su un **profilo**, non su `/messaging/`. Quindi:

1. `getLinkedInTabForRead` **non trova exact-match** → apre una **nuova tab background** (`chrome.tabs.create`, riga 319).
2. `waitForLoad` fino a 20s + `sleep(2500)` di stabilizzazione = già 8-22s spesi prima ancora di iniziare.
3. Poi parte Optimus AI (`tryOptimusInbox`) → cold-start edge function `linkedin-ai-extract` (i log mostrano boot multipli a `1778378319`).
4. Se Optimus torna 0 thread fa **un secondo giro con relearn** (riga 933) → altri 5-10s.
5. Poi `harvestInboxUrls` (riga 947).

Totale tipico in cold-tab: 40-60s. Il client molla a 35s e mostra "Nessun thread trovato" anche se l'estensione sta ancora lavorando.

**Il send non è rotto. Il read non ha più tempo a sufficienza quando deve aprire una tab nuova.**

## La correzione (minima, locale, reversibile)

Tre interventi piccoli, tutti **fuori** dai nodi critici (writer, single-click, anti-double-send, AI verify):

### 1. Alza il budget del client da 35s → 90s (UI-only)
File: `src/components/test-extensions/LinkedInTest.tsx`
- riga 197: `liMsg("readLinkedInInbox", {}, 35000)` → `90000`
- riga 318: stesso per `diagnosticLinkedInDom` (stesso problema potenziale)

Allineato al timeout di `liMsg` per `sendMessage` (già 120s).

### 2. Migliore feedback: countdown nel log
Mentre aspetta, mostrare "⏳ ancora in attesa… (15s/45s/75s)" così l'operatore capisce che sta lavorando, non è impallato.

### 3. (Opzionale, da decidere) Warm-up tab esplicito
Aggiungere prima del read un piccolo handshake `pingMessagingTab` che:
- se non c'è exact-match, apre la background tab e ritorna subito `{warming: true}`,
- l'utente vede "🔄 Apertura tab messaggi in background…" e poi parte la lettura vera.

Così il primo read dopo "destinatario fisso" non sembra mai bloccato.

## Cosa NON viene toccato

- `hybrid-ops.js` (writer, AI verify, anti-double-send)
- `tab-manager.js` (logica di acquisizione tab, READ vs SEND separation)
- `actions.js readInbox()` (Optimus, AX fallback, harvest)
- `ai-bridge.js`, `linkedin-ai-extract`
- WhatsApp, Email, manifest, versione 3.9.56

Zero rischio di rompere il send che funziona.

## Tre conferme prima di procedere

**A. Timeout target:** 90s (sicuro per cold-tab) o 60s (più aggressivo)?
**B. Warm-up tab esplicito (intervento 3):** lo aggiungo o basta alzare il timeout?
**C. Diagnostica nel result quando il read riesce:** vuoi vedere `tabReused: true|false`, `optimusLatencyMs`, `methodUsed: optimus-cache|optimus-ai|legacy-ax|structural` nel log del pannello test?

Dimmi A/B/C e procedo.
