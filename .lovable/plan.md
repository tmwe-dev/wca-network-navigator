
## Contesto

Stiamo guardando il drawer destro su `/v2/explore/network` (componente `PartnerDetailActivity` → sezione "ATTIVITÀ (100)"). Oggi mostra solo `subject` + data, senza canale, destinatario, persona, bandiera, ora, link al messaggio. Manca il modo di aggiungere note dal drawer, manca il legame "contatto in holding → azienda in holding", e nel DB ci sono dati Deep Search residui da azzerare prima di ripartire.

## Cambi da fare

### 1. Scheda Attività ricca (drawer destro azienda/contatto)

Riscrivo la lista in `PartnerDetailActivity` per ogni riga:

```text
[icona canale] [bandiera paese] Persona · email/numero
              Oggetto / preview testo
              31 mag · 14:32        [↗ apri messaggio]
```

- **Icona canale**: ✉️ email, 💬 WhatsApp, 🔗 LinkedIn, 📞 chiamata, 📝 nota, 🔍 deep search.
- **Direzione**: freccia ↑ sent, ↓ received, colorata.
- **Persona**: nome contatto + ruolo se disponibile (join `partner_contacts`).
- **Indirizzo**: email/numero/handle del destinatario.
- **Bandiera**: country del partner.
- **Data + ora locale** (CET).
- **Link "↗ apri messaggio"**: porta alla mail/WA/LI originale (route esistente).
- **Pulsante "Storia completa"** in cima alla sezione → apre `/v2/agenda?partnerId=…` filtrato su quel partner (riusa la pagina già fatta come da scelta utente).
- Counter `(100)` resta, virtualizzo se >50.

Nessuna nuova route. Niente deep refactor: cambio solo il render della singola card e aggiungo un join leggero.

### 2. Note manuali = attività del giorno

Aggiungo un pulsante "+ Nota" sopra la sezione Timeline del drawer. Apre un piccolo form:

- Tipo: Nota / Chiamata / Incontro / Altro
- Testo libero
- Checkbox: **"Metti l'azienda in circuito di attesa"** (default OFF; ON quando tipo = Chiamata)
- Persona contattata (dropdown contatti del partner)

Al submit:
1. Inserisce riga in `interactions` (tipo già esistente) → compare nel Timeline del drawer.
2. Se checkbox ON → vedi punto 3 (holding azienda).
3. La stessa riga compare nell'Agenda di oggi grazie al raggruppamento per azione già attivo (`AgendaDayDetail` legge da interactions).

### 3. Holding a livello azienda

Regola operativa stabilita dall'utente: **se anche un solo contatto entra in circuito di attesa, l'intera azienda è in circuito di attesa e sparisce dalle viste di prospezione finché l'operatore non la riattiva o cerca esplicitamente altri contatti.**

Implementazione minima, senza nuovi schemi:

- Già oggi un partner è "in holding" se esiste almeno una `interaction` recente (≤ 30g) o se `lead_status ∈ {contacted, in_progress, negotiation}`. Centralizzo questa derivata in un helper `isPartnerInHolding(partner, interactions)` usato sia dalla query lista (esclusione) sia dal badge ✈️ già esistente.
- Nei filtri di `/v2/explore/network` aggiungo il default **"Nascondi aziende in circuito di attesa"** (toggle nella toolbar, ON di default). L'operatore può disattivarlo per cercare altri contatti della stessa azienda.
- Nel drawer mostro un banner viola **"✈️ Azienda in circuito di attesa — ultimo contatto: X giorni fa con Y"** con pulsante "Esci dal circuito" (cancella la marcatura settando una `interaction` di tipo `holding_release`).
- Hard guard outreach: in `useSendEmail` / queue WA/LI controllo `isPartnerInHolding` e blocco con toast "Azienda in circuito di attesa — conferma manuale richiesta".

### 4. Reset totale Deep Search

Migration di pulizia (richiesta esplicita utente):

- `DELETE FROM sherlock_investigations` (tutto).
- `UPDATE partners SET deep_search_at = NULL, sherlock_level = NULL, sherlock_completed_at = NULL`.
- `UPDATE partner_contacts SET deep_search_at = NULL` (dove esiste).
- Cancellazione **alias automatici** creati insieme alle email (verifico tabella `partner_aliases` / equivalente — utente dice "non servono più, vengono creati con le mail"). Filtro per `source = 'auto'` o `created_by_function` se presente.
- Reset **rating sporchi**: azzero `quality_score`, `lead_score`, `reliability_score` su partners e contacts dove provengono da AI/deep search legacy (manterò i campi, li metto a NULL così le nuove logiche li ricalcolano puliti).

Tutto in **una migration unica** con `BEGIN/COMMIT`, mostro l'elenco esatto delle righe coinvolte prima di eseguirla.

### 5. Marker Deep Search visibile ovunque

Già esiste `SherlockLevelBadge` ma è solo nell'header drawer. Lo propago:

- Card azienda in `/v2/explore/network` → striscia laterale colorata + badge livello (Scout giallo / Detective viola / Sherlock ambra).
- Card contatto idem.
- Tooltip con data ultima Deep Search.

Niente nuova logica: lego al campo `sherlock_level` ripopolato dalle nuove investigazioni post-reset.

## File toccati (stima)

- `src/components/partners/PartnerDetailActivity.tsx` — render ricco righe
- `src/components/partners/ActivityList.tsx` — idem se serve, o assorbito
- `src/components/partners/AddNoteForm.tsx` *(nuovo)* — form nota + holding
- `src/v2/ui/organisms/PartnerDetailInline.tsx` — pulsante "+ Nota" e link "Storia completa" → `/v2/agenda?partnerId`
- `src/v2/ui/molecules/CompanyCardList/CompanyCard.tsx` — striscia laterale Sherlock + badge holding azienda
- `src/data/partners/queries.ts` (o equivalente) — filtro "nascondi in holding"
- `src/hooks/useSendEmail.ts` + queue WA/LI — hard guard holding azienda
- `src/lib/holding.ts` *(nuovo helper SSOT)*
- `supabase/migrations/<ts>_reset_deep_search_and_aliases.sql` — wipe

## Vincoli rispettati

- Niente refactor opportunistici fuori scope.
- Soft-delete globale: il reset Deep Search usa UPDATE/DELETE su tabelle non-business (sherlock_investigations è log, ok DELETE).
- DAL only, query keys centralizzati, no `any`.
- Editorial review e pipeline invio: nessuna modifica al journalistReview, solo guard pre-invio.
- Holding pattern già documentato in `mem://contacts/holding-pattern-governance` — estendo, non duplico.
