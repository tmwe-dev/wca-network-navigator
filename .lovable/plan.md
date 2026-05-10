## Audit LinkedIn + WhatsApp — caccia al tesoro

Ho ricostruito il flusso end-to-end (UI → SSOT → ai_pending_actions → pending-action-executor → edge `send-*` → estensione) e l'ho confrontato con il "canale unico" v3.9.56 (`from-webapp-li` / `from-webapp-wa`).

Sotto i punti dove la confidenza è < 80%, divisi per gravità. Ognuno va valutato insieme prima di toccare codice.

---

### 🔴 CRITICI — l'invio "approvato" oggi non parte

**1. La coda `extension_dispatch_queue` è morta.**
`send-linkedin` (riga 234) e `send-whatsapp` inseriscono ancora in `extension_dispatch_queue`. Nessuna estensione la consuma:
- `linkedin-extension/content.js` ascolta solo `from-webapp-li` (riga 196).
- `whatsapp-extension/content.js` ascolta solo `from-webapp-wa` (riga 234).
- `partner-connect-extension/background.js` (riga 297) dichiara esplicitamente: «Usa il canale from-webapp-li». 
Memoria `linkedin-single-channel-rule` lo segna come "debito noto fuori scope": di fatto, **ogni messaggio approvato in `ai_pending_actions` finisce in una coda fantasma e non viene mai inviato**.

**2. `pending-action-executor` chiama le edge con il service_role come `Authorization`.**
File: `supabase/functions/pending-action-executor/index.ts` righe 230 e 248. Le edge `send-linkedin`/`send-whatsapp` fanno `supabase.auth.getUser()` su quel token (riga 40 di send-linkedin) → ritorna sempre `401 unauthorized`. Anche se la coda fosse viva, l'esecuzione fallirebbe sempre.

**3. L'agent (LUCA / agent-execute) non invia davvero.**
`supabase/functions/agent-execute/toolHandlers/emailTools.ts`:
- `handleSendWhatsApp` (riga 184–205): fa solo INSERT in `activities` con `status:'pending'` + `runPostSendPipeline`. **Nessun postMessage, nessuna edge, nessuna coda.** Ritorna `{success:true, queued_to_bridge:true}` → l'AI riferisce all'utente "messaggio inviato" mentre non è mai partito.
- `handleSendLinkedIn` (riga 246–263): identico. 
Risultato: cadenze, autopilot e Command Page non producono output reale sui due canali.

**4. Editorial Review by-passato dai send manuali.**
- `src/hooks/useSendLinkedIn.ts` chiama direttamente `liBridge.sendDirectMessage` (riga 94) e `sendConnectionRequest` (riga 153) senza `journalistReview`. 
- `src/hooks/useSendWhatsApp.ts` stesso pattern. 
Memoria `editorial-review-layer-mandatory` li classifica come obbligatori → violazione doctrine sui due canali con il maggior volume manuale.

---

### 🟠 ALTI — SSOT incompleto / fonti di confusione

**5. SSOT non collegato all'esecuzione.**
`queueLinkedInForApproval` / `queueWhatsAppForApproval` scrivono in `ai_pending_actions`. L'approvazione passa per il branch rotto (#1+#2). La nuova SSOT è solo cosmetica finché executor + edge non sono allineate al canale `from-webapp-*`.

**6. Due bridge LinkedIn coesistono.**
- `useLinkedInExtensionBridge` (vecchio, usato da `useSendLinkedIn` cockpit) — `requestId` prefisso `li_*`.
- `useLinkedInMessagingBridge` (nuovo, usato da inbox + test) — `requestId` prefisso `li_msg_*`.
Entrambi montano un listener globale su `from-extension-li`. Ho ≥2 punti in cui possono concorrere sullo stesso evento → race / risposte perse. SSOT richiede un solo bridge.

**7. Night-pause LinkedIn calcolata in UTC.**
`send-linkedin` riga 126: `clampedTime.getHours()` → ore UTC sul runtime Deno, ma il commento dice "CET". In estate è 2h di shift, in inverno 1h: i job notturni possono partire dentro la "pausa" o slittare di un giorno. Confidenza < 50%.

---

### 🟡 MEDI — comportamenti incoerenti, tracciamento parziale

**8. Daily-limit LinkedIn basato sulla coda morta.**
Riga 56–70: conta su `extension_dispatch_queue`. Visto che oggi nessuno invia da lì, il contatore reale è ~0 → il cap "50/giorno" non viene mai raggiunto, anche se l'utente manda 200 messaggi via bridge diretto. Va spostato su `channel_messages` (direction=outbound, channel=linkedin).

**9. `send-whatsapp` privo di hard-cap e night-pause.**
A differenza di LinkedIn, non ha daily limit né finestra oraria. Solo rate limit per minuto (`check_channel_rate_limit`). Asimmetria con la dottrina commerciale.

**10. WhatsApp bridge: ping ogni 3 s + config con chiave nominata diversa.**
- `useWhatsAppExtensionBridge` riga 111 → `setInterval(doPing, 3000)`. Carico continuo, log spam, drain mobile. Suggerisco 10–15 s come LinkedIn.
- `setConfig` (riga 88) usa `anonKey`, mentre LinkedIn usa `supabaseAnonKey`. Contratto bridge non uniforme (rischio rottura silenziosa quando aggiorniamo l'estensione).

**11. Rate-limit LinkedIn salta sugli scheduled.**
Riga 143: `isImmediate = !scheduled || ≤now+60s`. Bulk programmati bypassano `check_channel_rate_limit`. Bulk a 100 messaggi @ T+5min può saturare.

**12. `useSendLinkedIn` fallback clipboard silenzioso.**
Quando il bridge fallisce (riga 108-115), copia il testo e apre il tab. Non scrive su `channel_messages`, non aggiorna `last_outbound_at`, non scatta holding-pattern. La cadenza pensa di avere inviato.

---

### 🔵 BASSI — pulizia / debito noto

**13. `useSendWhatsApp`** non logga `channel_messages` finché l'utente non risponde manualmente → impossibile dedup outbound nei thread.

**14. `useBulkLinkedInDispatch`** ora alimenta `ai_pending_actions` (OK), ma con executor rotto è UI senza effetti → da disabilitare o gating finché #1/#2 non sono risolti.

**15. `partner-connect-extension/wa-content.js`** legge ancora `extension_dispatch_queue` per WA in alcuni rami (debito eredità). Va confermato che non duplichi gli invii nel giorno in cui ripariamo l'executor.

---

### Cosa propongo di decidere insieme (no codice ancora)

**Opzione A — Riparare la pipeline approvazione (consigliata)**
1. Sostituire in `pending-action-executor` la chiamata a `send-linkedin`/`send-whatsapp` con un meccanismo che, lato webapp aperta dell'owner, ri-emetta il `from-webapp-*` (es. canale realtime dedicato + listener globale singleton). Edge functions diventano gate (rate-limit + journalist + audit) ma non scrivono più nella coda morta.
2. Allineare `agent-execute` agli stessi gate (oggi fittizio).
3. Spegnere/migrare `extension_dispatch_queue` (read-only deprecation).

**Opzione B — Riabilitare la coda**
Far partire l'estensione a poll-are `extension_dispatch_queue` (com'era nelle versioni vecchie). Più semplice ma rinuncia al canale unico v3.9.56 e va contro la memoria `linkedin-single-channel-rule`.

**Opzione C — Solo manuale**
Ammettere che oggi LI/WA funzionano solo dal cockpit con utente attivo: rimuovere bulk/agent/cadence sui due canali finché la pipeline non c'è (chiusura debito a freddo).

Domande aperte da sciogliere:
- Confermiamo che la dottrina è "canale unico from-webapp-*" anche per send approvati? (impatta opzione A vs B)
- L'agent può inviare LI/WA in autonomia o solo proporre per approvazione? (impatta #3)
- Daily-cap 50 LI: lo vogliamo per utente, per partner, o globale workspace?
