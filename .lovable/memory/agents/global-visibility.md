---
name: Visibilità Globale Agenti
description: Tutti gli operatori autenticati vedono tutti gli agenti del sistema; nessun isolamento per user_id/operator_id su SELECT
type: feature
---
Tutti gli operatori autenticati vedono TUTTI gli agenti del sistema (nessun isolamento per `user_id` né per `operator_id` in lettura).

**Implementazione:**
- `findAgents()` in `src/data/agents.ts` non filtra più per `user_id` (parametro ignorato, mantenuto per retrocompat).
- `useAgents()` in `src/hooks/useAgents.ts` non chiama `getUser()` per filtrare.
- Policy RLS su `agents`: `agents_select_all_authenticated` con `USING (true)` per ruolo `authenticated`.

**Write/Delete restano protetti:** solo proprietario o admin tramite `agents_update_own` / `agents_delete_own` basate su `get_effective_operator_ids()`.

**Why:** Lo staff è una squadra condivisa — Luca, Marco, Gianfranco, Imane, Gigi, Felice, Robin, Bruce, Renato, Carlo, Leonardo devono essere accessibili a chiunque acceda al CRM, indipendentemente da chi li ha creati.
