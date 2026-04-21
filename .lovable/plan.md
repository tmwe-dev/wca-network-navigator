

# LOVABLE-77: Email Forge — da "standardizzata" a "personalizzata sui dati"

## Problema diagnosticato
Il `contextAssembler` carica correttamente 15 blocchi (Base + Deep Search + Sherlock + storia + BCA + KB). I dati arrivano all'AI. Ma il prompt finale produce email piatte perché:

1. Le 7 regole anti-allucinazione bloccano anche i fatti veri
2. Il truncation Standard (800/600/500 char) taglia troppo
3. Lo Strategic Advisor genera istruzioni generiche ("tono freddo-professionale")
4. Manca un'istruzione esplicita "USA almeno 1 fatto specifico dal contesto"

## Modifiche

### 1. Riscrivere le regole anti-allucinazione (`promptBuilder.ts`)

Sostituire le 7 regole "VIETATO" con un set bilanciato:

```text
## REGOLE DATI
1. PUOI e DEVI citare fatti specifici letteralmente presenti in: profilo partner, 
   blocco CachedEnrichment, Sherlock summary, BCA, KB aziendale, documenti.
2. VIETATO inventare dati NON presenti: numeri %, KPI, casi cliente, certificazioni, 
   premi, partnership che non compaiono letteralmente nei blocchi sopra.
3. Se un dato è qualitativo nei blocchi, mantienilo qualitativo. Se è quantitativo, 
   citalo letterale.
4. Se non hai dati specifici → resta qualitativo, MAI fabbricare numeri.
```

Effetto: l'AI si sente autorizzata a citare ciò che c'è davvero (Sherlock dice "12 contatti decision maker" → può scriverlo), ma non inventa.

### 2. Aggiungere blocco "PERSONALIZZAZIONE OBBLIGATORIA"

Nuovo blocco nel system prompt, **subito prima** di "Stile commerciale":

```text
## PERSONALIZZAZIONE OBBLIGATORIA
Il messaggio DEVE contenere almeno UN fatto specifico estratto dai blocchi:
- CachedEnrichment (sito, contatti chiave, reputazione)
- Sherlock summary
- MetInPerson (eventi, luoghi)
- History (interazioni precedenti)
- Profilo partner (servizi, network, città specifica)

Se non riesci a trovare nemmeno UN fatto specifico → lo dichiari nel subject 
con tag [GENERIC] e procedi con presentazione standard.
Vietato produrre email senza ancorarla ad almeno un fatto.
```

Effetto: l'AI è obbligata a personalizzare; se non trova nulla, lo segnala (utile per debug).

### 3. Aumentare truncation in Standard

In `getProfileTruncation` (riga 89) e in `formatEnrichmentForPrompt`:

| Campo | Fast (era) | Standard (era → nuovo) | Premium (era → nuovo) |
|---|---|---|---|
| Profile description | 200 | 500 → **800** | 1000 → **1500** |
| Raw profile markdown | 0 | 1000 → **2500** | 3000 → **5000** |
| Sito (enrichment) | 800 | 800 → **1500** | 800 → **2500** |
| Sherlock summary | 800 | 800 → **1500** | 800 → **3000** |
| Contatti chiave | 5 | 5 → **8** | 5 → **15** |

Token aggiuntivi: ~1500-3000 per email Standard (modello Gemini 3 Flash supporta 1M context).

### 4. Strategic Advisor più ricco

Espandere `buildStrategicAdvisor` per includere:
- Lista dei "data points disponibili" che l'AI dovrebbe sfruttare
- Suggerimento esplicito sul tipo di hook da usare in base ai dati

```text
## DATA POINTS DISPONIBILI PER QUESTO PARTNER
- Sito web: ${hasWebsite ? "✓ analizzato" : "✗"}
- LinkedIn azienda: ${hasLinkedin ? "✓" : "✗"}
- Contatti chiave da Deep Search: ${contactProfilesCount}
- Indagine Sherlock: ${hasSherlock ? "✓ summary disponibile" : "✗"}
- Incontri di persona registrati: ${bcaCount}
- Storia interazioni: ${historyCount} touch precedenti
- Reputazione online: ${hasReputation ? "✓" : "✗"}

→ USA ALMENO 2 di questi data points come ancore nel messaggio.
```

### 5. Footer Email Forge: "data points usati"

Nel `ForgeOutputPanel` aggiungere sotto il risultato un piccolo badge:
```
Data points iniettati: 7/15  |  CachedEnrichment ✓  Sherlock ✓  History ✓  ...
```

Già presente come blocchi nel debug, basta esporlo come summary visivo nel risultato.

### 6. Quality "Premium" diventa il default per Email Forge

In `EmailForgePage.tsx` cambiare il default `quality: "standard"` → `"premium"` per la pagina Forge (è uno strumento di analisi, non di volume). L'utente può sempre downgradear a Standard se vuole.

## File toccati
- `supabase/functions/generate-email/promptBuilder.ts` — regole + personalizzazione + advisor + truncation
- `supabase/functions/_shared/enrichmentAdapter.ts` — alzare slice limits
- `supabase/functions/improve-email/index.ts` — coerenza con stesse regole
- `supabase/functions/generate-outreach/contextAssembler.ts` — coerenza
- `src/v2/ui/pages/email-forge/ForgeOutputPanel.tsx` — badge "data points usati"
- `src/v2/ui/pages/EmailForgePage.tsx` — default quality "premium"

Nessuna modifica a DB, schema, hook business o edge functions critiche.

## Verifica end-to-end
1. Prendere un partner con: sito + LinkedIn + Sherlock + storia interazioni
2. Generare in Email Forge prima e dopo il fix
3. Confrontare: l'email "dopo" deve citare almeno 2 fatti specifici (un servizio dal sito, un dato da Sherlock, un riferimento a interazione passata)
4. Aprire tab "Prompt" → verificare che `CachedEnrichment` blocco contenga effettivamente i dati
5. Provare un partner SENZA arricchimento → l'email deve avere `[GENERIC]` nel subject

## Cosa otterrai
- Email che citano nome di un decision maker trovato da Sherlock
- Email che fanno hook su un servizio specifico letto dal sito
- Email che ricordano l'evento dove vi siete incontrati (BCA)
- Email che riferiscono interazioni precedenti senza ripetere presentazioni
- Marker `[GENERIC]` che ti segnala quando il sistema non aveva dati per personalizzare → sai immediatamente quali partner arricchire prima

