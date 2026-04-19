
Update dati su tabella esistente → uso insert tool (UPDATE), non migration di schema.

Verifico prima lo stato attuale del record Luca per confermare id e schema colonne (`tools` jsonb, `kb_tags`?), poi eseguo l'UPDATE.

## Piano

1. SELECT corrente su agents WHERE name ILIKE 'luca%' AND is_active=true per vedere lo stato.
2. UPDATE con il nuovo prompt Director, name='Luca — Director', tools jsonb aggiornato.
3. Verifica finale.

Nota: il prompt richiesto contiene "PERMESSO e GOVERNANCE" come da check finale. Procedo in default mode.
