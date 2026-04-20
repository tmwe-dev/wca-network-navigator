

## Diagnosi

### 1. Perché Google si apre con "0 risultati"
La Deep Search per partner usa un **cascading di 5 query LinkedIn** in `useDeepSearchLocal.ts` riga 64-69. Per un contatto come "Mr. Luca Arcana", la PRIMA query è:
```
"Mr. Luca Arcana" "Transport Management srl" site:linkedin.com/in
```
Google non trova nulla perché:
- Il prefisso **"Mr."** è incluso nelle virgolette → match esatto fallisce
- Il nome aziendale ha varianti ("Transport Management S.r.l.", "Transport Management SRL", ecc.)
- Le virgolette doppie su entrambi i termini sono troppo restrittive

L'extension **dovrebbe** poi cascare alla query 2, 3, 4, 5… ma:
- Le query successive vengono eseguite dall'extension una alla volta
- L'utente vede solo la PRIMA tab Google aperta (con 0 risultati) e pensa che sia finita
- Il sistema in realtà sta provando le altre, ma è invisibile

**Soluzione**: pulire i nomi prima della query (rimuovere `Mr.`, `Mrs.`, `Dott.`, `S.r.l.`, `SRL`, `S.p.A.` ecc.) e mostrare in UI quale query è in corso (cascade visibility).

### 2. Manca il pannello di setting Deep Search
Il piano originale prevedeva un **Deep Search Config Panel** dove scegliere le 4 modalità:
- 🌐 Scrape sito web
- 🔗 Scrape LinkedIn (contatti + azienda)
- 💬 Verifica WhatsApp
- 🤖 Analisi AI profilo

Oggi nel `DeepSearchTab` ci sono solo i **bottoni Run** (partner / contatto), nessun toggle. Il `DeepSearchOptionsDialog` esiste già ma è usato solo nei Settings/Cockpit, mai nel Lab Forge.

Inoltre **non si può configurare la qualità delle query** (numero risultati, query custom, lingua, dominio aziendale prioritario).

### 3. KB e Prompt: aggiornamento immediatamente verificabile?
Lo stato attuale:
- ✅ KB tab: edit/toggle/insert funzionanti, salva su `knowledge_base` table
- ✅ Sender tab: edit `app_settings` funzionante
- ✅ Doctrine tab: edit dottrine L3 funzionante
- ❌ MANCA: pulsante **"Re-genera mail con nuova KB"** prominente dopo ogni save
- ❌ MANCA: badge "modificato → genera per vedere effetto"
- ❌ I prompt operativi (`operative_prompts`) **non sono editabili dal Lab**: l'utente vede solo le KB

## Piano di intervento

### A. Cleanup query Google (impatto immediato)
Modifico `useDeepSearchHelpers.ts`:
- Aggiungo `cleanPersonName()` → rimuove prefissi (`Mr.`, `Mrs.`, `Ms.`, `Dr.`, `Dott.`, `Ing.`, `Eng.`)
- Aggiungo `cleanCompanyName()` → rimuove suffissi legali (`S.r.l.`, `SRL`, `S.p.A.`, `Ltd`, `LLC`, `GmbH`, `Inc.`, `Co.`)
- Le query usano i nomi puliti; aggiungo anche query "loose" senza virgolette come prima fallback

### B. Deep Search Config Panel nel Lab Forge
In `DeepSearchTab.tsx` aggiungo in alto un pannello compatto con:
- 4 toggle (sito, LinkedIn contatti, LinkedIn azienda, WhatsApp)
- Slider "max query per contatto" (1-5)
- Input "dominio prioritario" (override del domain extracted)
- I toggle si salvano nel `forgeLabStore` come `deepSearchConfig`
- Il `useDeepSearchLocal` riceve e rispetta i toggle (skip rami disattivati)

### C. Cascade visibility (capire cosa fa AI)
Sotto i bottoni Run, mostro una **timeline live** delle query in corso:
```text
✓ "Luca Arcana" "Transport Management" site:linkedin.com/in   → 0 risultati
⏳ "Luca Arcana" "transmgmt.it" site:linkedin.com/in          → in corso…
○ "Luca Arcana" site:linkedin.com/in                          → in coda
```
Aggiungo un event bus leggero in `useDeepSearchLocal` (`onQueryStart`/`onQueryResult`) → callback opzionale che il tab sottoscrive.

### D. Verifica immediata dopo ogni save (KB / Sender / Doctrine)
- Quando l'utente modifica KB/Sender/Doctrine, mostro banner sticky in fondo al tab:
  > "Modifica salvata · [Re-genera mail per vedere l'effetto]"
- Bottone esegue `forgeLabStore.triggerRun()` che la pagina già osserva.

### E. Editor Prompt Operativi (nuovo tab "Prompts")
Aggiungo un 6° tab `PromptsTab` accanto a Doctrine:
- Lista i prompt rilevanti per Email Forge dalla tabella `operative_prompts` (filtrati per `category=email` o `agent_type` collegato)
- Edit inline del campo `content` con preview char count
- Toggle "attivo"
- Stesso pattern Re-genera dopo save

### F. Test data quality panel (Insights)
Sotto il banner profilo aggiungo un mini-report:
- "Sito web raggiungibile: ✓/✗"  
- "Email valide: 2/3"
- "Telefoni E.164: 1/3"
- "Ultima Deep Search: X giorni fa"

Ogni voce è un click che apre il dettaglio nella tab pertinente.

## File da toccare

- `src/hooks/useDeepSearchHelpers.ts` — aggiungere `cleanPersonName`, `cleanCompanyName`, esportare event bus
- `src/hooks/useDeepSearchLocal.ts` — applicare cleanup, rispettare config toggles, emettere eventi cascade
- `src/v2/hooks/useForgeLabStore.ts` — aggiungere `deepSearchConfig: { website, linkedinContacts, linkedinCompany, whatsapp, maxQueriesPerContact, priorityDomain }`
- `src/v2/ui/pages/email-forge/tabs/DeepSearchTab.tsx` — aggiungere config panel + cascade timeline
- `src/v2/ui/pages/email-forge/tabs/KnowledgeBaseTab.tsx` — banner "re-genera" dopo save
- `src/v2/ui/pages/email-forge/tabs/SenderProfileTab.tsx` — idem
- `src/v2/ui/pages/email-forge/tabs/DoctrineTab.tsx` — idem
- `src/v2/ui/pages/email-forge/tabs/PromptsTab.tsx` — **nuovo file**
- `src/v2/ui/pages/email-forge/LabBottomTabs.tsx` — aggiungere tab "Prompts"

## Risultato atteso

1. Google non aprirà più tab vuote: query pulite + cascade visibile.
2. L'utente potrà spegnere le 4 modalità singolarmente e vedere immediatamente l'impatto sul tempo e sui dati raccolti.
3. Ogni modifica a KB / Sender / Doctrine / Prompts sarà accompagnata da un bottone "Re-genera ora" → feedback immediato sulla mail prodotta.
4. Il Lab diventa un vero ambiente di calibrazione end-to-end.

## Out-of-scope

- Salvataggio persistente dei `deepSearchConfig` (resta in memoria sessione; persistenza in iterazione successiva).
- Editor visuale grafico dei prompt (solo textarea per ora).
- A/B test automatico tra due configurazioni.

