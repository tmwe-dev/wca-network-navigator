---
name: Snapshot agenti esistenti in DB
description: Lista degli agenti attualmente attivi nella tabella agents. Letta dall'Harmonizer durante il chunk Agenti Doer per evitare INSERT duplicati e per orientare gli UPDATE.
tags: [harmonizer, agents, snapshot, existing]
---

# Agenti esistenti (snapshot DB)

**IMPORTANTE**: Prima di proporre un INSERT su `agents`, verifica se l'agente
è già qui. Se sì, proponi UPDATE (su `name`, `role`, `system_prompt`,
`territory_codes`, ecc.) anziché creare duplicati.

I nomi sono **case-insensitive** per il match (es. "marco" = "Marco").
Quando esistono due agenti con lo stesso nome ma `role` diversi (es. due
"Marco": uno `outreach` e uno `strategy`), sono entità distinte.

## Tabella agenti attivi

| name | role | id (esistente) | scope sintetico |
|---|---|---|---|
| Bruce | sales | 58f068ef-bf4d-485e-ae5d-4b397e9d27d9 | Sales Closer / negoziazione contratti |
| Carlo | outreach | 81e27dbc-fcf2-470e-b70c-b30aade2ae01 | Outreach Asia + Middle East |
| felice | download | 88162cf9-58bf-4873-befd-414dcc757a5a | Download Controller WCA |
| gianfranco | account | c81a94be-cccc-4fe9-8882-8d37b5db3010 | Account Manager / re-engagement |
| gigi | research | 41c41695-867d-479c-9337-400116a8fce8 | Research Operative / enrichment |
| imane | research | fa5883ca-2ede-497d-8e28-615991719bec | Research Analyst / market intel |
| Leonardo | outreach | ab892bec-ce6a-4511-869d-7be8af5b4c89 | Outreach Americhe + Africa |
| Luca — Director | Director | 6a0d0e0d-7a20-49f4-bd54-3caa3691dcd3 | Director / governance |
| marco | strategy | 7dcd4d6f-2921-4bd1-8c5f-1e3d4e5a242f | Chief Strategy Officer |
| Marco | outreach | d3e97574-ba71-4351-8f52-028cbd10065a | Outreach Specialist multicanale |
| Renato | outreach | e7831d0e-534c-4577-85aa-027e200c821a | Outreach Europa |
| Robin | sales | d2bf4257-a8a5-4d32-a987-b14764d166a0 | Sales Hunter / qualificazione |
| Sara | sales | d6c8037b-8309-405f-adce-be826b7d474a | Sales Closer (Marco/Robin → converted) |

## Regole di matching

1. **Stesso nome (case-insensitive) + stesso role** → UPDATE sull'id esistente, mai INSERT.
2. **Stesso nome ma role diverso** → entità distinte: valuta se la libreria
   sorgente li distingue davvero o se è una collisione casuale. In dubbio
   apri un ConflictEntry, non creare un terzo "Marco".
3. **Nome non in tabella** → INSERT legittimo, ma assicurati di:
   - includere `agent_persona` come proposta separata con `dependencies`
   - usare un `role` esistente (vedi 40-agents-schema.md enum convention).

## Anti-pattern

- ❌ INSERT di "Bruce" perché la libreria lo descrive: già esiste, fai UPDATE.
- ❌ INSERT di "Director" o "Strategy Officer" come ruolo: usa un agente
  esistente e aggiorna il suo `system_prompt`.
- ❌ DELETE di un agente esistente: vietato dal policy hard. Se va "spento"
  → UPDATE `is_active = false`.