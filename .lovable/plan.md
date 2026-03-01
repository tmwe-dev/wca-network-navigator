

## Piano: Sales Knowledge Base integrata nel sistema

### Materiale sorgente (da libreria)
I file `sales-training.ts` e `bruce-methodology.ts` contengono già:
- 5 principi vendita, gestione 5 obiezioni, protocollo 5 fasi, valore unico TMWE
- Metodologia Bruce 5 passi, frasi fiducia, filosofia servizio

### Cosa creare

#### 1. `src/data/salesKnowledgeBase.ts` (nuovo)
Costante `SALES_KNOWLEDGE_BASE` — testo markdown strutturato (~4000 parole) che fonde e amplia il materiale trovato:

**Sezioni:**
1. Principi fondamentali vendita B2B (dai 5 principi TMWE)
2. Struttura email efficace — hook, value proposition, CTA, regola 5 righe
3. Tecniche di apertura — riferimento network, complimento specifico, dato mercato
4. Value proposition per servizio — air, ocean, project cargo, express, DG, e-commerce
5. Gestione obiezioni (espanse dalle 5 originali + nuove per B2B internazionale)
6. Protocollo vendita 5 fasi (dal sales-training, adattato per email)
7. Adattamento tono per ruolo (CEO vs Ops vs Sales) e area geografica
8. Tecniche persuasione B2B — social proof, scarcità, reciprocità
9. Pattern follow-up — timing, escalation, cambio angolo
10. Oggetto email — pattern efficaci, max 6-8 parole
11. Call-to-action — una sola, specifica, basso impegno
12. Frasi fiducia e chiusura (dalla metodologia Bruce)
13. Errori da evitare — genericità, promesse vaghe, email troppo lunghe

#### 2. `src/components/settings/AIProfileSettings.tsx` (modifica)
- Aggiungere `ai_sales_knowledge_base` a `AI_KEYS`
- Nuova Card "Sales Knowledge Base" (icona TrendingUp) tra "Knowledge Base Aziendale" e "Stile di Comunicazione"
- Textarea grande con il default precompilato
- Bottone "Ripristina default" per ricaricare il contenuto originale

#### 3. `supabase/functions/generate-email/index.ts` (modifica)
- Leggere `ai_sales_knowledge_base` da settings (già caricata con `ai_%`)
- Iniettarla nel system prompt come sezione separata: `SALES TECHNIQUES GUIDE:`
- L'AI la userà come guida per struttura, tono e tecniche di persuasione nelle email

### File da creare/modificare
1. **Creare** `src/data/salesKnowledgeBase.ts`
2. **Modificare** `src/components/settings/AIProfileSettings.tsx`
3. **Modificare** `supabase/functions/generate-email/index.ts`

