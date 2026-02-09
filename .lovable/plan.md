
# Piano: KPI Visivi + Arricchimento Dati dal Sito Web del Partner

## Cosa faremo

### 1. Badge KPI nella testata della scheda partner (Agents)

Sotto il nome azienda, aggiungeremo una riga di **badge grandi e colorati** con le informazioni chiave per una valutazione rapida:

- **Anni WCA** - es. "22 anni" con icona calendario
- **Filiali** - es. "3 sedi" con icona edificio (numero di branch offices)
- **Paesi** - es. "2 paesi" con icona mappamondo (paesi distinti dalle filiali)
- **Rating** - stelline come gia presente
- **Gold Medallion** - badge dorato se presente
- **Certificazioni** - conteggio (es. "3 cert.")

Questi badge saranno visibili sia nella lista a sinistra (in versione compatta) che nel pannello dettaglio a destra (in versione grande).

### 2. Arricchimento dal sito web del partner (Firecrawl)

Creeremo una nuova Edge Function `enrich-partner-website` che:
- Prende il sito web del partner (campo `website` nel DB)
- Usa Firecrawl per fare scraping della homepage
- Usa l'AI (Gemini) per estrarre informazioni aggiuntive:
  - Fatturato (se menzionato)
  - Numero dipendenti
  - Flotta propria (mezzi di proprieta)
  - Magazzini propri (mq se indicato)
  - Anno di fondazione
  - Specializzazioni aggiuntive non presenti nel profilo WCA
- Salva queste informazioni in un nuovo campo `enrichment_data` (jsonb) nella tabella `partners`

### 3. Bottone "Arricchisci dati" nella scheda

Nel pannello dettaglio dell'agente, aggiungeremo un bottone che avvia lo scraping del sito web del partner e mostra i risultati trovati.

---

## Dettagli Tecnici

### Database
- Aggiungere colonna `enrichment_data` (jsonb, nullable) alla tabella `partners`
- Aggiungere colonna `enriched_at` (timestamp, nullable) per sapere quando e stato arricchito

### Nuova Edge Function: `enrich-partner-website`
- Input: `partnerId`
- Legge il partner dal DB, prende il `website`
- Chiama Firecrawl con formato `markdown` sulla homepage
- Passa il markdown a Gemini per estrarre dati strutturati (fatturato, dipendenti, flotta, magazzini, anno fondazione)
- Aggiorna il record partner con i dati trovati in `enrichment_data`

### UI - Pagina Agents (`src/pages/Agents.tsx`)
- **Header KPI row**: Riga di badge colorati sotto il nome azienda con:
  - Anni WCA (calcolato da `member_since`)
  - Numero filiali (da `branch_cities`)
  - Paesi coperti (paesi unici dalle filiali)
  - Numero certificazioni
  - Gold Medallion (se presente)
- **Sezione "Dati dal sito web"**: Card dedicata che mostra i dati arricchiti (fatturato, dipendenti, flotta, magazzini)
- **Bottone "Arricchisci dal sito"**: Disponibile solo se il partner ha un sito web, lancia lo scraping

### Lista laterale
- Aggiungere mini-badge con anni WCA e numero filiali per ogni partner nella lista a sinistra
