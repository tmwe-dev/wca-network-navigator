

# Fix: Login Automatico WCA e Re-processing Contatti

## Stato Attuale (aggiornato 2026-02-10)

### Risultato Debug Login
Il login automatico via HTTP **NON funziona** perché:
- I campi form sono confermati: `usr`/`pwd` + `__RequestVerificationToken`
- Il POST restituisce status 200 con 0 cookie e nessun errore visibile
- Il sito WCA probabilmente usa **login JavaScript/AJAX** e non un form POST tradizionale
- Il body della risposta POST ha la stessa dimensione della pagina di login (27787 bytes) = la pagina viene re-renderizzata = login fallito silenziosamente

### Soluzione Implementata
**Cookie manuale come metodo primario**: l'utente deve:
1. Fare login su wcaworld.com nel browser
2. Copiare `document.cookie` dalla Console
3. Incollarlo nelle Impostazioni → Cookie di Sessione WCA
4. Il cookie scade periodicamente, va aggiornato

### Modifiche Apportate
1. **`scrape-wca-partners/index.ts`**: 
   - Debug logging completo del login (campo form names, hidden fields, redirect chain)
   - Supporto parametro `aiParse: true` → lancia automaticamente `parse-profile-ai` dopo il salvataggio
   - Il sistema tenta ancora l'auto-login come fallback ma ora logga tutto per futuro debug
   
2. **`src/pages/Settings.tsx`**: 
   - Card cookie rinnovata con istruzioni step-by-step
   - Badge "Mancante" rosso se non configurato
   - Avviso scadenza cookie

### TODO Futuri
- [ ] Investigare se WCA usa un endpoint API/AJAX per il login (es. fetch POST a un URL diverso)
- [ ] Considerare headless browser (Puppeteer/Playwright) come alternativa per il login
- [ ] Implementare notifica automatica quando il cookie scade (se il resync inizia a fallire)
