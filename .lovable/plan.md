

# Piano: Miglioramento Home Page + Architettura Agenti AI

## Analisi del Problema Attuale

La home page (SuperHome3D) e' un carosello di "mondi" senza campo di input AI ne microfono. L'utente non capisce dove interagire con l'intelligenza artificiale. Il prompt e il microfono esistono solo in due posti separati:
1. **AiAssistantDialog** (pannello laterale, aperto dal bottone Bot nell'header -- ma l'header e' nascosto nella home)
2. **IntelliFlowOverlay** (overlay full-screen, aperto dal bottone Sparkles flottante in basso a destra)

## Architettura Agenti AI Esistente

### Dove si trovano i prompt e i compiti degli agenti

| Agente / Funzione | File Backend | Prompt di Sistema |
|---|---|---|
| **Segretario Operativo** (agente principale) | `supabase/functions/ai-assistant/index.ts` (1574 righe) | Riga 19-128: prompt completo con ruolo, memoria, piani, tool di scrittura, azioni UI |
| **Cockpit Assistant** (outreach) | `supabase/functions/cockpit-assistant/index.ts` | Riga 9-51: comandi strutturati per filtro, selezione, bulk actions nel cockpit |
| **Contacts Assistant** | `supabase/functions/contacts-assistant/index.ts` | Gestisce filtri, ordinamento, selezione contatti, export CSV |
| **Import Assistant** | `supabase/functions/import-assistant/index.ts` | Analisi struttura file, mapping colonne |

### Tool disponibili nel Segretario Operativo (ai-assistant)

**Lettura:** search_partners, get_country_overview, get_directory_status, list_jobs, get_partner_detail, get_global_summary, check_blacklist, list_reminders, get_partners_without_contacts, search_business_cards

**Scrittura:** update_partner, add_partner_note, create_reminder, update_lead_status, bulk_update_partners, create_download_job

**Memoria & Piani:** save_memory, search_memory, create_work_plan, execute_plan_step, get_active_plans, save_as_template, search_templates

**UI:** execute_ui_action (navigate, show_toast, apply_filters, open_dialog)

### I 7 "Agenti" di IntelliFlow (solo demo visiva)

IntelliFlowOverlay mostra 7 agenti (`agentDots`) ma sono **puramente decorativi** -- non corrispondono a backend reali separati. Sono: Orchestratore, CRM Core, Data Analyst, Communication, Voice, Automation, Governance.

---

## Piano di Implementazione

### 1. Aggiungere Prompt AI + Microfono nella Home Page

Trasformare la parte inferiore della home (SuperHome3D) da semplici dots di navigazione a un **campo prompt dominante** con microfono, integrato con il Segretario Operativo reale (`ai-assistant`).

**Cosa cambia in `SuperHome3D.tsx`:**
- Aggiungere un input bar glassmorphism sotto il carosello con: icona Mic, campo testo "Chiedi al sistema...", pulsante Send
- Il microfono usa Web Speech API (gia implementata in AiAssistantDialog)
- I messaggi vanno all'edge function `ai-assistant` con streaming
- Le risposte appaiono in un pannello semi-trasparente che si sovrappone elegantemente al contenuto
- I quick prompts del carosello diventano suggerimenti contestuali sotto il campo

### 2. Rendere il campo AI visibile e accessibile ovunque

- Nella home: prompt centrale dominante (il cambiamento principale)
- Nelle altre pagine: l'header gia ha il bottone Bot -- ma aggiungeremo anche un **shortcut tastiera** (es. `/` o `Ctrl+J`) per aprire rapidamente l'assistente

### 3. Migliorare la responsiveness della Home

- KPI strip: `grid-cols-4` su desktop, `grid-cols-2` su tablet, `grid-cols-2` su mobile con dimensioni ridotte
- Carosello: ridurre dimensioni card e offset su schermi piccoli
- Campo prompt: full-width su mobile

### 4. File da modificare

| File | Modifica |
|---|---|
| `src/pages/SuperHome3D.tsx` | Aggiungere AI prompt bar con mic, streaming, risposte inline. Ridurre la dot navigation. Responsive KPI. |
| `src/components/layout/AppLayout.tsx` | Aggiungere shortcut tastiera `/` o `Ctrl+J` per aprire AI assistant da qualsiasi pagina |

### Note Tecniche

- Il campo prompt nella home riutilizza la stessa logica di `AiAssistantDialog` (fetch a `ai-assistant`, streaming SSE, TTS opzionale)
- Non viene creato nessun nuovo backend -- si riusa `ai-assistant` che e' gia il piu completo
- IntelliFlow resta come overlay separato per i flow demo avanzati (approvazione, esecuzione, canvas)
- I prompt degli agenti si trovano e si modificano direttamente nei file delle edge functions elencati sopra

