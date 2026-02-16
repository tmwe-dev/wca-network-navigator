

# Risultati Strutturati dall'Assistente AI

## Problema attuale

L'AI puo' gia' filtrare partner per paese, servizio, certificazione, rating e altro. Tuttavia, i risultati vengono presentati come tabelle markdown nel fumetto della chat — non sono cliccabili, non mostrano dettagli e non permettono azioni.

Quando chiedi "Mostrami i partner IATA in Germania senza email", l'AI ti restituisce una tabella di testo. Quello che vorresti e' una lista strutturata, navigabile, con le stesse card e dettagli che vedi nel PartnerListPanel.

## Soluzione

Estendere il protocollo di comunicazione tra backend e frontend per supportare **blocchi strutturati** nelle risposte dell'AI. Quando l'AI trova dei partner, oltre al testo esplicativo, il backend invia un blocco JSON con i dati strutturati. Il frontend lo intercetta e lo presenta in un pannello dedicato sotto la chat, con card partner cliccabili.

## Come funziona

1. L'AI riceve la domanda, usa i tool per interrogare il database
2. Nella risposta testuale, il backend inserisce un marcatore speciale con i dati strutturati (es. lista partner con id, nome, citta', email, rating)
3. Il frontend del `AiAssistantDialog` intercetta il marcatore e renderizza i risultati in un pannello separato sotto il messaggio
4. Ogni partner nella lista e' cliccabile e mostra un mini-dettaglio (email, telefono, rating, servizi)

## Cosa cambia nella UI

Il dialog `AiAssistantDialog` viene arricchito con:

- Un componente `AiResultCard` che renderizza singoli partner come card compatte (nome, citta', paese, email, rating con stelline, badge servizi)
- Un componente `AiResultsPanel` che contiene la lista scrollabile di card, mostrata sotto il messaggio dell'AI che ha prodotto i risultati
- Un contatore in alto ("12 partner trovati") con possibilita' di espandere/collassare la lista
- Click su una card apre il dettaglio completo (riusa la logica gia' presente in PartnerListPanel)

## Dettaglio tecnico

### Protocollo backend

Nella edge function `ai-assistant`, dopo che l'AI formula la risposta con tool calling, il backend controlla se l'ultimo tool chiamato ha restituito una lista di partner. In quel caso, aggiunge alla risposta un blocco con un delimitatore riconoscibile:

Il formato e' un marcatore di tipo `---STRUCTURED_DATA---` seguito da JSON, che il frontend separa dal testo markdown.

### Modifiche alla edge function

Il file `supabase/functions/ai-assistant/index.ts` viene modificato per:

- Tracciare l'ultimo risultato dei tool call (se contiene una lista `partners`)
- Appendere il blocco strutturato alla risposta finale dell'AI
- Includere nel JSON: id, company_name, city, country_code, country_name, email, phone, rating, has_profile, is_favorite, office_type, wca_id, services (array), certifications (array)

### Modifiche al componente frontend

Il file `src/components/operations/AiAssistantDialog.tsx` viene modificato per:

- Parsare i messaggi dell'assistente cercando il delimitatore strutturato
- Separare il testo dal JSON
- Renderizzare il testo con ReactMarkdown come prima
- Sotto il testo, mostrare un `AiResultsPanel` con le card dei partner trovati
- Ogni card mostra: bandiera paese, nome azienda, citta', email (se presente), rating (stelline), badge per servizi principali, icona se e' preferito
- Click su una card espande un mini-dettaglio inline con tutti i contatti, telefoni, sito web
- Pulsante "Vedi nel Partner Hub" che naviga al partner nella vista principale

### Nuovo componente: AiResultsPanel

Creato in `src/components/operations/AiResultsPanel.tsx`:

- Riceve un array di partner strutturati
- Li renderizza come card compatte in una griglia scrollabile
- Supporta il tema chiaro/scuro tramite ThemeCtx
- Ogni card ha hover state e click per espandere
- Header con conteggio e toggle espandi/comprimi

### File coinvolti

| File | Azione |
|---|---|
| `supabase/functions/ai-assistant/index.ts` | Modificato: aggiunge blocco strutturato alla risposta |
| `src/components/operations/AiAssistantDialog.tsx` | Modificato: parsing strutturato e rendering pannello risultati |
| `src/components/operations/AiResultsPanel.tsx` | Nuovo: componente per visualizzare lista partner strutturata |

## Esempio di utilizzo

L'utente chiede: "Filtra i partner di Argentina, Australia e Canada che hanno certificazione IATA"

L'AI risponde con:
- Testo: "Ho trovato 8 partner con certificazione IATA nei 3 paesi selezionati. Ecco il dettaglio..."
- Sotto: pannello con 8 card partner, ognuna con nome, citta', rating, email, cliccabili per espandere i dettagli

L'utente puo' poi chiedere: "Di questi, quali non hanno email?" e l'AI raffina la ricerca mostrando un nuovo pannello aggiornato.

