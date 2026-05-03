---
name: Trigger "leggi KB" / "KB"
description: Quando l'utente scrive "leggi KB" o "KB", l'agente DEVE rileggere la memoria interna Lovable (mem://index.md + entry rilevanti) prima di agire.
type: preference
---
L'utente usa "leggi KB" o semplicemente "KB" come shortcut per ordinare di consultare la memoria interna Lovable prima di rispondere o modificare codice.

**How to apply:**
1. Quando il messaggio contiene "leggi KB" o "KB" (case-insensitive, parola intera), prima di qualunque altra azione apri `mem://index.md` mentalmente (è già in contesto) e rileggi le memorie attinenti al task.
2. Applica le regole Core in cima all'index a TUTTE le modifiche di quel turno.
3. Conferma esplicitamente nel reply che KB è stata consultata.

**Why:** L'utente ha rilevato derive in cui l'agente ignorava regole già scritte (es. soft-delete, no edge AI diretta, editorial review). Il trigger forza un re-grounding sistematico.