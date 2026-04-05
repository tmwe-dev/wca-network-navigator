

# Centro di Comando AI — Settings Unificati per Prompt, KB, Template e Deep Search

## Situazione attuale (frammentata)

| Risorsa | Dove si trova oggi |
|---------|-------------------|
| KB Aziendale + Sales KB | Settings → Generale → AIProfileSettings.tsx |
| Goal e Proposte | Settings → Contenuti → ContentManager.tsx |
| Tipi email (Oracolo) | OraclePanel.tsx (salvati in `app_settings.email_oracle_types`) |
| Template email | Tabella `email_templates` (gestiti in TemplateManager) |
| Deep Search config | Nessuna UI — hardcoded nelle edge functions |
| Prompt degli agenti | Pagina Agenti → AgentPromptEditor.tsx |

Il problema: **tutto è sparso in 5+ posti diversi**. L'utente non ha un punto di controllo unico.

## Soluzione: nuova tab "AI & Prompt" nei Settings

Una **singola pagina** in Settings con **4 tab orizzontali** in alto:

```text
┌─────────────────────────────────────────────────────┐
│ 🧠 AI & Prompt                                      │
├──────┬──────────┬───────────┬───────────────────────┤
│Prompt│ KB       │ Template  │ Deep Search           │
├──────┴──────────┴───────────┴───────────────────────┤
│                                                      │
│  [Contenuto della tab attiva]                        │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Tab 1: Prompt (Tipi Email + Goal + Proposte)
- **Unifica** i DEFAULT_EMAIL_TYPES (Oracolo), i Goal e le Proposte (ContentManager) in un'unica griglia
- Ogni card mostra: icona, nome, categoria (badge colorato), tono, anteprima prompt (troncato)
- Click → Dialog di modifica con: nome, icona (emoji picker), categoria, tono, prompt completo
- Pulsante **"Migliora con AI"** dentro il dialog: invia il prompt alla funzione `improve-email` per raffinarlo
- Pulsante **"+ Crea nuovo"** in alto con auto-categorizzazione AI (edge function `categorize-content` già esistente)
- Toast informativo in alto che mostra il conteggio: "12 prompt attivi · 6 goal · 4 proposte"

### Tab 2: Knowledge Base
- Due sezioni espandibili con contatore caratteri:
  - **KB Aziendale** (`ai_knowledge_base`) — chi siamo, servizi, certificazioni
  - **KB Vendite / SKB** (`ai_sales_knowledge_base`) — tecniche Chris Voss, regole strategiche
- Pulsante **"Reset default SKB"** per ripristinare la Sales KB dal file `salesKnowledgeBase.ts`
- Pulsante **"Migliora con AI"** per ciascuna sezione: invia il contenuto a un prompt che suggerisce miglioramenti
- Indicatore visivo: "Utilizzata da: Cockpit, Email Composer, Agenti"

### Tab 3: Template
- Riutilizza il `TemplateManager` già esistente (upload file .html/.eml)
- Aggiunge preview inline cliccando sulla card

### Tab 4: Deep Search
- Configurazione delle **opzioni di deep search per contesto**:
  - Checkbox per ciascuna operazione: Scrape sito web, Scrape LinkedIn, Verifica WhatsApp, Analisi AI profilo
  - Preset per contesto: Email Composer, Cockpit, Contatti, BCA
  - Ogni contesto può avere opzioni diverse salvate in `app_settings` (key: `deep_search_config`)
- Mostra stato dell'estensione Partner Connect (collegata/non collegata)

## Logica Email Composer — Verifica email manuale

Quando l'utente inserisce una mail manuale nell'Email Composer:
1. **Ricerca automatica nel DB**: query su `partners.email`, `partner_contacts.email`, `imported_contacts.email`, `business_cards.email`
2. Se trovato → popola automaticamente nome contatto, azienda, alias, bandiera paese
3. Se **non trovato** → quando clicca "Genera con Oracolo", mostra un **mini-dialog** che chiede:
   - Nome contatto (obbligatorio)
   - Nome azienda (obbligatorio)
   - Questi dati vengono passati all'edge function per personalizzare la mail

## Allineamento Oracolo ↔ Settings

L'OraclePanel nell'Email Composer **legge** i tipi email dalla stessa sorgente unificata (`app_settings.email_oracle_types` + `DEFAULT_EMAIL_TYPES`). La modifica avviene nella nuova pagina Settings, l'Oracolo è solo un selettore rapido.

Il link "Gestisci KB" nell'Oracolo → **naviga direttamente** alla tab KB della nuova pagina Settings (oppure apre la stessa dialog attuale come shortcut).

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/settings/AICommandCenter.tsx` | **Nuovo** — Componente principale con 4 tab |
| `src/components/settings/PromptManager.tsx` | **Nuovo** — Griglia unificata prompt/goal/proposte/tipi email |
| `src/components/settings/KnowledgeBaseManager.tsx` | **Nuovo** — Editor KB con AI improve |
| `src/components/settings/DeepSearchConfig.tsx` | **Nuovo** — Config deep search per contesto |
| `src/pages/Settings.tsx` | Aggiungere tab "AI & Prompt" con icona Brain, rimuovere tab "Contenuti" separata |
| `src/pages/EmailComposer.tsx` | Aggiungere lookup email nel DB + mini-dialog info mancanti |
| `src/components/email/OraclePanel.tsx` | Rimuovere dialog KB inline, linkare a Settings |
| `src/data/defaultEmailTypes.ts` | Nessuna modifica (resta sorgente default) |

## Ordine di implementazione

1. Creare `AICommandCenter` con le 4 tab e i sotto-componenti
2. Integrare in Settings.tsx al posto di "Contenuti"
3. Aggiornare EmailComposer con lookup email + mini-dialog
4. Aggiornare OraclePanel per linkare alla nuova pagina

