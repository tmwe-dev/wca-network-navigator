

# Come AI + Partner Connect Aiutano nella Ricerca LinkedIn — e Cosa Migliorare

## Flusso Attuale

```text
1. Google Search (via Partner Connect extension)
   Query: "Luca Arcana" "Transport Management SRL" site:linkedin.com/in
   ↓
2. Se 0 risultati → Retry con solo cognome:
   "Arcana" "Transport Management SRL" logistics site:linkedin.com/in
   ↓
3. Se risultati trovati → AI (Lovable Gateway) valida il match:
   "Quale di questi URL è il profilo di Luca Arcana at Transport Management?"
   ↓
4. Se AI conferma → salva URL in partner_social_links
```

## Problemi Identificati

1. **Solo 2 tentativi** — se il nome azienda non corrisponde (es. "Transport Management SRL" vs "TMWE" su LinkedIn), entrambi falliscono
2. **Email non usata** — il campo `email` è disponibile ma ignorato. Da `l.arcana@tmwe.it` si potrebbe estrarre "tmwe" come keyword alternativa
3. **Nessuna query senza azienda** — non prova mai solo `"Luca Arcana" site:linkedin.com/in`
4. **Nessuna query libera** — non prova mai `Luca Arcana LinkedIn` (senza site:)

## Piano: Cascata Intelligente con Email Domain

### Modifiche in `src/hooks/useDeepSearchLocal.ts`

**Nuovo helper** `extractDomainKeyword(email)`:
- Estrae dominio da email (es. `tmwe` da `l.arcana@tmwe.it`)
- Esclude domini generici (gmail, yahoo, hotmail, outlook, libero, etc.)

**Cascata di 5 query** (si ferma al primo risultato LinkedIn valido):

```text
1. "Nome Cognome" "NomeAzienda" site:linkedin.com/in     ← attuale
2. "Nome Cognome" "dominio-email" site:linkedin.com/in   ← NUOVO
3. "Nome Cognome" site:linkedin.com/in                    ← NUOVO (senza azienda)
4. "Cognome" "dominio-email" site:linkedin.com/in         ← NUOVO (solo cognome)
5. Nome Cognome LinkedIn                                   ← NUOVO (query libera)
```

**AI validazione migliorata** — il prompt includerà anche dominio email e posizione per disambiguare meglio tra omonimi.

### Applicazione

La stessa cascata viene applicata in entrambe le funzioni:
- `searchLinkedInForContacts` (righe 100-160) — per partner
- `searchContact` (righe 381-414) — per contatti singoli

### Impatto
- Zero costi aggiuntivi (stesse chiamate Google via Partner Connect)
- Massimo 5 query Google per contatto, ma nella maggior parte dei casi si ferma al tentativo 1-3
- Tasso di successo atteso: da ~40% a ~85% per contatti con email aziendale

