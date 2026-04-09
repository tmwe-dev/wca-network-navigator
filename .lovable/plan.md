

# Piano: Allineare tutti gli assistenti AI alla piena conoscenza e potere del sistema

## Situazione attuale

Ho analizzato tutti gli agenti AI della piattaforma. Ecco lo stato:

| Agente | Tool disponibili | Accesso DB | Lacune |
|---|---|---|---|
| `ai-assistant` (Segretario) | 48+ tool completi | ✅ Pieno | Nessuna — è il riferimento |
| `agent-execute` (agenti autonomi) | 50+ tool da `toolDefs.ts` | ✅ Pieno | Dipende da `assigned_tools` nel DB — se non popolato, agente cieco |
| `contacts-assistant` | 4 tool (solo contatti) | ⚠️ Solo imported_contacts | **Manca**: partner, outreach, memoria, attività, directory |
| `cockpit-assistant` | **0 tool** | ❌ Nessuno | Non può interrogare il DB — genera JSON alla cieca |
| `import-assistant` | 5 tool (solo import) | ⚠️ Solo import_logs | **Manca**: tutto il resto |
| `extension-brain` | **0 tool** | ❌ Nessuno | Semplice pass-through senza capacità operative |

## Cosa farò

### 1. `contacts-assistant` — Aggiungere tool completi
Importerà i tool dal set completo dell'`ai-assistant`: partner, outreach, memoria, attività, directory, business cards. Aggiungerà anche i handler corrispondenti per eseguirli.

### 2. `cockpit-assistant` — Aggiungere tool e accesso DB
Attualmente è "cieco" — riceve una lista contatti dal frontend e genera JSON. Lo potenzierò con:
- Connessione Supabase per query dirette
- Tool per cercare partner, contatti, holding pattern, inbox
- Capacità di generare outreach con dati reali dal DB

### 3. `import-assistant` — Estendere con tool cross-modulo
Aggiungerò tool per cercare partner (per matching), contatti CRM, memoria persistente e attività — così può collegare gli import al resto della piattaforma.

### 4. `extension-brain` — Aggiungere tool operativi
Attualmente è un semplice relay. Lo potenzierò con il set completo di tool per renderlo capace di operare sulla piattaforma quando chiamato dall'estensione browser.

### 5. Verifica `assigned_tools` degli agenti autonomi
Controllerò nel DB che tutti gli agenti abbiano il set completo di `ALL_OPERATIONAL_TOOLS` assegnato. Se qualcuno ha la lista vuota o incompleta, la aggiornerò.

## Approccio tecnico

Per evitare duplicazione di codice (attualmente ogni assistente ha i propri tool e handler inline), estrarrò i tool condivisi in un modulo `_shared/`:

- **`supabase/functions/_shared/commonTools.ts`** — Definizioni tool riutilizzabili
- **`supabase/functions/_shared/commonHandlers.ts`** — Handler esecuzione condivisi

Ogni assistente importerà da questo modulo condiviso e aggiungerà i propri tool specifici.

## File coinvolti

| File | Modifica |
|---|---|
| `supabase/functions/_shared/commonTools.ts` | **Nuovo** — Tool definitions condivise |
| `supabase/functions/_shared/commonHandlers.ts` | **Nuovo** — Handler condivisi |
| `supabase/functions/contacts-assistant/index.ts` | Importa tool completi dal modulo condiviso |
| `supabase/functions/cockpit-assistant/index.ts` | Aggiunge Supabase client + tool + handler |
| `supabase/functions/import-assistant/index.ts` | Aggiunge tool cross-modulo |
| `supabase/functions/extension-brain/index.ts` | Aggiunge tool operativi completi |

## Risultato
Ogni assistente AI, ovunque si trovi nella piattaforma, avrà:
- Accesso diretto al database
- Capacità di cercare partner, contatti, prospect
- Capacità di creare attività, reminder, note
- Memoria persistente
- Generazione outreach
- Visibilità su inbox, holding pattern, conversazioni
- Azioni UI (navigazione, toast, filtri)

