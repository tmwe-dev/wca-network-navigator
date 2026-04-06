

# Ristrutturazione Architettonica del Sistema LinkedIn — 3 Strategie Anti-Fragilità

## Diagnosi del Sistema Attuale

Il sistema attuale (`background.js`, 1313 righe) usa **selettori CSS hardcoded** per ogni operazione:

| Operazione | Selettori Hardcoded | Rischio Rottura |
|---|---|---|
| Estrazione profilo | `h1.text-heading-xlarge`, `.text-body-medium.break-words` | ALTO |
| Invio messaggio | `div.msg-form__contenteditable`, `button.msg-form__send-button` | ALTO |
| Richiesta collegamento | `button.pvs-profile-actions__action[aria-label*='onnect']` | ALTO |
| Lettura inbox | `li.msg-conversation-listitem`, `a[href*='/messaging/thread/']` | MEDIO |
| Verifica sessione | `.global-nav__me`, `.scaffold-layout` | MEDIO |

**Ogni volta che LinkedIn aggiorna il DOM, tutto si rompe.** È successo con WhatsApp e succederà di nuovo con LinkedIn.

---

## Le 3 Strategie Proposte

### Strategia 1: Accessibility Tree via Chrome DevTools Protocol (CDP)

**Concetto**: Invece di cercare classi CSS (che cambiano), leggere l'**Accessibility Tree** — la struttura semantica che Chrome calcola per gli screen reader. I ruoli (`button`, `textbox`, `heading`, `link`) e i nomi accessibili (`"Send"`, `"Message"`, `"Connect"`) sono **stabili per necessità legale** (WCAG compliance).

**Come funziona**:
```
chrome.debugger.attach({ tabId }, "1.3")
chrome.debugger.sendCommand({ tabId }, "Accessibility.getFullAXTree")
→ Restituisce nodi con { role: "button", name: "Connect", nodeId: 42 }
→ Clicco tramite DOM.focus + Input.dispatchKeyEvent / DOM.performSearch
chrome.debugger.detach({ tabId })
```

**Vantaggi**:
- LinkedIn NON PUÒ cambiare i ruoli ARIA senza violare le leggi di accessibilità (ADA, WCAG 2.1)
- Zero dipendenza da classi CSS
- Funziona anche se LinkedIn offusca completamente le classi

**Svantaggi**:
- `chrome.debugger` mostra un banner "estensione sta debuggando" all'utente (invasivo)
- Richiede il permesso `"debugger"` nel manifest
- Leggermente più lento (~200ms per query)

**Affidabilità stimata: 95%** — LinkedIn dovrebbe violare le normative di accessibilità per rompere questo approccio.

---

### Strategia 2: AI DOM Learning (Self-Healing) — come WhatsApp

**Concetto**: Già implementato per WhatsApp. L'estensione cattura uno **snapshot strutturale** della pagina (data-testid, ruoli, aria-label, classi) e lo invia a un'edge function AI che identifica i selettori corretti. I selettori vengono **cached** (TTL 3h) e rigenerati automaticamente quando falliscono.

**Come funziona**:
```
1. Cattura snapshot DOM → { html_samples, data_testids, roles, aria_labels }
2. Invia a edge function "linkedin-ai-extract" con schema desiderato
3. AI restituisce: { nameSelector: "h1[class*='heading']", messageBox: "div[role='textbox']" }
4. Cache in chrome.storage.local (TTL 3h)
5. Se un selettore fallisce → re-learn automatico → retry
```

**Vantaggi**:
- Nessun banner "debugger" — usa solo `chrome.scripting.executeScript`
- Self-healing: si ripara da solo quando i selettori cambiano
- Già testato e funzionante per WhatsApp

**Svantaggi**:
- Dipende dalla chiamata AI (costa crediti, richiede connettività)
- Se LinkedIn cambia radicalmente la struttura (non solo classi), potrebbe fallire
- Primo accesso più lento (~2-3s per il learning)

**Affidabilità stimata: 85%** — eccellente per cambi di classi CSS, meno robusto per ristrutturazioni complete della pagina.

---

### Strategia 3: API Esterna (Proxycurl/Bright Data) per Dati + Estensione Minimale per Azioni

**Concetto**: Separare **lettura** da **scrittura**. I dati dei profili (nome, headline, azienda, location, foto) vengono recuperati via API REST (Proxycurl ~$0.01/profilo) senza toccare il DOM. L'estensione si riduce a **sole 3 funzioni DOM**: invia messaggio, invia collegamento, verifica sessione.

**Come funziona**:
```
LETTURA (API, zero DOM):
  Edge Function → Proxycurl API → { name, headline, location, company, ... }
  Nessuna navigazione, nessun selettore, nessun rischio

SCRITTURA (Estensione minimale, 3 funzioni):
  1. verifySession → cookie li_at + URL check (nessun selettore CSS)
  2. sendMessage → Accessibility Tree per trovare textbox + send button
  3. sendConnectionRequest → Accessibility Tree per trovare Connect button

SCOPERTA PROFILO (già implementata):
  Google Search "site:linkedin.com/in" via Partner Connect → 100% esterno
```

**Vantaggi**:
- Superficie di attacco DOM ridotta al minimo (3 funzioni vs 10+)
- Dati profilo sempre accurati e strutturati
- Nessun rischio di detection per lo scraping (è un'API legittima)
- Velocissimo (~200ms per profilo vs 5-10s di navigazione tab)

**Svantaggi**:
- Costo: ~$0.01 per profilo (100 profili = $1, 1000 = $10)
- Non copre azioni che richiedono autenticazione utente (messaggi, richieste)
- Richiede un account API esterno

**Affidabilità stimata: 98% lettura, 90% scrittura** — la combinazione più resiliente.

---

## Raccomandazione: Architettura Ibrida a 3 Livelli

La soluzione ottimale non è una sola strategia, ma la **combinazione intelligente** delle tre:

```text
┌─────────────────────────────────────────────────────┐
│                   LIVELLO 1: API                    │
│  Proxycurl / Bright Data per LETTURA profili        │
│  Google Search per SCOPERTA URL LinkedIn            │
│  → Zero DOM, zero rischio, dati strutturati         │
├─────────────────────────────────────────────────────┤
│              LIVELLO 2: Accessibility Tree          │
│  chrome.debugger → AX Tree per AZIONI              │
│  (sendMessage, sendConnection, verifySession)       │
│  → Selettori semantici stabili (role + name)        │
├─────────────────────────────────────────────────────┤
│              LIVELLO 3: AI Self-Healing             │
│  FALLBACK se AX Tree fallisce                       │
│  AI analizza DOM → genera selettori → cache         │
│  → Auto-ripara, già testato su WhatsApp             │
└─────────────────────────────────────────────────────┘
```

**Flusso di ogni operazione**:
1. **Profilo?** → API esterna (Livello 1). Mai toccare il DOM.
2. **Azione (messaggio/collegamento)?** → AX Tree (Livello 2). Cerca `role:"button" name:"Send"`.
3. **AX Tree fallisce?** → AI Self-Healing (Livello 3). Snapshot DOM → AI → nuovi selettori → retry.

---

## Piano di Implementazione

### Fase 1 — Refactor Estensione con AX Tree + AI Fallback
- Aggiungere `"debugger"` al manifest
- Creare modulo `ax-tree.js`: funzioni per query AX Tree per ruolo/nome
- Creare modulo `ai-learn.js`: snapshot DOM → edge function → cache selettori
- Riscrivere `extractLinkedInProfile()` usando AX Tree (heading level 1 = nome, etc.)
- Riscrivere `typeLinkedInMessage()` usando AX Tree (role: textbox → focus → type)
- Riscrivere `clickConnectButton()` usando AX Tree (role: button, name: Connect/Collegati)
- Catena di fallback: AX Tree → AI Learn → errore con diagnostica

### Fase 2 — Integrazione API Esterna per Lettura
- Creare edge function `linkedin-profile-api` che chiama Proxycurl
- Aggiungere secret `PROXYCURL_API_KEY`
- Modificare `extractProfileByUrl()` nel frontend: prima tenta API, poi estensione come fallback
- Aggiornare `useCockpitLogic`, `useLinkedInFlow` per usare il nuovo endpoint

### Fase 3 — Rimuovere Selettori Hardcoded
- Eliminare TUTTI i selettori CSS hardcoded dal `background.js`
- Mantenere solo: gestione tab, cookie, message handler
- Test automatizzati nella pagina `/test-extensions`

### File coinvolti
| File | Azione |
|---|---|
| `public/linkedin-extension/manifest.json` | Aggiungere permesso `debugger` |
| `public/linkedin-extension/background.js` | Refactor completo con AX Tree + AI fallback |
| `public/linkedin-extension/ax-tree.js` | Nuovo — modulo query Accessibility Tree |
| `public/linkedin-extension/ai-learn.js` | Nuovo — modulo AI self-healing |
| `supabase/functions/linkedin-ai-extract/index.ts` | Nuovo — edge function per AI DOM learning |
| `supabase/functions/linkedin-profile-api/index.ts` | Nuovo — edge function proxy per API esterna |
| `src/hooks/useLinkedInExtensionBridge.ts` | Aggiungere azione `learnDom` |
| `src/pages/TestExtensions.tsx` | Aggiungere test AX Tree + API |

