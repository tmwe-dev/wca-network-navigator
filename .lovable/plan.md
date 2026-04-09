

# Piano: Salvataggio documenti + Implementazione test e miglioramenti secondo il Metodo

## Documenti letti e compresi

Ho letto entrambi i volumi integralmente:

- **Volume I -- Il Protocollo del Recupero**: 13 capitoli, 7 leggi non negoziabili, 10 fasi operative (dalla Fase 0 Fotografia alla Fase 10 Hardening)
- **Volume II -- Il Metodo Enterprise**: 17 capitoli, 13 fasi (dalla Fase Zero Validazione alla Fase Tredici Go to Market), 5 criteri dello standard enterprise

I documenti sono gia presenti nel repo in `docs/metodo/`. Li aggiorneremo con le versioni appena caricate.

## Stato attuale del progetto rispetto al Metodo

Dall'audit (voto 4.150/10.000), il progetto e nella **Fase 0-1 del Vol. I**:
- 32 file di test esistenti in `src/test/`, ma copertura sotto l'1%
- 1.384 `any` espliciti, 59 catch vuoti, 55 deps mancanti negli hooks
- Zero test sulle edge function
- Zero test E2E operativi
- `tsconfig` con strict mode disabilitato

## Cosa faro (rispettando le 7 Leggi del Recupero)

### Legge 1: Non aggiungo funzionalita -- solo test e stabilizzazione
### Legge 3: Ogni modifica verificabile in isolamento
### Legge 4: Un flusso alla volta
### Legge 7: Documentazione di ogni intervento

---

### Step 1: Salvare i documenti aggiornati nel repo
Copiare i `.docx` in `docs/metodo/` per avere la fonte di verita sempre accessibile.

### Step 2: Test unitari per i moduli condivisi critici
Seguendo Vol. II Cap. IV (fondazioni) e Vol. I Fase 5 (guardrails):

| Test file | Modulo testato | Cosa verifica |
|---|---|---|
| `src/test/platformTools.test.ts` | `_shared/platformTools.ts` | Tool definitions complete, nomi unici, parametri validi |
| `src/test/invokeEdge.test.ts` | Gia esistente -- estendere | Copertura errori 401/403/404/422/429/500 |
| `src/test/apiError.test.ts` | Gia esistente -- verificare | Error codes, serializzazione |

### Step 3: Test delle Edge Function con Deno test runner
Seguendo Vol. I Fase 5 (guardrails) e Vol. II §4.6 (framework di test):

| Test file | Edge Function | Cosa verifica |
|---|---|---|
| `supabase/functions/_shared/platformTools_test.ts` | platformTools | Tool definitions integrity, handler routing |
| `supabase/functions/check-inbox/index_test.ts` | check-inbox | Auth flow con getClaims, risposta CORS |
| `supabase/functions/contacts-assistant/index_test.ts` | contacts-assistant | Import platformTools, CORS, system prompt presente |

### Step 4: Validazione integrita del sistema degli agenti
Seguendo Vol. I Fase 2 (radiografia):
- Verificare che tutti e 4 gli assistenti (contacts, cockpit, import, extension-brain) importino correttamente `PLATFORM_TOOLS` e `executePlatformTool`
- Verificare che i tool names siano univoci (nessun duplicato)
- Verificare che ogni handler in `executePlatformTool` abbia un case corrispondente

### Step 5: Aggiornare la documentazione del Metodo
Seguendo Vol. I Legge 7 (documentazione obbligatoria):
- Aggiornare `docs/metodo/README.md` con lo stato attuale post-interventi
- Documentare i test aggiunti e la copertura raggiunta

---

## Regole operative che seguiro (estratte dai documenti)

1. **Singolo obiettivo per interazione** (Vol. II §7.3): ogni file di test ha uno scopo preciso
2. **Input/output verificabili** (Vol. II §7.4): ogni test ha assertion chiare
3. **Nessun refactor globale** (Vol. I Legge 2): testo solo, non riscrivo
4. **AI esegue, non decide** (Vol. I Legge 6): seguo il piano approvato dall'umano
5. **Validazione degli input** (Vol. I §7.2): i test verificano anche input invalidi

## File coinvolti

| File | Azione |
|---|---|
| `docs/metodo/Volume_I_Il_Protocollo_del_Recupero.docx` | Aggiornamento |
| `docs/metodo/Volume_II_Il_Metodo_Enterprise.docx` | Aggiornamento |
| `supabase/functions/_shared/platformTools_test.ts` | Nuovo |
| `supabase/functions/check-inbox/index_test.ts` | Nuovo |
| `src/test/platformTools-integrity.test.ts` | Nuovo |
| `docs/metodo/README.md` | Aggiornamento stato |

