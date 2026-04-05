

# Potenziamento Email Composer Contact Picker

## Problemi Attuali

1. **Scroll non funziona** — Il componente usa `space-y-3` dentro un div senza altezza fissa; lo `ScrollArea` copre solo la lista risultati ma l'intero contenuto (paesi + selezionati + tabs + risultati) non scorre
2. **Contatti (imported_contacts) mostrati piatti** — non raggruppati per azienda come i Partner
3. **Nessun filtro per origine** nella tab Contatti
4. **Nessun "Seleziona tutti"** per aggiungere in blocco i risultati filtrati
5. **Nessun contatore visibile** degli elementi attualmente visualizzati

## Piano

### 1. Fix scroll globale del picker
Wrappare l'intero contenuto del picker in uno `ScrollArea` con `h-full` che rispetti l'altezza del drawer. La sezione paesi e selezionati restano sticky in alto, il resto scorre.

### 2. Raggruppare Contatti per azienda (come Partner)
Nella tab "Contatti", raggruppare i risultati di `imported_contacts` per `company_name`:
- Mostrare la riga azienda con chevron espandibile
- Sotto, i singoli contatti con nome, ruolo, email icon
- Stessa UX dei Partner (expand/collapse)

### 3. Aggiungere filtro Origine nella tab Contatti
- Dropdown/chip-bar sopra la search con le origini disponibili (WCA, Import, Report Aziende, ecc.)
- Filtra la query Supabase con `.eq("origin", selectedOrigin)`
- Applicabile anche a BCA se pertinente

### 4. Bottone "Seleziona tutti" + contatore
- Sotto la search bar, riga con:
  - **Contatore**: "23 risultati" (numero elementi filtrati visibili)
  - **"Seleziona tutti"**: aggiunge tutti i risultati filtrati correnti ai recipients
  - **"Deseleziona tutti"**: rimuove quelli della lista corrente
- Il contatore dei selezionati totali è già visibile nella sezione "Selezionati (N)"

### 5. Ordinamento per ogni tab
Aggiungere un selettore di ordinamento per tab:
- **Partner**: Nome A-Z, Paese, Rating
- **Contatti**: Nome, Azienda, Origine, Paese
- **BCA**: Nome, Azienda, Location

## File da modificare

| File | Azione |
|------|--------|
| `EmailComposerContactPicker.tsx` | Riscrittura layout scroll, raggruppamento contatti, filtri origine, seleziona tutti, ordinamento |

## Risultato
Sidebar completamente scrollabile, contatti raggruppati per azienda, filtri per origine, selezione in blocco con contatore, ordinamento per colonna. Diventa il template riutilizzabile per altre sezioni.

