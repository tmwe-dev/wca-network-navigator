
Obiettivo: darti un’alternativa che non dipenda da GitHub e che riduca al minimo la gestione manuale del bridge.

Cosa ho verificato nel codice:
- Il blocco vero è in `supabase/functions/voice-brain-bridge/index.ts`: oggi il bridge risponde `401` se manca o non combacia `x-bridge-secret`, e `500` se manca `VOICE_BRIDGE_USER_ID`.
- Però `VOICE_BRIDGE_USER_ID` in realtà è già risolvibile senza secret: una migrazione ha creato un service user fisso (`a0000000-0000-4000-a000-000000000b07`) e anche l’helper `public.get_service_user_id()`.
- Quindi il secret `VOICE_BRIDGE_USER_ID` si può eliminare del tutto.
- Il solo punto che non si può togliere “a zero” senza rischi è l’autenticazione del webhook: il bridge è pubblico e ElevenLabs non entra con il login dell’utente, quindi senza una protezione chiunque potrebbe colpirlo.

Soluzione consigliata:
- Togliere completamente `VOICE_BRIDGE_USER_ID`.
- Sostituire il secret statico del bridge con un token breve per singola chiamata, generato dal backend quando l’utente avvia la call.
- Tenere compatibilità col vecchio schema solo come fallback.

Piano di implementazione:
1. Rendere il bridge indipendente da `VOICE_BRIDGE_USER_ID`
   - usare il service user già seedato come fallback fisso;
   - così non devi più recuperare nessun UUID manualmente.

2. Introdurre un token “per-sessione”
   - estendere `elevenlabs-conversation-token` oppure aggiungere un endpoint di init;
   - quando parte la chiamata, il backend genera un token breve legato a `agent_id` e `external_call_id`.

3. Salvare il token in backend in modo sicuro
   - nuova tabella per token bridge con hash, scadenza, agent, call id e creatore;
   - mai salvare il token in chiaro.

4. Aggiornare il flusso frontend
   - `AgentVoiceCall.tsx` richiederà sia il conversation token sia il bridge token;
   - il token verrà passato alla sessione voce in modo che ElevenLabs lo inoltri al webhook.

5. Aggiornare `voice-brain-bridge`
   - accettare il token breve come autenticazione primaria;
   - validare scadenza, match con agente/chiamata e uso consentito;
   - continuare a loggare su `voice_call_sessions`, `request_logs`, `ai_request_log` e `ai_memory`.

6. Fallback pratico se ElevenLabs non supporta header/body dinamici
   - manteniamo un solo secret statico per il bridge;
   - ma eliminiamo comunque `VOICE_BRIDGE_USER_ID`;
   - quindi resterebbe un solo valore da configurare, non due.

Alternativa “zero secret” vera:
- Disattivare del tutto il bridge e usare l’agente voce solo con prompt/KB dentro ElevenLabs.
- Pro: niente secret, niente service user, setup più semplice.
- Contro: perdi la parte intelligente del sistema, cioè contesto partner, workflow, memoria, log operativi e telemetria strutturata.

Scelta che ti consiglio:
- Se vuoi mantenere il Brain vero del sistema: token breve per chiamata.
- Se vuoi la soluzione più veloce e minimale: modalità voce senza bridge.

Dettagli tecnici:
- Il bridge oggi non può essere convertito banalmente a JWT utente, perché è chiamato da un sistema esterno.
- `VOICE_BRIDGE_USER_ID` è superfluo grazie alla migrazione già presente.
- Il modello più pulito è:
```text
Utente loggato -> avvio chiamata -> backend emette token breve
-> ElevenLabs chiama voice-brain-bridge con token breve
-> bridge valida token -> esegue logica + log
```

Verifica finale prevista:
- chiamata valida: `200`, sessione creata/aggiornata;
- token scaduto o errato: `401`;
- chiusura chiamata: outcome salvato e telemetria presente;
- test end-to-end da UI con chiamata reale.

In sintesi: sì, c’è un’alternativa. Possiamo togliere del tutto lo `USER_ID` e, per evitare anche il secret statico, cambiare architettura del bridge verso token temporanei per chiamata. È la strada più pulita e non richiede GitHub.
