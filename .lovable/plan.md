

# Piano: Azioni Bulk, Filtro "Non Lavorati", Bordo Verde, Carousel Attività, Icone Smart, Fix LinkedIn Send

## Richieste dell'utente (sintesi)

1. **Azioni bulk** (segna come svolta, telefonata, meeting, nota, programma) disponibili quando si selezionano più card
2. **Filtro "non lavorati"**: nascondere i contatti già lavorati oggi, oppure mostrarli con bordo verde
3. **Bordo verde** sulla card dopo invio messaggio/attività completata
4. **Mini-carousel attività** sopra le card: miniature orizzontali delle attività svolte oggi, cliccabili per riaprire
5. **Icone canale smart**: LinkedIn/WhatsApp/Email attive (colorate) solo se il dato reale esiste (URL LinkedIn trovato, email presente, telefono confermato)
6. **Conferma parità operazioni workspace**: bulk actions nel Cockpit come nel vecchio Workspace
7. **Fix invio LinkedIn**: non funziona

---

## 1. Azioni Bulk nel Cockpit

**File: `src/components/cockpit/ContactStream.tsx`**
- Aggiungere nella barra bulk (quando `selectionCount > 0`) i bottoni:
  - "✓ Svolta" (dropdown: Telefonata, Meeting, Altro) — come il `ContactActionMenu` ma bulk
  - "📝 Nota" — apre dialog nota per tutti i selezionati
  - "📅 Programma" — apre dialog programma per tutti i selezionati
- Creare componente `BulkActionMenu` che riusa la logica di `ContactActionMenu.createActivity` ma itera su tutti gli ID selezionati

**File: `src/components/cockpit/BulkActionMenu.tsx`** (nuovo)
- Accetta `selectedContacts: CockpitContact[]` 
- Espone le stesse azioni di `ContactActionMenu` ma le esegue in batch (loop su tutti i contatti)
- Dopo completamento, invalida le query e chiama `onClear()`

**File: `src/pages/Cockpit.tsx`**
- Passare i contatti selezionati e i callback bulk a `ContactStream`

## 2. Filtro "Non Lavorati" + Bordo Verde

**File: `src/hooks/useWorkedToday.ts`** (già esiste)
- Già restituisce un `Set<string>` di partner IDs con attività oggi — va esteso per supportare anche contatti (`source_type = 'contact'`)

**File: `src/components/cockpit/ContactStream.tsx`**
- Aggiungere toggle/filtro "Nascondi lavorati" sopra la lista
- Quando attivo, filtra via i contatti il cui `sourceId` è in `workedIds`
- Quando disattivato, i contatti lavorati mostrano bordo verde (`border-emerald-500`)

**File: `src/components/cockpit/CockpitContactCard.tsx`**
- Aggiungere prop `isWorked: boolean`
- Se `isWorked === true`: bordo `border-emerald-500/60` e leggera sfumatura verde

## 3. Mini-Carousel Attività Svolte Oggi

**File: `src/hooks/useTodayActivities.ts`** (nuovo)
- Query sulla tabella `activities` per `created_at >= oggi` e `status = 'completed'`
- Restituisce array di attività con `source_id`, `activity_type`, `title`, `source_meta`

**File: `src/components/cockpit/TodayActivityCarousel.tsx`** (nuovo)
- Barra orizzontale scrollabile sopra le card (larghezza colonna)
- Ogni attività = miniatura compatta (icona tipo + nome contatto, ~40px di altezza)
- Click su miniatura → espande dettaglio (o riapertura modale)
- Overflow: scroll orizzontale, non va oltre la larghezza colonna

**File: `src/components/cockpit/ContactStream.tsx`**
- Inserire `TodayActivityCarousel` sopra la lista dei contatti

## 4. Icone Canale Smart (Passaporto)

**File: `src/components/cockpit/CockpitContactCard.tsx`**
- Cambiare la sezione "channels" da `contact.channels` (statico) a verifica dati reali:
  - **Email**: attiva (colore primary) se `contact.email` non vuoto
  - **LinkedIn**: attiva (colore `#0077B5`) se `contact.linkedinUrl` non vuoto
  - **WhatsApp**: attiva (colore verde) se `contact.phone` non vuoto
  - **SMS**: attiva se telefono presente
- Icone inattive: `text-muted-foreground/30` (grigio spento)
- Icone attive: colore pieno del canale

**File: `src/hooks/useCockpitContacts.ts`**
- Assicurarsi che `linkedinUrl` sia esposto nel `CockpitContact` (già presente)

## 5. Fix Invio LinkedIn

**Problema identificato**: La funzione `handleSendLinkedIn` in `AIDraftStudio.tsx` (riga 225) chiama `liBridge.sendDirectMessage(profileUrl, plainText)` che invia un `postMessage` con action `sendMessage`. Il bridge funziona via `window.postMessage` verso l'estensione Chrome. I possibili problemi:
- L'estensione potrebbe non gestire l'action `sendMessage` (mismatch nome azione)
- Il `profileUrl` potrebbe essere vuoto se non è stato trovato durante la Deep Search
- Timeout di 60s senza feedback intermedio

**Fix in `src/components/cockpit/AIDraftStudio.tsx`**:
- Aggiungere logging dettagliato prima dell'invio per debug
- Verificare che `profileUrl` sia valido prima di tentare
- Se l'estensione non è disponibile E c'è un URL, aprire direttamente la pagina LinkedIn con il messaggio copiato negli appunti (fallback)
- Mostrare toast con dettaglio dell'errore dal bridge

**Fix in `src/hooks/useLinkedInExtensionBridge.ts`**:
- Aggiungere console.log nel `sendMessage` per tracciare richieste e risposte
- Verificare che l'action name `sendMessage` corrisponda a quello atteso dall'estensione

---

## Riepilogo File

| File | Azione |
|------|--------|
| `src/components/cockpit/BulkActionMenu.tsx` | Nuovo — azioni bulk |
| `src/components/cockpit/TodayActivityCarousel.tsx` | Nuovo — carousel attività oggi |
| `src/hooks/useTodayActivities.ts` | Nuovo — hook attività oggi |
| `src/components/cockpit/ContactStream.tsx` | Modifica — bulk actions, filtro lavorati, carousel |
| `src/components/cockpit/CockpitContactCard.tsx` | Modifica — bordo verde, icone smart |
| `src/components/cockpit/AIDraftStudio.tsx` | Modifica — fix LinkedIn send |
| `src/hooks/useLinkedInExtensionBridge.ts` | Modifica — debug logging |
| `src/hooks/useWorkedToday.ts` | Modifica — supporto contatti |
| `src/pages/Cockpit.tsx` | Modifica — wiring nuovi props |

