
Verifico prima se le 2 KB entries esistono già (per evitare duplicati), poi le inserisco se mancanti.

## Schema kb_entries (da `KbEntryRowSchema`)
Colonne richieste: `title, content, category, chapter, tags, priority, sort_order, is_active, user_id`.
La query proposta dall'utente NON include `chapter` e `sort_order` — sono NOT NULL nello schema, quindi vanno aggiunti.

## Piano

1. **Verifica pre-insert** (SELECT) — controllo se esistono già righe con tag `agent_prompt_guide`. Se esistono, skip o update.
2. **Insert tool** (non migration — è data, non schema):
   - Riga 1: `Guida Strutturale — Prompt Agenti Vocali ElevenLabs`, category `system_doctrine`, chapter `Voice Agents`, priority 80, sort_order 0
   - Riga 2: `Regola — Obbligo Guida per Prompt Vocali`, category `system_doctrine`, chapter `Voice Agents`, priority 95, sort_order 1
   - `user_id = NULL` (KB globale)
   - `tags` come array Postgres
3. **Verifica post-insert**: `SELECT title FROM kb_entries WHERE 'agent_prompt_guide' = ANY(tags) AND is_active = true` → atteso 2 righe.

Nota: l'utente ha richiesto "migration" ma per INSERT di dati va usato l'insert tool (regola progetto: migrations solo per cambi schema).

Procedo in default mode.
