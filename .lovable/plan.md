

# Arricchimento Contesto Destinatario per Outreach AI

## Problema attuale

La Edge Function `generate-outreach` **NON cerca nulla su internet**. Non va su LinkedIn, non usa Google, non fa Deep Search. Riceve solo:
- Nome, azienda, paese, email del contatto (dati base dalla card)
- Le tue impostazioni AI (KB, tono, ruolo, ecc.)

Il modello AI (Gemini) **inventa** dettagli come "presentazione Finder" basandosi sulla sua conoscenza generale — è un'**allucinazione**. La regola "Non inventare informazioni" nel prompt non basta a prevenirlo.

## Soluzione: Iniettare dati reali dal database

Prima di chiamare l'AI, la Edge Function cercherà nel database i dati di arricchimento già disponibili sul destinatario (da Deep Search precedenti, profili WCA scaricati, ecc.) e li includerà nel prompt.

### Modifiche a `supabase/functions/generate-outreach/index.ts`

1. **Dopo aver ricevuto i parametri**, cercare nel DB:
   - `partners` → match per `company_name` → estrarre `enrichment_data`, `raw_profile_html`, `services`, `networks`, `company_alias`
   - `partner_contacts` → match per email o partner_id → estrarre ruolo, telefono, social
   - `imported_contacts` → match per email o company_name → estrarre `deep_search_data`, `notes`

2. **Costruire un blocco `INTELLIGENCE DESTINATARIO`** nel prompt con i dati trovati:
   - Servizi offerti, network condivisi, specializzazioni
   - Note dal Deep Search (se presente)
   - Snippet dal profilo WCA (se scaricato)
   - Social links trovati

3. **Aggiungere al `_debug`** un nuovo campo `recipient_intelligence` con:
   - `sources_checked`: quali tabelle sono state consultate
   - `data_found`: cosa è stato trovato (partner match, contact match, deep search data)
   - `enrichment_snippet`: preview del contesto iniettato nel prompt
   - `warning`: se nessun dato trovato → "Solo dati base, nessun arricchimento"

### Modifiche a `src/components/cockpit/AIDraftStudio.tsx` — Tab Sources

4. **Aggiungere sezione "Intelligence Destinatario"** nel tab Sources:
   - Icona Globe + lista delle fonti consultate (Partner DB, Contatti, Deep Search)
   - Badge verde/rosso per ogni fonte (trovato/non trovato)
   - Preview del contesto iniettato nel prompt (collapsible)
   - Warning visibile se l'AI ha lavorato senza dati reali

### Aggiornamento `src/hooks/useOutreachGenerator.ts`

5. Estendere l'interfaccia `OutreachDebug` con i nuovi campi intelligence

## Dettagli tecnici

La query nel DB sarà leggera (2-3 SELECT per ILIKE su company_name/email, già indicizzati). Non aggiunge latenza significativa. Il contesto destinatario viene troncato a ~2000 caratteri per non gonfiare i token.

```text
Flusso attuale:        Card → prompt generico → AI inventa
Flusso dopo fix:       Card → cerca in DB → prompt con dati reali → AI usa fatti verificati
```

## File coinvolti

| File | Modifica |
|------|----------|
| `supabase/functions/generate-outreach/index.ts` | Query DB + blocco intelligence + _debug esteso |
| `src/components/cockpit/AIDraftStudio.tsx` | Sezione Intelligence nel tab Sources |
| `src/hooks/useOutreachGenerator.ts` | Interfaccia OutreachDebug estesa |

