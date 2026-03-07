

## Tre problemi da risolvere

### 1. AI saluta "Pricing & Business Development" come se fosse una persona

**Causa**: Il campo `contact_alias` o `name` contiene titoli/ruoli (es. "Pricing & Business Development") generati erroneamente come alias. Il prompt (riga 424) dice "usa SOLO questo nome" senza validare se è effettivamente un nome di persona.

**Soluzione** — Edge Function `generate-email/index.ts`:
- Aggiungere una funzione `isLikelyPersonName(value)` che rileva pattern non-persona: contiene "department", "pricing", "business development", "manager", "director", "office", "logistics", "operations", "commercial", "sales", "admin", "accounting", "hr", ecc.
- Se `contact_alias` fallisce il check, usare `contact.name` come fallback. Se anche `name` fallisce → trattare come "nessun contatto valido" e usare "Gentile responsabile"
- Aggiungere regola nel system prompt (regola 16): "Se il nome del destinatario sembra un ruolo/titolo aziendale e non un nome di persona (es. 'Pricing Department', 'Business Development'), NON usarlo come saluto. Usa invece 'Gentile responsabile' o equivalente."

### 2. Email body è testo piatto senza formattazione

**Causa**: Il prompt dice "no markdown" (regola 8) e il body viene salvato come testo semplice. Nel SortingCanvas usa `dangerouslySetInnerHTML` ma il contenuto non ha tag HTML → tutto appare come blocco unico senza a capo.

**Soluzione**:
- **Edge Function**: Cambiare regola 8 da "no markdown" a "Genera il corpo in HTML semplice: usa `<p>` per i paragrafi, `<br>` per gli a capo, `<strong>` per enfasi, `<ul>/<li>` per elenchi. NON usare markdown."
- **Post-processing** nel edge function (dopo aver estratto subject/body): se il body non contiene tag HTML (`<p>`, `<br>`), convertire automaticamente `\n\n` → `</p><p>` e `\n` → `<br>` per retrocompatibilità
- Il SortingCanvas già supporta HTML rendering con DOMPurify — funzionerà automaticamente

### 3. Anteprima formattata nella card del Sorting

**Attuale**: SortingCanvas mostra l'HTML grezzo con `dangerouslySetInnerHTML` ma il contenuto è testo piatto. La preview sembra un muro di testo.

**Soluzione** — `SortingCanvas.tsx`:
- Aggiungere stile email-like: sfondo bianco, padding, font-family serif/sans-serif, max-width 640px centrato (simula come appare in un client email)
- Aggiungere header visivo con Da/A/Oggetto in stile email client
- Il body (già sanitizzato con DOMPurify) verrà ora renderizzato correttamente perché l'AI genererà HTML

### File da modificare

1. **`supabase/functions/generate-email/index.ts`**:
   - Aggiungere `isLikelyPersonName()` utility
   - Validare `recipientName` (righe 399-401): se non è un nome persona → fallback a "Gentile responsabile"
   - Cambiare regola 8: richiedere HTML semplice invece di testo piatto
   - Aggiungere regola 16: riconoscere ruoli/titoli e non usarli come nome
   - Post-processing: convertire `\n` → `<br>` / `<p>` se il body non contiene HTML

2. **`src/components/sorting/SortingCanvas.tsx`**:
   - Stile email-client per la preview: sfondo bianco, bordi, header Da/A/Oggetto strutturato
   - Max-width 640px centrato per simulare inbox
   - Typography migliorata con `prose` classes

