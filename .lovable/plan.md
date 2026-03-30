
# Spostare definitivamente i filtri di Outreach nella sidebar

## Problema reale
Hai ragione: in `/outreach` ci sono ancora filtri inline sia in **Workspace** sia in **In Uscita**. Il nodo tecnico è questo: oggi il drawer conosce solo la route `/outreach`, ma **non sa quale tab interna è attiva** (`cockpit`, `inuscita`, `workspace`, ecc.). Per questo i filtri sono rimasti dentro i componenti locali.

## Soluzione
Rendo il drawer **consapevole della tab interna di Outreach** e porto lì tutti i filtri, lasciando nelle pagine solo le azioni operative.

### 1. Rendere globale la tab attiva di Outreach
In `src/contexts/GlobalFiltersContext.tsx` aggiungo stato e setter per la sezione interna attiva di Outreach, più bucket separati per i filtri di:
- **Workspace**
- **In Uscita**

Così i filtri non si mischiano tra le due viste.

### 2. Collegare il tab di Outreach al drawer
In `src/pages/Outreach.tsx` sincronizzo il tab selezionato con il `GlobalFiltersContext`.

Risultato:
- se sei su **Workspace**, il drawer mostra solo filtri Workspace
- se sei su **In Uscita**, il drawer mostra solo filtri In Uscita
- niente più pannelli sbagliati o generici

### 3. Portare i filtri di In Uscita nella sidebar
In `src/components/global/FiltersDrawer.tsx` aggiungo la sezione specifica per **In Uscita** con:
- cerca azienda/contatto
- Tutti
- Immediati
- Programmati
- Da rivedere
- Rivisti

In `src/components/sorting/SortingList.tsx` rimuovo:
- search input locale
- chip filtro locali

La lista leggerà tutto dal context globale.

### 4. Completare anche Workspace nello stesso passaggio
Già che il problema è identico, completo anche Workspace nello stesso refactoring:
- rimuovo il blocco `Collapsible` dei filtri da `src/components/workspace/ContactListPanel.tsx`
- sposto nel drawer:
  - Stato Email
  - Dati Contatto
  - Arricchimento
  - Paese

### 5. Cosa resta nelle pagine
Restano in alto solo i controlli operativi:
- **Deep Search**
- **Genera**
- **Elimina**
- **Select all / none**
- contatori e stato

I filtri spariscono dal contenuto centrale.

## Dettagli tecnici
- Nessuna modifica al database
- Nessuna modifica backend
- Il `reset` del drawer verrà reso **contestuale alla tab attiva di Outreach**, così non azzera filtri di altre sezioni per errore
- Il placeholder della ricerca nel drawer verrà adattato alla vista attiva (`Workspace` vs `In Uscita`)

## File coinvolti
| File | Azione |
|------|--------|
| `src/contexts/GlobalFiltersContext.tsx` | Aggiungere `outreachTab` + stati filtro separati per Workspace e In Uscita |
| `src/pages/Outreach.tsx` | Sincronizzare tab attiva con il context globale |
| `src/components/global/FiltersDrawer.tsx` | Mostrare filtri diversi in base a `outreachTab` |
| `src/components/sorting/SortingList.tsx` | Rimuovere toolbar filtri locale e leggere dal context |
| `src/components/workspace/ContactListPanel.tsx` | Rimuovere blocco filtri inline e leggere dal context |

## Risultato finale
Dentro Outreach avrai una UI pulita:
- **contenuto al centro**
- **filtri solo nella sidebar sinistra**
- **Mission/AI solo nella sidebar destra**
- zero duplicazioni, zero blocchi filtro sparsi nelle pagine
