
# Piano: Documenti Knowledge Base, Link di riferimento e LinkedIn nel Workspace

## Cosa cambia per l'utente

1. **Documenti Knowledge Base allegabili**: nella GoalBar compare una sezione per caricare documenti (PDF, DOCX, TXT) che l'AI legge per arricchire la generazione email. I file vengono salvati in un bucket storage dedicato e il loro contenuto testuale viene estratto ed incluso nel prompt.

2. **Link di riferimento**: possibilita di aggiungere URL a siti web da cui l'AI puo estrarre informazioni tramite Firecrawl (gia configurato). I link vengono scrappati al momento della generazione e il contenuto viene iniettato nel contesto.

3. **LinkedIn visibile nel Workspace**: nella barra info del partner (EmailCanvas) e nella lista contatti (ContactListPanel), vengono mostrati i link LinkedIn del contatto e dell'azienda se presenti in `partner_social_links`. Cliccabili con icona LinkedIn.

4. **Avviso LinkedIn non configurato**: se non esistono link LinkedIn per il contatto selezionato, viene mostrato un badge "LinkedIn non disponibile" con suggerimento di eseguire il Deep Search. Il sistema attuale gia cerca e salva i profili LinkedIn tramite la Edge Function `deep-search-partner` usando Firecrawl. Non esiste un "cookie LinkedIn" da configurare nel profilo -- la ricerca avviene tramite web search, non scraping autenticato.

---

## Dettagli tecnici

### 1. Nuovo bucket storage `workspace-docs`

Bucket pubblico per i documenti di knowledge base caricati dall'utente nel workspace.

### 2. Nuova tabella `workspace_documents`

| Colonna | Tipo | Note |
|---------|------|------|
| id | uuid | PK |
| file_name | text | Nome originale del file |
| file_url | text | URL nel bucket |
| file_size | integer | Dimensione in bytes |
| extracted_text | text | Testo estratto dal documento (nullable) |
| created_at | timestamptz | default now() |

RLS: `auth.uid() IS NOT NULL` per tutte le operazioni.

### 3. Modifiche alla GoalBar

Aggiungere sotto i due campi attuali una riga con:
- **Area documenti**: pulsante "Allega documenti" che apre un file picker. I file caricati compaiono come chip rimovibili. Upload nel bucket `workspace-docs`, insert in `workspace_documents`.
- **Area link di riferimento**: campo input per aggiungere URL. I link aggiunti compaiono come chip rimovibili. Salvati in stato locale (non persistiti, sono per la sessione corrente).

Props aggiuntive: `documents`, `onDocumentsChange`, `referenceLinks`, `onReferenceLinksChange`.

### 4. Modifiche a Workspace.tsx

Gestire stato per `documents: {id, file_name, file_url}[]` e `referenceLinks: string[]`. Passarli a GoalBar e a EmailCanvas (che li inoltra al generator).

### 5. Modifiche a useEmailGenerator.ts

Il hook accetta nuovi parametri opzionali: `document_ids: string[]` e `reference_urls: string[]` da passare alla Edge Function.

### 6. Modifiche alla Edge Function `generate-email`

- Accetta `document_ids` e `reference_urls` nel body
- Per i documenti: query `workspace_documents` per recuperare `extracted_text` e includerlo nel prompt sotto una sezione "DOCUMENTI DI RIFERIMENTO"
- Per i link: chiama Firecrawl (`https://api.firecrawl.dev/v1/scrape`) con `FIRECRAWL_API_KEY` per estrarre il markdown da ogni URL e includerlo nel prompt sotto "INFORMAZIONI DA LINK DI RIFERIMENTO" (max 2000 chars per link, max 3 link)
- Fetch `partner_social_links` per il partner corrente e includerli nel contesto (LinkedIn del contatto e dell'azienda)

### 7. Modifiche a ContactListPanel

Per ogni attivita nella lista, fetch dei social links del partner. Mostrare icona LinkedIn cliccabile se presente.

### 8. Modifiche a EmailCanvas

- Nella barra info del partner, mostrare link LinkedIn del contatto e dell'azienda (icone cliccabili)
- Se non ci sono link LinkedIn, mostrare badge grigio "LinkedIn: eseguire Deep Search"
- I link LinkedIn vengono caricati tramite query `partner_social_links` filtrata per `partner_id`

### 9. File modificati

| File | Azione |
|------|--------|
| Migrazione DB | Crea tabella `workspace_documents` + RLS + bucket `workspace-docs` |
| `src/components/workspace/GoalBar.tsx` | Aggiunge area documenti e link di riferimento |
| `src/pages/Workspace.tsx` | Gestisce stato documenti e link |
| `src/hooks/useEmailGenerator.ts` | Accetta document_ids e reference_urls |
| `supabase/functions/generate-email/index.ts` | Fetch documenti, scrape link, fetch social links LinkedIn |
| `src/components/workspace/EmailCanvas.tsx` | Mostra LinkedIn nella barra partner, passa docs/links al generator |
| `src/components/workspace/ContactListPanel.tsx` | Mostra icona LinkedIn se disponibile |

### 10. Nota su LinkedIn

Il sistema attuale NON usa un cookie di sessione LinkedIn (`li_at`) per lo scraping. La Deep Search trova i profili LinkedIn tramite ricerca web con Firecrawl e li salva in `partner_social_links`. Questo approccio non richiede configurazione aggiuntiva nel profilo utente. I link LinkedIn trovati vengono gia salvati e saranno ora visibili direttamente nel Workspace.
