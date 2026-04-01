

# Pre-Setting Completo degli Agenti: Voce, Compiti, Firma, Knowledge Base

## Obiettivo

Configurare automaticamente tutti gli 11 agenti con: voce ElevenLabs basata sul genere, firme HTML con avatar e link chiamata, knowledge base operativa iniziale, e tool completi incluso `queue_outreach`. Ogni agente avrà compiti chiari pre-assegnati nel prompt e nella KB.

## Struttura del Team e Assegnazioni

| Agente | Ruolo | Genere | Voce ElevenLabs | Compiti principali |
|--------|-------|--------|-----------------|-------------------|
| **Luca** | Director | M | Daniel (british) | Supervisione, pianificazione strategica, assegnazione task, controllo qualità |
| **Robin** | Sales | M | Roger (american) | Vendita, chiusura contratti, chiamata vocale ElevenLabs (agente telefonico designato) |
| **Bruce** | Sales | M | George (british) | Vendita, negoziazione, follow-up caldi |
| **Renato** | Outreach | F* | Sarah (american) | Outreach regionale, primo contatto email/WhatsApp/LinkedIn |
| **Carlo** | Outreach | F* | Laura (italian) | Outreach Italia/Europa, comunicazioni multilingue |
| **Leonardo** | Outreach | M | Daniel (british) | Outreach mercati anglofoni, LinkedIn messaging |
| **Imane** | Research | F | Sarah (american) | Deep search, intelligence, analisi profili, report aziende |
| **Gigi** | Account Mgr | M | Roger (american) | Controllo qualità comunicazioni, verifica parametri, KPI |
| **Felice** | Account Mgr | F | Laura (italian) | Monitoraggio attività team, verifica conformità |
| **Gianfranco** | Strategy | M | George (british) | Analisi copertura, prioritizzazione contatti, selezione geografica |
| **Marco** | Download | M | Daniel (british) | Sincronizzazione WCA, gestione download (attualmente inibito per ricerca esterna) |

*\*Nota: Renato e Carlo hanno gender "female" nel file avatars — la voce seguirà il genere dichiarato.*

## Modifiche tecniche

### 1. `src/data/agentTemplates.ts` — Aggiornamenti

**Tool aggiuntivi per tutti**: aggiungere `queue_outreach` ad `ALL_OPERATIONAL_TOOLS` (manca attualmente, ma è disponibile nell'edge function).

**Prompt aggiornati** per ogni ruolo con compiti operativi specifici:
- **sales**: Aggiungere flusso cockpit (seleziona contatti → genera comunicazione via mission context → invia tramite email/WhatsApp/LinkedIn → inserisci link chiamata vocale con Robin nell'email). Menzionare uso di preset/goal/proposte.
- **outreach**: Specificare che opera dal cockpit, usa i mission context assegnati dal responsabile, e invia tramite `queue_outreach` per WhatsApp/LinkedIn.
- **account**: Aggiungere compiti di verifica: numero contatti, qualità, aderenza istruzioni.
- **strategy**: Aggiungere selezione contatti per qualità e interesse geografico, decisione su chi contattare per primo.
- **research**: Specificare che le attività di ricerca esterna (report aziende, altri sistemi) sono temporaneamente inibite; focus su deep search e arricchimento profili interni.

### 2. `src/data/agentTemplates.ts` — Nuova mappa voci di default

```typescript
export const AGENT_DEFAULT_VOICES: Record<string, { voiceId: string; voiceName: string }> = {
  male: { voiceId: "onwK4e9ZLuTAKqWW03F9", voiceName: "Daniel 🇬🇧" },
  female: { voiceId: "EXAVITQu4vr4xnSDxMaL", voiceName: "Sarah 🇺🇸" },
};
```

### 3. `src/components/agents/CreateAgentDialog.tsx` — Auto-setting alla creazione

Quando si crea un agente:
- Leggere il `gender` dall'avatar selezionato (`AGENT_AVATARS`)
- Assegnare automaticamente `elevenlabs_voice_id` in base al genere
- Generare automaticamente `signature_html` con:
  - Avatar dell'agente (immagine)
  - Nome + "Agente Digitale TMWI"
  - Link chiamata vocale Robin (se disponibile)
- Assegnare una `knowledge_base` iniziale con entry tipo:
  ```json
  [{ "title": "Compiti operativi", "content": "..." }]
  ```

### 4. `src/components/agents/AgentSignatureConfig.tsx` — Aggiornare `generateDefaultSignature`

Modificare la firma auto-generata per includere:
- Avatar come immagine (da `resolveAgentAvatar`)
- Nome agente
- Dicitura "Agente Digitale TMWI"
- Link "📞 Chiamami" che punta all'agente vocale Robin (configurabile)

### 5. `src/data/agentTemplates.ts` — Knowledge Base di default per ruolo

Aggiungere export `AGENT_DEFAULT_KB` con entry iniziali per ruolo:
- **sales/outreach**: Regole di comunicazione, uso mission context, canali disponibili
- **account**: Parametri di controllo qualità, KPI da verificare
- **strategy**: Criteri di selezione contatti, priorità geografiche
- **research**: Procedure di deep search, fonti disponibili
- **download**: Stato sistema WCA, procedure di sync

## File modificati

| File | Cosa |
|------|------|
| `src/data/agentTemplates.ts` | `queue_outreach` nei tool, prompt potenziati, mappa voci default, KB default per ruolo |
| `src/components/agents/CreateAgentDialog.tsx` | Auto-assegnazione voce per genere, firma auto-generata, KB iniziale alla creazione |
| `src/components/agents/AgentSignatureConfig.tsx` | Firma default con avatar immagine + "Agente Digitale TMWI" + link chiamata Robin |

## Risultato

Ogni nuovo agente creato avrà immediatamente:
- Voce ElevenLabs corretta per il suo genere
- Firma professionale con avatar, titolo "Agente Digitale TMWI" e link chiamata
- Knowledge base operativa con i compiti specifici del ruolo
- Tool completi incluso `queue_outreach` per invio messaggi su tutti i canali
- Prompt dettagliato con flusso operativo chiaro (cockpit → mission context → comunicazione → invio)

Robin è designato come agente telefonico: il suo link chiamata vocale ElevenLabs apparirà nelle firme di tutti gli agenti venditori.

