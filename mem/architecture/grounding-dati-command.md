---
name: Grounding dati Command (find_anything, inspect_field, KB schema)
description: Come il Command trova dati senza conoscere il nome esatto del campo; RPC ai_find_anything / ai_field_values, KB data-schema, conteggio parziale dichiarato
type: feature
---

# Grounding dati — Command

L'agente non deve conoscere a memoria i nomi dei campi.

## RPC (SECURITY DEFINER, solo authenticated/service_role)
- `ai_find_anything(p_query, p_limit)` — cerca un testo su partners, partner_contacts, imported_contacts, business_cards, prospects, prospect_contacts; restituisce tabella, id, label, `matched_on`, dettaglio, `partial`.
- `ai_field_values(p_table, p_column, p_limit, p_filter)` — valori reali di una colonna: total/non_null/null_count/distinct/top_values + `diagnosis` (dato assente vs filtro sbagliato). Allowlist tabelle, blocco campi sensibili.
- `ai_sync_schema_kb()` — rigenera la voce KB `data-schema/db-fields` dallo schema reale.
- `ai_introspect_schema(table_names)` — colonne + enum live (preesistente).

## Tool agente (`ai-assistant`)
`find_anything`, `inspect_field`, `describe_tables` in `toolExecutors/schemaTools.ts`.

## KB
- `data-schema/db-fields` — campi di tutte le tabelle operative + sinonimi utente→campo (auto-generata).
- `data-schema/app-map` — pagine, scopo, campi, funzioni, scorciatoie operative.

## Regole prompt (systemPrompt.ts)
- PROTOCOLLO RICERCA DATI: mai dire "non c'è" senza find_anything + inspect_field.
- CONTEGGIO PARZIALE DICHIARATO: sempre "mostrati N su M", mai spacciare un elenco troncato per completo.

## Fallback client
`src/v2/ui/pages/command/lib/crossEntityFallback.ts`: se tutti i QueryPlan tornano 0 righe, il Command rilancia il termine su `ai_find_anything` e mostra i match trasversali.

## Nota test
Le edge function rifiutano l'origine `http://localhost:8080` (CORS allowlist = domini preview/published): i test Playwright in sandbox mostrano "servizio occupato", non è un bug dell'app.
