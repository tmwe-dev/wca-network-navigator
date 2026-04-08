# Guida Configurazione ElevenLabs
## TMWE / FINDAIR — Aurora, Bruce, Robin

> Guida operativa passo-passo per configurare i 3 agenti in ElevenLabs.
> Integrazione con il Brain WCA via webhook `voice-brain-bridge`.
> Vedi anche: `MANUALE_AGENTI_AI.md`, `INTEGRAZIONE_11LABS.md`, `PROMPT_11LABS_*.md`.

---

## 1. Configurazione comune (tutti e 3 gli agenti)

### 1.1 Secrets (Dashboard → Agent → Secrets)

| Nome | Valore |
|---|---|
| `VOICE_BRIDGE_SECRET` | stringa random ≥32 char, **uguale** a quella in Supabase Edge Functions Secrets |

### 1.2 Tool custom `wca_brain_consult` (Dashboard → Agent → Tools → Add)

| Campo | Valore |
|---|---|
| **Name** | `wca_brain_consult` |
| **Description** | `Consulta il cervello WCA per decidere cosa dire. Chiamalo ad ogni turno utile. Restituisce {say, end_call, transfer_to_human}. Devi pronunciare esattamente say.` |
| **Method** | `POST` |
| **URL** | `https://<PROJECT_REF>.functions.supabase.co/voice-brain-bridge` |
| **Headers** | `Content-Type: application/json`<br>`x-bridge-secret: {{secrets.VOICE_BRIDGE_SECRET}}` |
| **Timeout** | 15 s |
| **Body parameters** | `intent` (string, required)<br>`utterance` (string)<br>`transcript` (array)<br>`external_call_id` (string, required, `{{conversation_id}}`)<br>`agent_id` (string, `{{agent_id}}`)<br>`caller_context` (object)<br>`direction` (string) |
| **Response — speak field** | `say` |
| **Response — end call field** | `end_call` |
| **Response — transfer field** | `transfer_to_human` |

### 1.3 LLM (comune a tutti)

| Campo | Valore |
|---|---|
| **Model** | `gpt-4o-mini` (o `claude-haiku-3.5`) |
| **Temperature** | `0.2` |
| **Max tokens** | `120` |
| **Prompt caching** | ON |

> L'LLM dell'agente 11Labs non deve pensare al dominio: deve solo orchestrare turni e chiamare il tool. Il cervello vive nel Brain WCA.

### 1.4 ASR / Turn-taking / Interruptions

| Campo | Valore |
|---|---|
| **ASR model** | Multilingual v2 |
| **Language detection** | Auto (fallback IT) |
| **Turn-taking mode** | Server VAD |
| **User silence timeout** | 4 s (prima di `intent: silence`) |
| **Interruption sensitivity** | High |
| **End-of-utterance silence** | 700 ms |
| **Max response duration** | 6 s (hard cap TTS) |

---

## 2. AURORA — Internal Copilot

**Dashboard → Create Agent → Name: `Aurora`**

### 2.1 Settings

| Parametro | Valore |
|---|---|
| **System prompt** | incolla `PROMPT_11LABS_AURORA.md` (~280 parole, solo il blocco testo) |
| **Voice** | `Bella ITA` o `Giulia` (italiana femminile calma) — idealmente clonata da voce interna |
| **Stability** | 0.50 |
| **Similarity boost** | 0.78 |
| **Style exaggeration** | 0.10 |
| **Speaker boost** | ON |
| **Optimize streaming latency** | 3 |
| **Output format** | `pcm_16000` (widget web) |
| **First message** | `Ciao, sono Aurora. Cosa ti serve?` |
| **Max conversation duration** | 20 min |
| **Knowledge base 11Labs** | VUOTA (il Brain gestisce tutto) |
| **Tools abilitati** | `wca_brain_consult` + `end_call` + `transfer_to_human` |

### 2.2 Dynamic variables (iniettate dal widget web al boot)

- `operator_user_id` — UUID utente loggato in piattaforma
- `current_page` — path della pagina corrente
- `current_partner_id` — UUID se la pagina mostra un partner
- `current_workflow_state_id` — UUID se è attivo un workflow
- `org` — `TMWE` o `FINDAIR`

### 2.3 Embed widget nella piattaforma

```html
<elevenlabs-convai
  agent-id="AURORA_AGENT_ID"
  dynamic-variables='{"operator_user_id":"{{user.id}}","current_page":"{{location.pathname}}","current_partner_id":"{{ctx.partnerId}}","current_workflow_state_id":"{{ctx.workflowStateId}}","org":"TMWE"}'>
</elevenlabs-convai>
<script src="https://elevenlabs.io/convai-widget/index.js" async></script>
```

---

## 3. BRUCE — Customer Care vocale TMWE

**Dashboard → Create Agent → Name: `Bruce TMWE`**

### 3.1 Settings

| Parametro | Valore |
|---|---|
| **System prompt** | incolla `PROMPT_11LABS_BRUCE.md` (~290 parole) |
| **Voice** | `Antoni` adattato o voce maschile italiana profonda autorevole (idealmente custom clonata) |
| **Stability** | 0.55 |
| **Similarity boost** | 0.80 |
| **Style exaggeration** | 0.10 |
| **Speaker boost** | ON |
| **Optimize streaming latency** | 3 |
| **Output format** | `ulaw_8000` (Twilio phone) / `mp3_44100` (web) |
| **First message** | `Buongiorno, sono Bruce di TMWE. Come posso aiutarla?` |
| **Max conversation duration** | 20 min |
| **Knowledge base 11Labs** | VUOTA |

### 3.2 Dynamic variables (da webhook Twilio inbound)

- `caller_phone` — numero chiamante
- `partner_id` — lookup DB fatto prima nel webhook Twilio
- `contact_id` — lookup DB
- `direction` — `inbound`

### 3.3 Twilio integration

1. ElevenLabs → Phone → Import Twilio number → Assign Bruce agent.
2. Configurare webhook Twilio in modo che faccia lookup partner/contact in DB prima di passare a 11Labs.
3. Pass dynamic variables via URL params:
   `?partner_id={{lookup}}&contact_id={{lookup}}&direction=inbound&caller_phone={{From}}`

---

## 4. ROBIN — Sales Hunter Killer TMWE

**Dashboard → Create Agent → Name: `Robin TMWE`**

### 4.1 Settings

| Parametro | Valore |
|---|---|
| **System prompt** | incolla `PROMPT_11LABS_ROBIN.md` (~300 parole) |
| **Voice** | maschile italiana profonda decisa, calda ma autorevole. Consiglio: clona una voce umana del team commerciale (signature brand) |
| **Stability** | 0.55 |
| **Similarity boost** | 0.80 |
| **Style exaggeration** | 0.15 |
| **Speaker boost** | ON |
| **Optimize streaming latency** | 3 |
| **Output format** | `ulaw_8000` (Twilio outbound) |
| **First message** | **VUOTO** (la prima frase esce dal Brain con `intent: opening`) |
| **Max conversation duration** | 15 min (hard cap outbound) |
| **Knowledge base 11Labs** | VUOTA |

### 4.2 Dynamic variables (da sistema campagne TMWE)

- `partner_id` — target della chiamata
- `contact_id` — specifica persona da cercare
- `phone` — numero da chiamare
- `operator_briefing` — istruzione di campagna (es. "Recovery partner silente 3 mesi, last touch fiera Monaco")
- `direction` — `outbound` o `inbound`

### 4.3 Outbound batch calling

Dashboard → Outbound → Create Batch:

1. Upload CSV con colonne: `phone_number, partner_id, contact_id, operator_briefing`
2. Mapping colonne → dynamic variables dell'agente Robin
3. Finestra oraria: 9:30-12:30 e 14:30-17:30 fuso locale destinatario
4. Max 3 tentativi, retry dopo 48h
5. Recording: ON
6. Transcript storage: ON (finisce in `voice_call_sessions.transcript`)

### 4.4 Safety controls Robin

- **Max retries** per contatto: 3
- **Cooldown** dopo rifiuto esplicito: 30 giorni
- **Kill switch**: toggle "pause all outbound" nella piattaforma che disattiva tutte le campagne
- **Max conversation duration**: 15 min
- **Daily cap** per numero: 1 tentativo/giorno

---

## 5. Dizionario pronuncia (Dashboard → Agent → Pronunciation)

Caricare lo stesso CSV su tutti e 3 gli agenti:

```csv
word,pronunciation
TMWE,Ti Em dabliu i
FindAir,Faind eir
WCA,vu ci a
IATA,iata
FCO,effe ci o
MXP,emme ics pi
LHR,elle acca erre
JFK,gei effe kappa
LCL,elle ci elle
FCL,effe ci elle
AWB,a vu bi
DG,di gi
POD,pi o di
EUR1,eu erre uno
ETA,e ti a
ETD,e ti di
HS Code,acca esse code
ZTL,zeta ti elle
DAP,di a pi
DDP,di di pi
```

Versione inglese (per chiamate EN, stesso CSV ma pronuncia diversa di TMWE/FindAir):

```csv
TMWE,T M W E
FindAir,Find Air
```

---

## 6. Regole di sicurezza (tutti gli agenti)

### 6.1 Override security (Dashboard → Agent → Security → Overrides)

DISABILITA gli override client-side di:
- System prompt
- First message
- Voice ID
- Language
- LLM settings

Consenti override SOLO di `dynamic_variables`. Impedisce tampering lato browser/app.

### 6.2 Allowed domains

Nel tab **Security → Allowed domains**, metti SOLO i domini della piattaforma:
- `*.tmwe.it`
- `*.findair.com`
- `app.wca-nav.com`

Mai lasciare `*` o wildcard globali.

### 6.3 Secret management

- `VOICE_BRIDGE_SECRET` va salvato come **Secret**, non come variable visibile.
- Il bridge Supabase rifiuta chiamate senza quel secret → nessuno può fare hijack dell'endpoint anche scoprendo l'URL.
- Rotazione consigliata ogni 90 giorni (update simultaneo Supabase + 11Labs).

### 6.4 Rate limit

- Nel bridge Supabase imposta edge function rate limit a **10 req/s** per agente.
- Protegge da loop rotti di 11Labs che chiamano il bridge in continuo.

### 6.5 Recording consent

Per Bruce e Robin (telefono reale), aggiungi in KB `voice_rules` una categoria `compliance_recording_consent` con il disclaimer da pronunciare all'inizio se il paese lo richiede. Il bridge lo inietta automaticamente nel system prompt del Brain.

### 6.6 End call hard cap

Oltre il limite max conversation duration, 11Labs chiude la chiamata a prescindere. Limiti consigliati:
- Aurora: 20 min
- Bruce: 20 min
- Robin: 15 min

Evita "cammellate" costose e loop.

---

## 7. Secrets lato Supabase (Edge Functions)

In **Supabase → Edge Functions → voice-brain-bridge → Secrets**:

| Secret | Descrizione |
|---|---|
| `VOICE_BRIDGE_SECRET` | Stessa stringa di 11Labs (≥32 char random) |
| `VOICE_BRIDGE_USER_ID` | UUID del service user dell'organizzazione (owner `voice_call_sessions` e memorie) |
| `LOVABLE_API_KEY` | già presente per il Brain |
| `SUPABASE_URL` | già presente |
| `SUPABASE_SERVICE_ROLE_KEY` | già presente |

---

## 8. Test smoke (per ogni agente)

### 8.1 Test bridge da CLI

```bash
curl -X POST https://<PROJECT_REF>.functions.supabase.co/voice-brain-bridge \
  -H "Content-Type: application/json" \
  -H "x-bridge-secret: $VOICE_BRIDGE_SECRET" \
  -d '{
    "external_call_id": "test_001",
    "intent": "opening",
    "utterance": "",
    "transcript": [],
    "caller_context": { "operator_briefing": "Test smoke" },
    "direction": "inbound"
  }'
```

Atteso: HTTP 200 con JSON `{"say":"...","end_call":false,...}`

### 8.2 Test vocale end-to-end

1. Dashboard 11Labs → Agent → Test → Start conversation
2. Verifica prima frase (da first_message per Aurora/Bruce, dal Brain per Robin)
3. 3 turni di conversazione tipici del dominio
4. Verifica pronuncia TMWE e FindAir
5. Test interruption: parla sopra l'agente → deve tacere
6. Verifica transcript salvato in `voice_call_sessions`
7. Verifica memoria outcome salvata in `ai_memory`

---

## 9. Checklist pre-go-live (per ogni agente)

- [ ] System prompt incollato
- [ ] Voice scelta e testata su 3 frasi campione
- [ ] Tool `wca_brain_consult` configurato con secret
- [ ] `VOICE_BRIDGE_SECRET` e `VOICE_BRIDGE_USER_ID` impostati lato Supabase
- [ ] Dizionario pronuncia caricato
- [ ] Dynamic variables mappate
- [ ] Allowed domains ristretti
- [ ] Override security bloccata lato client
- [ ] Test smoke bridge: HTTP 200 con `say` non vuoto
- [ ] Test vocale end-to-end di 3 turni
- [ ] Recording + transcript verificati in `voice_call_sessions`
- [ ] Memoria outcome verificata in `ai_memory`
- [ ] Max duration e retries impostati
- [ ] Rate limit edge function attivo
- [ ] Kill switch testato (pause outbound per Robin)
- [ ] Safety controls testati (retries, cooldown)

---

## 10. Costi stimati ElevenLabs (riferimento)

| Agente | Minuti/mese previsti | Piano consigliato |
|---|---|---|
| Aurora (interno) | 200-500 min | Creator o Pro |
| Bruce (inbound) | 1000-3000 min | Pro o Scale |
| Robin (outbound) | 2000-5000 min | Scale o Enterprise |

> Il costo dell'LLM dell'agente 11Labs è incluso; il costo del Brain (aiChat su Lovable Gateway) è separato e a carico di Supabase/Lovable. Monitora entrambi da dashboard.

---

## 11. Monitoring post-go-live

Monitora questi KPI settimanalmente (Mira li raccoglierà in automatico quando la implementeremo):

- **Latenza media tool** `wca_brain_consult` (target < 2.5s)
- **Tasso errore tool** (target < 1%)
- **Durata media chiamata** per agente
- **Tasso di `transfer_to_human`** (target Bruce < 15%, Robin < 10%)
- **Tasso di `end_call` early** (target < 20%)
- **Sentiment medio transcript** (se abilitato)
- **Costo per minuto** (ElevenLabs + Lovable Gateway combinati)

---

*Documento vivo. Versione 1.0 — Aprile 2026.*
*Aggiornare quando si aggiungono nuovi agenti o si modificano i parametri in produzione.*
