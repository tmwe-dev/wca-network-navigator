## Obiettivo

Unificare l'accesso alle 3 viste anagrafiche (WCA Partner, Biglietti, CRM) attraverso **icone in top bar** sullo stile di "WCA Partner" (globo che gira + contatore), eliminando 2 voci dalla sidebar e ripulendo l'header pesante della pagina Network.

---

## Parte A — Top bar: 3 icone "Anagrafica" (con contatori)

Oggi la top bar ha già uno slot dinamico (`#campaign-header-controls`) in cui la pagina Network inietta il blocco "🌐 WCA Partner · 12286 partner".

**Nuovo comportamento:** quando l'utente è su una qualsiasi delle 3 viste anagrafiche, la top bar mostra **3 pill cliccabili affiancate**, una per ciascuna anagrafica, con icona animata + label + contatore + indicatore della pill attiva:

```text
[ 🌐  WCA Partner  · 12.286 ]   [ 🪪  Biglietti · 1.342 ]   [ 👥  CRM · 11.349 ]
   (attiva, sottolineata)            (cliccabile)              (cliccabile)
```

- **WCA Partner** → 🌐 globo che gira (icona attuale, invariata) → naviga `/v2/explore/network`
- **Biglietti** → 🪪 `Contact` (lucide) con micro-pulsazione → naviga `/v2/pipeline/biglietti`
- **CRM** → 👥 `Users` con micro-pulsazione → naviga `/v2/pipeline/contacts`

I tre contatori (`partners.total`, `business_cards.total`, `imported_contacts.total`) vengono caricati una sola volta tramite un nuovo hook `useAnagraphicsCounts` (cache TanStack Query, staleTime 5 min, già copre i 3 endpoint che le viste interne richiamano).

La pill attiva è evidenziata con sottolineatura primary + sfondo `bg-primary/10`; le altre due restano cliccabili con hover discreto. Le label scompaiono sotto i 768px (rimangono solo icona + numero).

---

## Parte B — Sidebar: rimuovere 2 voci

Nel file `navConfig.tsx` la lista oggi contiene 11 voci. Rimuoviamo:

- ❌ `nav.crm_contacts` → `/v2/pipeline/contacts`
- ❌ `nav.business_cards` → `/v2/pipeline/biglietti`

Resta `nav.wca_partners` come "Anagrafica" (unico ingresso da menu, le altre due si raggiungono dalla top bar). I due path restano ovviamente raggiungibili da:
1. le pill della top bar (Parte A);
2. il tab "Biglietti" interno alla sezione Pipeline (per chi entra dalla pipeline);
3. i deep-link interni esistenti.

Risultato: sidebar passa da 11 a 9 voci.

---

## Parte C — Pulizia "riga inutile" su Network (`PartnerListPanel`)

Oggi la prima riga del pannello ripete: bandiera + "Tutti i paesi" + "12286 partner" + filtro Deep Search. Tutto duplicato rispetto alla top bar.

**Cosa cambia:**

1. **Eliminata** la prima riga "🌍 Tutti i paesi · 12286 partner" → quando non c'è una selezione di paese, la riga non appare. Quando l'utente seleziona uno o più paesi, riappare in forma minimale: `🇮🇹 Italia · 234 partner` (solo se filtro paese attivo, perché in quel caso aggiunge informazione).
2. **Eliminato** il duplicato del totale partner (è in top bar).
3. **Riga 3 "Tutti / Nascondi in circuito"** viene **promossa in alto** (subito sotto i tab Mappa/Sherlock) e diventa più evidente:
   - lo switch "Nascondi in circuito (N)" usa testo più leggibile e sfondo `bg-card/40 border` per dargli rilievo;
   - "Seleziona tutti" resta a sinistra dello switch.
4. **Mantenuto**: chip filtri attivi (search, paesi, qualità) + dropdown ordinamento + pulsante reset + counter `N / totale`. Questa è l'unica riga "operativa" che resta.

Rispetto a oggi: da 3 righe header a **1 riga di filtri + 1 riga toggle "in circuito"** (oppure 0+1 se nessun filtro attivo).

---

## Parte D — Allineamento estetico Biglietti & CRM

Per coerenza visiva con Network, anche `BusinessCardsHub` e `ContactListPanel` perdono eventuali ripetizioni del totale globale e, dove presente, della riga "Tutti i paesi" (lavoro analogo a Parte C, scope limitato alla rimozione dei duplicati: **niente refactor invasivi** della logica filtri).

---

## Dettagli tecnici

- **Nuovo file** `src/v2/ui/templates/header/AnagraphicsPills.tsx` — componente che renderizza le 3 pill, riceve i 3 conteggi e l'attiva (derivata da `useLocation`).
- **Nuovo hook** `src/v2/hooks/useAnagraphicsCounts.ts` — query parallele `count()` su `partners`, `business_cards`, `imported_contacts`.
- **Modificato** `src/components/operations/OperationsView.tsx` (`HeaderBarPortal`) — sostituisce il blocco "WCA Partner" attuale con `<AnagraphicsPills active="partners" />`.
- **Aggiunto** un equivalente `HeaderBarPortal` in `BusinessCardsHub.tsx` e nella vista `Contatti CRM` (`ContactListPanel.tsx` o wrapper) per montare le stesse pill con `active="biglietti"` / `active="crm"`.
- **Modificato** `navConfig.tsx` — rimosse le 2 voci.
- **Modificato** `PartnerListPanel.tsx` — eliminata la prima riga header come da Parte C.

Nessuna modifica a logica di business, RLS, edge functions o DAL.
