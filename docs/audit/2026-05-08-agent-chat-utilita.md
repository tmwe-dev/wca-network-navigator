# Audit: Utilità della Chat Agenti (AgentChatHub)
Data: 2026-05-08

## Stato attuale
- Pagina `/v2/agents` (AgentChatHubPage) usa `agent-execute` per chat 1:1 con un agente.
- Sovrapposizioni: Command Page (super-mario / unified-assistant), Floating Copilot, Finder API.

## Domande aperte
- Quante conversazioni reali in `ai_interaction_log` ultimi 30gg? (da misurare)
- Quante producono tool call vs solo testo?
- Cosa fa che Command non fa? (persona forte, scope ristretto)

## Tre opzioni
1. **Mantieni come laboratorio per-agente** — utile per testare singolo agente in dialogo.
2. **Fondi in Command** con selettore "parla come <agente>" — meno pagine, stesso valore.
3. **Converti in form-task strutturato** — niente chat libera, solo task con esiti misurabili.

## Raccomandazione preliminare
Opzione 2: la chat libera è ridondante con Command + AI Test Hub. La persona dell'agente può essere passata come parametro a Command. Decisione finale dopo metriche reali.
