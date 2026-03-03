## Piano Import Intelligente v3 — COMPLETATO

### Modifiche effettuate

#### 1. Edge function `analyze-import-structure` — Prompt riscritto da zero
- **Eliminato** tutto l'handcode (regole tipo "name_2 → company_name", "cell → mobile")
- **Aggiunto** contesto completo: chi siamo (CRM spedizionieri), cosa facciamo (rubrica contatti per email/telefono/WhatsApp), perché
- **Schema** della tabella `imported_contacts` con descrizioni chiare di ogni campo
- **Istruzioni** di ragionamento: l'AI deve guardare i VALORI nelle righe per dedurre il tipo di dato (città, email, telefono, nome azienda, ecc.)
- **Nessuna regola hardcoded**: l'AI ragiona autonomamente sul contesto

#### 2. Frontend `Import.tsx` — Semplificato
- **Rimosso** il fallback `hasParsedRows` che usava `parsed_rows` direttamente
- Il sistema ora usa **SOLO** `column_mapping` per trasformare i dati
- Se `column_mapping` è vuoto → errore chiaro, nessun workaround
- Messaggi toast più chiari sulla presenza/assenza del mapping
