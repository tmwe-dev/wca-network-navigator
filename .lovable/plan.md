

# Piano: Pagina Test LinkedIn Search — 5 Contatti dal DB

## Contesto

I test non possono essere eseguiti via browser automation perché le estensioni Chrome (LinkedIn, Partner Connect) sono installate solo nel browser locale dell'utente. Serve una **pagina di test dedicata** che l'utente può aprire nel suo browser con le estensioni attive.

## Contatti selezionati dal DB

| # | Nome | Azienda | Email | Paese |
|---|------|---------|-------|-------|
| 1 | Henry Hui | Welton Shipping Co., Inc. | henry.hui@weltongroup.com | US |
| 2 | Mr. Sanjeev Kumar Pandey | Shoolin Shipping Services (India) | sanjeev@shoolin.in | India |
| 3 | Mr. Marcello Glass | Continental Freight Forwarding, Inc. | mglass@cff-inc.com | US |
| 4 | Mr. V. Nagarajan | La Freightlift Pvt. Ltd. | nagaraj@laflcargo.com | India |
| 5 | Mr. Vishal Saxena | Aeroship Logistics Pvt. Ltd. | vishal.saxena@aeroshipgroup.com | India |

## Implementazione

### Nuovo file: `src/pages/TestLinkedInSearch.tsx`

Pagina diagnostica che:
1. Mostra i 5 contatti con i loro dati
2. Pulsante **"Avvia Test"** → per ogni contatto:
   - Verifica disponibilità estensione LinkedIn (`liBridge.isAvailable`)
   - Verifica disponibilità Partner Connect (`fsBridge.isAvailable`)
   - Esegue `useSmartLinkedInSearch.search()` con i dati del contatto
   - Mostra in tempo reale: query tentate, risultati, confidence, URL trovata
   - Se URL trovata → tenta `liBridge.extractProfile(url)` per verificare lo scraping
3. Terminal-style log con colori (verde/rosso/giallo)
4. Risultato finale: tabella riepilogativa con ✅/❌ per ogni contatto

### Modifiche a `src/App.tsx`
Aggiungere route `/test-linkedin` → `TestLinkedInSearch`

### Dettagli tecnici
- Usa direttamente `useSmartLinkedInSearch`, `useLinkedInExtensionBridge`, `useFireScrapeExtensionBridge`
- Delay di 5s tra ogni contatto per evitare rate limiting
- Salva i risultati nel DB in `enrichment_data` tramite il meccanismo già integrato in SmartSearch
- Nessuna nuova dipendenza

### Flusso test
```text
1. Utente apre /test-linkedin nel browser con estensioni attive
2. Click "Avvia Test"
3. Per ogni contatto:
   a. Log: "🔍 Cercando Henry Hui @ Welton Shipping..."
   b. SmartSearch cascade: query 1 → query 2 → ...
   c. Log: "✅ Trovato: linkedin.com/in/henry-hui (confidence: 0.85)"
   d. Se trovato → extractProfile → mostra headline, about
   e. Log: "⏳ Attesa 5s..."
4. Tabella finale con riepilogo
```

