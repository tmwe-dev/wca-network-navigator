# Audit Integrazioni — mappa, sovrapposizioni, piano di semplificazione

Perimetro analizzato: tutti i ponti verso sistemi esterni (TMWE/Findair, WCA, ReportAziende, LinkedIn, WhatsApp, IMAP/SMTP, ElevenLabs, MCP, estensioni Chrome), non solo i nodi del braccio "Integrazioni" della galassia — quel braccio oggi mostra solo 11 funzioni su ~35 realmente di integrazione.

## 1. Inventario reale (verificato sul codice)

| Famiglia | Funzioni edge | Righe | Stato |
|---|---|---|---|
| TMWE / Findair | tmwe-proxy, tmwe-oauth-start, tmwe-oauth-callback, tmwe-disconnect, tmwe-catalog-sync, tmwe-customer-sync, tmwe-partner-link, tmwe-partner-match, tmwe-quote-lookup | ~1.558 | Sana: client unico `_shared/tmweClient.ts`, whitelist op, audit |
| Agente Finder API | finder-api-chat | 428 | Sovrapposto (vedi §2.1) |
| WCA | get-wca-credentials, save-wca-cookie, save-wca-contacts, sync-wca-partners, wca-country-counts, process-download-job + bridge esterno `wca-app.vercel.app` | ~1.081 | Doppio canale (vedi §2.2) |
| ReportAziende | get-ra-credentials, save-ra-cookie, save-ra-prospects | 289 | Pattern clonato (vedi §2.3) |
| LinkedIn | get/save-linkedin-credentials, save-linkedin-cookie, linkedin-profile-api, linkedin-ai-extract, send-linkedin | 881 | Pattern clonato |
| WhatsApp | send-whatsapp, whatsapp-ai-extract | 701 | Pattern clonato |
| Voce / ElevenLabs | tts, elevenlabs-tts, elevenlabs-conversation-token, elevenlabs-agent-sync, list-elevenlabs-voices, voice-brain-bridge | ~1.000 | Due TTS coesistenti (vedi §2.4) |
| MCP | mcp (auto-generato dal plugin) | 97 | Da non toccare a mano |
| Varie | browser-action, check-external-db, translate-text | 543 | Da verificare utilità |

## 2. Sovrapposizioni concrete

### 2.1 finder-api-chat vs Command
`finder-api-chat` è un secondo agente conversazionale completo (prompt proprio, KB propria `finder_api_kb`, loop tool proprio) che parla solo con TMWE. Command/unified-assistant NON ha alcun tool TMWE (`platformTools` non contiene TMWE). Risultato: due cervelli, due prompt, due KB, e l'operatore deve sapere in quale pagina chiedere cosa.
Semplificazione: TMWE diventa un gruppo di tool dentro Command (via `tmwe-proxy`), `finder-api-chat` resta solo come pagina tecnica di test del catalogo op, oppure viene ritirato.

### 2.2 WCA a due canali
Il download WCA passa sia dal bridge esterno `wca-app.vercel.app` (6 file frontend, chiamato dal browser) sia da edge functions interne (`save-wca-contacts`, `sync-wca-partners`, `process-download-job`). Due percorsi di scrittura sugli stessi dati = due punti di dedup, due gestioni di errore.
Semplificazione: un solo canale di scrittura (edge function come unico punto di persistenza; il bridge resta puro fetch).

### 2.3 Pattern credenziali clonato 3 volte
WCA, ReportAziende e LinkedIn hanno ciascuno la propria coppia `get-*-credentials` / `save-*-cookie` con logica quasi identica (auth JWT, service role, cifratura, upsert). `_shared/extensionAuth.ts` esiste già ma copre solo l'ingresso estensione.
Semplificazione: una sola funzione `extension-credentials` parametrica per provider → da 6 funzioni a 1 (~500 righe risparmiate).

### 2.4 Due TTS
`tts` e `elevenlabs-tts` chiamano entrambi ElevenLabs con configurazioni diverse (uno con rate-limit e budget, l'altro legge le impostazioni da DB). Entrambi referenziati dal frontend.
Semplificazione: unificare su una funzione con la somma dei comportamenti (budget + voce da settings).

### 2.5 Estensioni Chrome
Sei estensioni distinte in `public/` (chrome-extension, email-extension, linkedin-extension, whatsapp-extension, ra-extension, partner-connect-extension) con manifest, popup e bridge separati e codice largamente ripetuto.
Semplificazione possibile ma a rischio distribuzione: valutabile in fase separata, non ora.

## 3. Quanto si può semplificare

| Intervento | Da → A | Rischio |
|---|---|---|
| Unificare credenziali estensioni | 6 funzioni → 1 | Medio (tocca auth estensioni) |
| Unificare TTS | 2 → 1 | Basso |
| TMWE come tool di Command, ritiro finder-api-chat | 1 agente in meno | Medio (pagina Finder API) |
| Canale unico scrittura WCA | 2 percorsi → 1 | Alto (persistenza) |
| Verifica orfani: check-external-db, browser-action, translate-text, super-mario | fino a −3 funzioni | Basso |

Totale realistico: da ~35 funzioni di integrazione a ~26, con ~1.500 righe in meno e un solo agente conversazionale invece di due. TMWE, MCP e IMAP restano come sono: sono i pezzi meglio costruiti.

## 4. Ordine di esecuzione proposto

1. Fase A (rischio basso, subito): unificazione TTS + conferma/rimozione funzioni senza chiamanti reali + estensione del braccio "Integrazioni" della galassia a tutte le ~35 funzioni reali.
2. Fase B: TMWE come gruppo di tool in Command, con la pagina Finder API che diventa consultazione catalogo.
3. Fase C: unificazione credenziali estensioni dietro una sola funzione parametrica, con compatibilità dei nomi vecchi finché le estensioni non sono aggiornate.
4. Fase D (solo dopo A–C): canale unico di scrittura WCA.

## 5. Note tecniche

- Nessuna cancellazione senza periodo di osservazione dei log: le funzioni candidate all'orfanaggio vengono prima strumentate, poi rimosse.
- `supabase/functions/mcp/index.ts` è rigenerato dal plugin Vite: le modifiche vanno fatte in `src/lib/mcp/`.
- Il ritiro di `finder-api-chat` implica migrare `finder_api_kb` dentro la KB principale.
- Ogni fase mantiene invariati contratti di risposta e whitelist op TMWE.
