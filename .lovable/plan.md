
# Fix: Auto-Login Server-Side e Stabilita' Bridge

## Situazione Attuale

I dati STANNO arrivando (verificato dai log del server). Esempi dalla sessione appena eseguita:
- Pelikan: 4 email estratte
- SKY NET: email + telefoni + mobile
- International Trans 06: email + telefoni

Alcuni partner (SBA Albania, Blackthorne, Aster Logistics) non hanno email/telefoni perche' non li condividono su WCA -- non e' un bug.

## Problemi da Risolvere

### Problema 1: Auto-Login Server-Side Rotto
Il server trova il form SBAGLIATO nella pagina di login WCA (`/Home/SetLanguage` invece del form di login). Per questo il login automatico server-side fallisce SEMPRE. Il sistema dipende interamente dall'estensione Chrome.

**Fix**: Nella edge function `scrape-wca-partners`, correggere la funzione `directWcaLogin` per cercare specificamente il form di login (quello con `input[type="password"]`) invece di prendere il primo form trovato. Usare il selettore dell'action corretto (`/Account/Login`) e i nomi campo corretti (`UserName`/`Password` o quelli rilevati dal form giusto).

### Problema 2: Bridge Estensione Instabile
Il messaggio `contentScriptReady` puo' arrivare prima che la webapp sia pronta ad ascoltare. Risultato: l'indicatore mostra "non rilevata" anche quando l'estensione e' installata.

**Fix**: Nel hook `useExtensionBridge`, aggiungere:
- Un ping periodico ogni 5 secondi finche' l'estensione non viene rilevata
- Un retry automatico al mount del componente
- Nella pagina Acquisizione, prima di avviare la pipeline, forzare un `checkAvailable()` con retry

### Problema 3: Feedback Visivo Insufficiente
L'utente non vede chiaramente quali dati sono stati estratti e da quale fonte (server vs estensione).

**Fix**: Nel canvas del partner, aggiungere un badge che indica la fonte dei contatti:
- "Server" se i contatti vengono dallo scraper server-side
- "Extension" se vengono dal bridge Chrome
- Evidenziare in verde le email/telefoni estratti con successo

## Dettagli Tecnici

### File da modificare

1. **`supabase/functions/scrape-wca-partners/index.ts`** (funzione `directWcaLogin`)
   - Cercare il form che contiene `input[type="password"]` nell'HTML della pagina di login
   - Estrarre l'action di QUEL form specifico, non del primo form trovato
   - Fallback ai field names `UserName`/`Password` (standard ASP.NET Identity)
   - Aggiungere logging migliorato per diagnostica

2. **`src/hooks/useExtensionBridge.ts`**
   - Aggiungere interval di polling (ping ogni 5s) finche' `isAvailable` diventa true
   - Cleanup dell'interval quando il bridge viene rilevato o il componente si smonta
   - Aggiungere retry nel `checkAvailable` (3 tentativi con delay 1s)

3. **`src/pages/AcquisizionePartner.tsx`**
   - Prima di avviare la pipeline, forzare `checkExtension()` con feedback
   - Mostrare nel canvas la fonte dei contatti (server vs extension)
   - Aggiungere contatore contatti con email/telefono nel riassunto finale

## Risultato Atteso
- Il server riesce ad autenticarsi autonomamente senza dipendere dall'estensione
- L'estensione viene rilevata in modo affidabile quando installata
- L'utente vede chiaramente quanti contatti con email/telefono sono stati estratti
