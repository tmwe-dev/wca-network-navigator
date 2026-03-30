

# Business Cards Tab nel Network + Evidenziazione nel Cockpit

## Cosa cambia

1. **Network (Operations)**: aggiunta di un tab "Business Cards" sopra la griglia paesi/partner, che mostra le business card dalla tabella `business_cards`. Le card matchate con partner vengono evidenziate (badge dorato, link al partner). Da qui si possono selezionare e inviare al Cockpit.

2. **Cockpit source tabs**: aggiunta di un quinto source tab "BCA" (Business Cards) nel TopCommandBar. I contatti provenienti da business card vengono mostrati con uno stile visivo distinto (bordo dorato, icona biglietto da visita) per distinguerli dai contatti normali.

3. **cockpit_queue**: supporto per `source_type = 'business_card'` + `source_id` che punta a `business_cards.id`.

## Dettagli tecnici

### 1. `src/pages/Operations.tsx`
- Aggiungere un toggle/tab in alto: "Partner" (vista attuale) | "Business Cards"
- Quando attivo "Business Cards": mostrare una versione semplificata di `BusinessCardsHub` con possibilita' di selezionare card e pulsante "Invia a Cockpit" che inserisce nella `cockpit_queue` con `source_type = 'business_card'`

### 2. `src/components/cockpit/TopCommandBar.tsx`
- Estendere `SourceTab` type: `"all" | "wca" | "prospect" | "contact" | "bca"`
- Aggiungere tab "BCA" con icona `CreditCard` nel SOURCE_TABS array

### 3. `src/hooks/useCockpitContacts.ts`
- Nella query cockpit_queue, gestire `source_type = 'business_card'`: fetch da `business_cards` e mappare a `CockpitContact` con `origin: "bca"`
- Aggiungere flag `isBusinessCard: boolean` al tipo `CockpitContact`

### 4. `src/components/cockpit/CockpitContactCard.tsx` + `CockpitContactListItem.tsx`
- Se `isBusinessCard === true`: bordo dorato/ambrato, piccola icona biglietto da visita, badge "BCA" per distinguerli visivamente

### 5. `src/pages/Cockpit.tsx`
- Aggiornare `ContactOrigin` type per includere `"bca"`
- Aggiornare il filtro sourceTab per mappare `"bca"` → contatti con `origin === "bca"`

## File coinvolti

| File | Azione |
|------|--------|
| `src/pages/Operations.tsx` | Aggiungere toggle Partner/Business Cards + azione "Invia a Cockpit" |
| `src/components/cockpit/TopCommandBar.tsx` | Aggiungere source tab "BCA" |
| `src/hooks/useCockpitContacts.ts` | Supportare `source_type = 'business_card'` + flag `isBusinessCard` |
| `src/pages/Cockpit.tsx` | Estendere `ContactOrigin`, aggiornare filtro source |
| `src/components/cockpit/CockpitContactCard.tsx` | Stile dorato per business card |
| `src/components/cockpit/CockpitContactListItem.tsx` | Badge/bordo dorato per business card |

Nessuna modifica al database — la `cockpit_queue` supporta gia' qualsiasi `source_type` testuale.

