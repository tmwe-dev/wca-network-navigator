

# Fix: Rilevamento "Member not found" nel parser WCA

## Problema

Il sito WCA, quando un profilo non esiste o e scaduto, restituisce una pagina HTTP 200 con il testo "Member not found. Please try again." invece di un vero errore 404.

Il parser attuale (riga 25 di `scrape-wca-partners`) cerca solo:
- `page not found`
- `404`
- `no results found`

Non riconosce "Member not found", quindi lo tratta come un profilo valido e salva "Member not found. Please try again." come nome dell'azienda.

## Soluzione

### File: `supabase/functions/scrape-wca-partners/index.ts`

1. **Aggiungere "member not found" alla regex di rilevamento 404** (riga 25):
   - Aggiungere il pattern `member\s*not\s*found` alla regex esistente
   - Rimuovere il vincolo `content.length < 2000` perche il messaggio potrebbe essere dentro una pagina piu lunga con navigazione

2. **Aggiungere un controllo aggiuntivo sul company_name** (dopo riga 40):
   - Se il `company_name` estratto contiene "not found" o "try again", trattarlo come profilo non trovato
   - Questo e un fallback di sicurezza nel caso la regex principale non intercetti varianti del messaggio

### Dettaglio tecnico

Riga 25 attuale:
```
if (/page\s*(not|was not)\s*found|404|no\s*results?\s*found/i.test(content) && content.length < 2000) {
```

Diventa:
```
if (/page\s*(not|was not)\s*found|member\s*not\s*found|404|no\s*results?\s*found/i.test(content)) {
```

Dopo riga 40, aggiungere:
```
if (/not\s*found|try\s*again/i.test(companyName)) return null
```

Nessuna modifica al database o ad altri file.

