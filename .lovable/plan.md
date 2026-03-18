

## Fix: Alias Feedback, Visibilita e ContactPicker UX

### Problema 1: Bottone "Genera Alias" resta attivo dopo generazione

Attualmente `handleGenerateAlias` invalida le query ma il componente `ContactDetailPanel` riceve `contact` come prop dall'esterno. Dopo la generazione, il dato locale `c` non si aggiorna, quindi `needsAlias` resta `true` e il bottone riappare. Inoltre, se l'alias esiste gia (processed: 0), il toast dice "0 contatti elaborati" senza spiegare perche.

**Soluzione:**
- Dopo la chiamata, fare `refetchQueries` forzato (non solo invalidate) per aggiornare il contact nel pannello
- Cambiare il messaggio toast: se `processed === 0` mostrare "Alias gia presente" invece di "0 contatti elaborati"
- Aggiungere uno stato locale `justGenerated` che disabilita il bottone immediatamente dopo il successo, prima ancora che il refetch aggiorni i dati

**File:** `src/components/contacts/ContactDetailPanel.tsx`

### Problema 2: Alias non visibile nella card

La `ContactCard` non mostra mai `company_alias` ne `contact_alias`. Se l'utente genera un alias, non lo vede nella lista.

**Soluzione:**
- Nella card, se esiste `company_alias`, mostrarlo come nome azienda principale (con il nome originale piu piccolo sotto, o viceversa)
- Se esiste `contact_alias`, mostrarlo accanto al nome del contatto con un'icona Sparkles
- Aggiungere una piccola icona Sparkles sulla card se almeno un alias e presente

**File:** `src/components/contacts/ContactCard.tsx`

### Problema 3: ContactPicker — dropdown nasconde i contatti

Quando ci sono piu contatti, il Select dropdown li nasconde tutti tranne quello selezionato. L'utente vuole vedere chi e selezionato + quanti altri ci sono, con possibilita di cambiare.

**Soluzione:**
- Mostrare il contatto selezionato in chiaro (nome + email)
- Accanto, un badge "+N altri" cliccabile che apre un Popover con la lista completa
- Ogni contatto nella lista ha un bottone "Usa questo" per cambiare selezione
- Se nessuno e selezionato, mostrare la lista direttamente con radio-style selection

**File:** `src/components/workspace/ContactPicker.tsx`

### Riepilogo file

1. `src/components/contacts/ContactDetailPanel.tsx` — feedback alias migliorato, stato post-generazione
2. `src/components/contacts/ContactCard.tsx` — mostra alias nella card
3. `src/components/workspace/ContactPicker.tsx` — lista visibile con "+N" badge e swap

