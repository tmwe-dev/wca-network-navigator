
# Fix: Alias generation mirata (singolo contatto / selezione)

## Problema identificato

1. **`generate-aliases` edge function** (riga 16-30): accetta solo `countryCodes` e carica TUTTI i partner di quei paesi. Non supporta singoli contatti o partner.
2. **`handleGroupAlias`** in `ContactListPanel.tsx` (riga 71-73): mostra solo un toast, non invoca mai la funzione.
3. **Nessun pulsante** nel `ContactDetailPanel` per generare l'alias di un singolo contatto.
4. **Nessun supporto** per `imported_contacts` -- la funzione lavora solo sulla tabella `partners`/`partner_contacts`.

## Piano di correzione

### 1. Aggiornare edge function `generate-aliases`
Accettare tre modalita di input mutuamente esclusive:
- `countryCodes: string[]` -- comportamento esistente (batch per paese)
- `partnerIds: string[]` -- genera alias solo per partner specifici
- `contactIds: string[]` -- genera alias per contatti importati (tabella `imported_contacts`)

Per `contactIds`, la logica sara:
- Caricare i contatti dalla tabella `imported_contacts` (non `partners`)
- Generare `company_alias` e `contact_alias` con lo stesso prompt AI
- Salvare direttamente su `imported_contacts`

### 2. Collegare il pulsante "Alias" nel GroupStrip
In `ContactListPanel.tsx`, `handleGroupAlias` diventa:
- Se ci sono contatti selezionati nella selezione globale, usa quelli (IDs specifici)
- Altrimenti, carica gli ID del gruppo e li passa alla funzione
- Mostra toast con conteggio reale e progress

### 3. Aggiungere pulsante alias singolo nel ContactDetailPanel
- Aggiungere un bottone "Genera Alias" accanto alle quick actions
- Visibile solo se `company_alias` o `contact_alias` sono null
- Chiama `generate-aliases` con `contactIds: [contact.id]`
- Aggiorna il pannello dopo la generazione

### 4. Collegare selezione bulk nel ContactListPanel
- Il pulsante bulk "Alias" nella barra di selezione (gia presente visivamente ma non funzionale) invoca `generate-aliases` con gli ID selezionati

## File da modificare

| File | Modifica |
|------|----------|
| `supabase/functions/generate-aliases/index.ts` | Aggiungere supporto `contactIds` e `partnerIds` |
| `src/components/contacts/ContactListPanel.tsx` | Implementare `handleGroupAlias` reale con invocazione |
| `src/components/contacts/ContactDetailPanel.tsx` | Aggiungere bottone "Genera Alias" |
| `src/components/contacts/GroupStrip.tsx` | Nessuna modifica (gia passa `onAlias`) |

## Dettagli tecnici

### Edge function - nuovo branch per contactIds
```
if (contactIds?.length) {
  // Load from imported_contacts
  // Batch in groups of 15
  // AI generates company_alias + contact_alias
  // Save back to imported_contacts
}
```

### ContactDetailPanel - nuovo bottone
Accanto ai bottoni Email/WhatsApp/Chiama, un bottone "Genera Alias" che:
- Chiama `supabase.functions.invoke("generate-aliases", { body: { contactIds: [c.id] } })`
- Invalida la query `contact-group-counts` e il contatto corrente
- Mostra toast di successo/errore

### ContactListPanel - handleGroupAlias corretto
- Se `selection.count > 0`: usa `Array.from(selection.selectedIds)`
- Altrimenti: carica gli ID del gruppo con `fetchGroupContactIds`
- Chiama `generate-aliases` con `contactIds`
- Mostra toast con conteggio effettivo e risultato
