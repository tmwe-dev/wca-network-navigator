
# Audit LinkedIn — Stato del codice e della struttura

Mappa completa di tutto ciò che riguarda LinkedIn (estensione, edge functions, hook, DAL, DB) con findings e raccomandazioni. **Nessuna modifica al codice**: questo è solo un report. Se vuoi, dopo possiamo aprire interventi mirati sui punti P0/P1.

---

## 1. Inventario (cosa esiste oggi)

### 1.1 Chrome extension `public/linkedin-extension/` — v3.9.14
12 file JS, ~4.000 LOC totali:

| File | LOC | Ruolo |
|---|---|---|
| `background.js` | 189 | Router messaggi (action registry) |
| `actions.js` | 929 | extractProfile, sendMessage, sendConnectionRequest, searchProfile, readInbox, readThread, backfillThread, diagnostic, learnDom |
| `hybrid-ops.js` | 407 | 3-level fallback (AX Tree → AI Learn → Structural) per estrazione e invio |
| `ax-tree.js` | 447 | Estrazione via Chrome Accessibility Tree |
| `ai-learn.js` | 365 | Schema CSS auto-appreso via Lovable AI |
| `optimus-client.js` | 390 | Client per "Optimus" (motore plan-based) |
| `auth.js` | 332 | verifySession, syncCookie, autoLogin |
| `tab-manager.js` | 364 | Coda azioni / sessioni, ensureTabVisibleAndWait |
| `content.js` | 285 | Bridge webapp ↔ extension (origin-restricted) |
| `ai-bridge.js` | 140 | Proxy verso edge `linkedin-ai-extract` |
| `config.js` | 79 | Config Supabase + error codes |
| `popup.js` | 103 | UI popup |

Action esposte all'app: `ping`, `setConfig`, `verifySession`, `syncCookie`, `autoLogin`, `extractProfile`, `sendMessage`, `sendConnectionRequest`, `searchProfile`, `learnDom`, `readInbox`, `readThread`, `backfillThread`, `diagnostic`, `remapSendDom`.

### 1.2 Edge functions `supabase/functions/`
- `send-linkedin/` (300 LOC) — accoda invio in `extension_dispatch_queue` con journalist review + hard limits + rubrica auto-populate
- `linkedin-ai-extract/` (175 LOC) — Lovable AI per imparare selettori CSS dinamici
- `linkedin-profile-api/` (111 LOC) — proxy Proxycurl (a pagamento, attualmente fallback)
- `save-linkedin-cookie/` (78) e `save-linkedin-credentials/` (82) — gestione sessione
- `get-linkedin-credentials/` (103) — recupero credenziali per autoLogin

### 1.3 Hook React `src/hooks/`
- `useLinkedInExtensionBridge.ts` (198) — bridge generico action-based
- `useLinkedInMessagingBridge.ts` (301) — strategia ibrida FireScrape (lettura) + extension (invio)
- `useSendLinkedIn.ts` (165) — orchestratore invio con ricerca profilo (Google + searchProfile)
- `useBulkLinkedInDispatch.ts` (136) — invio massivo con timing/scheduling
- `useLinkedInBackfill.ts` (267) — backfill 2-fasi (discovery + deep) tipo WhatsApp
- `useLinkedInFlow.ts` (293) + `useLinkedInFlowHelpers.ts` (90) — pipeline flow
- `useLinkedInLookup.ts` (276) — lookup contatti/profili
- `useLinkedInSync.ts` (219) + `useLinkedInAutoSync.ts` (197) — sincronizzazione

### 1.4 DAL `src/data/`
- `linkedinAddresses.ts` (55) — rubrica
- `linkedinFlow.ts` (46) — flow items/jobs

### 1.5 Database (4 tabelle)
- `linkedin_addresses` (0 record) — rubrica popolata da auto-sync, primo invio o extractProfile
- `linkedin_flow_jobs` (0) e `linkedin_flow_items` (0) — pipeline
- `user_linkedin_sessions` (1) — cookie cifrato per utente, RLS owner-only OK
- Coda condivisa: `extension_dispatch_queue` (canale `linkedin`)

### 1.6 Distribuzione estensione
Versione richiesta in `src/lib/whatsappExtensionZip.ts` = **3.9.14**, allineata a `manifest.json` e a `catalog.json`. Storico versioni: 3.8.0 → 3.9.14 (12 release).

---

## 2. Findings prioritizzati

### P0 — Da affrontare presto

1. **Tabelle business vuote nonostante codice attivo.** `linkedin_addresses`, `linkedin_flow_jobs`, `linkedin_flow_items` hanno **0 record**. Il pipeline esiste ma non viene mai popolato in produzione. Da capire se è effetto del soft-delete globale o se l'auto-populate (in `send-linkedin` riga 261-281 e in `extractProfile`) non scatta perché nessuno ha ancora inviato/estratto profili reali. Senza rubrica popolata, la dropdown "Seleziona contatto" del test rimane sempre vuota (problema già emerso oggi).

2. **Doppio bridge sovrapposto.** Esistono due hook che parlano con la stessa estensione:
   - `useLinkedInExtensionBridge` — generico, usato da `useSendLinkedIn`, `useLinkedInLookup`, ecc.
   - `useLinkedInMessagingBridge` — strategia ibrida FireScrape+ext, usato da `useLinkedInBackfill`, `useLinkedInSync`.
   
   Hanno meccanismi separati di `setConfig` (configSentRef vs liMsgConfigSentAt), listener separati, gestione `pending` separata. Rischio: doppio invio config, race su `requestId`, ascoltatori orfani al rimontaggio. Da unificare o documentare confine netto.

3. **Ricerca profilo per test = pipeline reale (Google → linkedin.com/in/).** Confermato: il vero data path per ottenere l'URL è `useSendLinkedIn.findLinkedInProfile`:
   - Primo tentativo: Google search via `pcBridge.googleSearch` con query `site:linkedin.com/in "Nome" "Azienda"`.
   - Fallback: `liBridge.searchProfile` (DOM scraping LinkedIn).
   - Se non trovato → toast "URL profilo LinkedIn mancante".
   
   La rubrica è solo cache opportunistica, non requisito per inviare. Documentarlo nel codice (commento in cima a `useSendLinkedIn`) e nella UI di test.

### P1 — Importante ma non bloccante

4. **`linkedin-profile-api` paid e quasi inutilizzata.** Proxycurl è a pagamento e nel codice è già marcato come fallback. Se non usi credito Proxycurl, **rimuovere o disabilitare** la function (oggi rimane attiva, deployata, con `requireExtensionAuth`).

5. **Versioning estensione opaco.** 12 versioni nel catalog senza changelog strutturato (solo `note` libera). Non c'è meccanismo di **forced upgrade** lato app: se l'utente ha v3.9.10, le action più recenti (es. `findMoreBtn` in v3.9.14) silenziosamente non funzionano. La `LINKEDIN_EXTENSION_REQUIRED_VERSION` esiste ma non è chiaro se viene confrontata col `version` ritornato da `ping`.

6. **Hard limits LinkedIn: contati su `extension_dispatch_queue` non su consegne effettive.** `send-linkedin` (riga 56-62) conta tutti i record `pending|sent|failed` di oggi per il daily limit. Un messaggio fallito conta come uno usato → utente bloccato a 50 anche se nessuno è stato consegnato. Suggerimento: contare solo `delivered_at IS NOT NULL` o status `sent`.

7. **`linkedin_url` regex invio lato edge** `^https?://([\w-]+\.)?linkedin\.com/(in|pub)/` (riga 98) è ok ma non normalizza (trailing slash, query). Lato hook normalizziamo con `normalizeLinkedInProfileUrl`, ma per chiamate dirette all'edge function (es. da AI tools) la normalizzazione manca. Dedup in queue rischia duplicati `/in/foo` vs `/in/foo/`.

8. **`hybrid-ops.findBox`** (recente fix v3.9.14) ora cerca `contenteditable` e `role=dialog` con `visible`, ma `nativeInsertText` resta su `document.activeElement`: se la box è in un dialog overlay aperto da `findMoreBtn`, il focus può non essere correttamente acquisito. Da verificare in test reale che dopo il click su "Messaggio" l'editor riceva focus prima dell'insert.

### P2 — Igiene / debito tecnico

9. **`actions.js` da 929 LOC** è il file più grosso dell'estensione e mescola: extractProfile, send, search, Optimus inbox/thread, harvest URLs, learnDom, remapSendDom. Splittare in `actions/profile.js`, `actions/messaging.js`, `actions/inbox.js`.

10. **Hook count alto (10 hook LinkedIn-only).** `useLinkedInFlow`, `useLinkedInLookup`, `useLinkedInSync`, `useLinkedInAutoSync` hanno responsabilità sovrapposte. Rifattorizzare verso 3 hook chiari: bridge / messaging / sync.

11. **Naming incoerente:** `sendDirectMessage` (bridge) vs `sendMessage` (messaging) vs `send-linkedin` (edge). Standardizzare.

12. **`useSendLinkedIn.findLinkedInProfile` non scrive in rubrica.** Quando la ricerca Google trova un URL, lo mette nel draft ma non fa upsert in `linkedin_addresses` → la dropdown test resta vuota anche dopo ricerca riuscita. Aggiungere upsert opportunistico (con `display_name` dal draft).

13. **Nessun test sull'estensione.** Solo `useOutreachQueue.test.ts` tocca tangenzialmente LinkedIn. I JS dell'estensione non hanno test e i fix di selettori (3.9.x serie) sono regressioni ricorrenti.

### P3 — Osservazioni minori

14. `optimus-client.js` (390 LOC) sembra avere solo 1 chiamante (`actions.tryOptimusInbox/Thread`) → valutare rimozione se Optimus non viene più usato.
15. `ai-learn.js` cache schema su `chrome.storage.local`: nessuna scadenza visibile, rischio schemi stale dopo rilascio LinkedIn.
16. `linkedin-flow_*` tabelle vuote da settimane → candidate a deprecation o ripristino.

---

## 3. Sicurezza & compliance — verde

- ✅ Tutti gli endpoint LinkedIn passano `requireExtensionAuth` (no anon abuse).
- ✅ `user_linkedin_sessions` ha RLS owner-only.
- ✅ Cookie cifrato lato edge (non in chiaro in DB).
- ✅ Hard limits commerciali (50/day, 3/hour, 9-19 CET, 45-180s delay) coerenti col TOS LinkedIn.
- ✅ `journalistReview` obbligatorio in `send-linkedin` (eccezione autoresponder non applicabile a LI).
- ✅ Content script origin-restricted (`lovable.app`, `lovableproject.com`, localhost).

⚠️ **Da verificare**: il rate-limit orario (3/hour) — non l'ho visto applicato in `send-linkedin`, c'è solo daily. Controllare `loadLinkedInSettings` o trigger DB.

---

## 4. Risposta secca alle domande implicite

- **Il codice è strutturato bene?** Sì impalcatura, ma con sovrapposizioni (doppio bridge, hook ridondanti) e un file da 929 LOC.
- **Funziona?** Estensione 3.9.14 ha fix recenti su composer, da validare in produzione. Lato dati, le tabelle linkedin_* sono vuote → segnale che il flusso "vivo" non sta popolando la rubrica.
- **Rischi più seri?** Versioning senza forced-upgrade, doppio bridge, daily-limit conta i fallimenti.

---

## 5. Prossimi passi proposti (se vuoi procedere)

Posso aprire interventi mirati, uno per volta, su priorità a tua scelta:

1. **Forced upgrade extension** + check `version` su ping → blocca se < required.
2. **Daily limit** → contare solo invii effettivi (`delivered_at IS NOT NULL`).
3. **Auto-populate rubrica** → upsert `linkedin_addresses` quando `findLinkedInProfile` trova URL.
4. **Unificare i due bridge** (`useLinkedInExtensionBridge` + `useLinkedInMessagingBridge`).
5. **Split `actions.js`** in 3 moduli.
6. **Rimuovere/parcheggiare** `linkedin-profile-api` (Proxycurl) e tabelle `linkedin_flow_*`.

Dimmi quali vuoi affrontare e in che ordine — ognuno è cambio piccolo, locale, reversibile, conforme alla regola "non rompere ciò che funziona".
