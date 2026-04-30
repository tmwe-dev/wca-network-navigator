## Problema osservato

Nello screenshot la lista contatti (tab Elenco di **Contatti**) ha due problemi:

1. **Ordine colonne sbagliato**: prima colonna grande = **Località** (paese/città/CAP), poi Azienda, poi Contatto. Per i biglietti da visita invece il pattern è già **Azienda+Contatto a sinistra**, Località come info secondaria.
2. **"Mondi e mondini"**: per ogni riga senza paese viene mostrato un riquadro col globo/bandiera bianca `🏳` come placeholder. Anche quando il paese è ignoto la cella resta visibile e occupa spazio. Risultato: tante righe identiche col globo blu generico.

## Cosa fare — solo UI, una sola passata

### 1. Allineare la lista contatti al pattern dei biglietti

Nuovo ordine colonne (lo stesso "look" della `CompactRow` BCA che già piace all'utente):

```text
[#☐]  [AZIENDA + ruolo + contatto]   [Località compatta]   [Email/quick]   [Stato + Score]   [Azioni]
```

Cioè:
- **Col 1** (`64px`): index `#N` + checkbox (invariato).
- **Col 2** (grande, `minmax(220px,1.6fr)`): **AZIENDA in alto** (bold, uppercase) + bandiera piccola inline accanto al nome azienda *solo se* il paese è noto. **Sotto**: nome contatto + ruolo (`Sigra Elena · Operations`).
- **Col 3** (`minmax(160px,200px)`): Località compatta — `Paese · Città · CAP` su una riga sola, ammessa anche solo `Città` o solo `Paese`. Nessuna icona globo, nessun riquadro.
- **Col 4** (`minmax(180px,1.2fr)`): Email + (sotto) telefono/origine — invariato il contenuto, solo cambia la posizione.
- **Col 5** (`minmax(140px,160px)`): Stato + Score + indicatori (LinkedIn, Sito, Business Card) — invariato.
- **Col 6** (`72px`): Azioni (search + kebab) — invariato.

La cella "bandiera grande dedicata" (oggi col 2 da 48px) **viene rimossa**: la bandiera diventa un'emoji piccola inline accanto al nome azienda, e solo quando il paese è davvero noto.

Il header della lista (`ContactListPanel`) si aggiorna di conseguenza: header `AZIENDA / LOCALITÀ / CONTATTO / STATO`.

### 2. Eliminare i "mondi e mondini"

Regola dura: **se `country` è null/vuoto/non riconosciuto, non mostrare nulla** (né bandiera, né globo, né placeholder `🏳`). La cella semplicemente non emette markup. Niente più riquadri grigi col mondo blu generico ripetuto su ogni riga.

Lo stesso vale per la cella Località: se mancano paese, città e CAP, la colonna resta vuota (no `—`). Se manca solo il paese ma c'è la città, mostra solo la città.

### 3. Ordine di lettura per l'occhio

Pattern visivo finale (riga tipica):

```text
#1  ☐   ACME LOGISTICS  🇮🇹              Roma · 00100      ✉ info@acme.it    ●NEW  ★74    [🔍 ⋯]
        Sigra Elena · Operations Manager                    📞 +39 06 …       💬 0
```

Riga senza paese:

```text
#2  ☐   D-INGREDIENTS                    Milano            ✉ amministra…     ●…     [🔍 ⋯]
        Sig Ravelli
```

## File toccati (solo presentazione, zero logica)

1. `src/components/contacts/contactGridLayout.ts`
   - `CONTACT_GRID_COLS` aggiornato: rimuovo la colonna 48px della bandiera, ricompongo come 6 colonne (vedi sopra).

2. `src/components/contacts/ContactCard.tsx`
   - Rimuovo la cella "bandiera grande" dedicata (righe ~115-120).
   - Sposto Azienda+Contatto in seconda posizione (prima colonna larga).
   - La bandiera diventa una piccola emoji inline accanto al nome azienda, **renderizzata solo se `flag` è vero** (helper `countryFlag` già ritorna stringa vuota quando il paese non è mappato — basta non mostrare il fallback `🏳`).
   - Località compatta su una riga: `Paese · Città · CAP` con elementi opzionali (omessi se mancanti, niente `—`).
   - Niente cambi a Stato/Score/Azioni.

3. `src/components/contacts/ContactListPanel.tsx`
   - Aggiorno l'header riga (label colonne) per riflettere il nuovo ordine: `AZIENDA / LOCALITÀ / CONTATTO / STATO` + ordinamenti corrispondenti (sort `company` su col grande, `country` su Località).
   - I campi sortabili e i filtri inline restano gli stessi, cambia solo la posizione visiva.

4. `src/components/contacts/contactHelpers.ts` (solo se serve)
   - Verifico che `countryFlag` ritorni `""` (non `🏳`) per paesi sconosciuti. Se ritorna placeholder, lo cambio a stringa vuota.

## Cosa NON cambia

- Hook `useContactListPanel`, dataset, filtri, segmenti, paginazione, dettaglio a destra: invariati.
- Le altre liste (CRM su altre pagine, Network, Biglietti): invariate.
- Logica di sort, filtri inline `Filterable`: invariata, solo riposizionata.

## Verifica post-implementazione

- La prima colonna larga è **Azienda (uppercase) + Contatto sotto**, come nei biglietti.
- Le righe senza paese **non mostrano** né globo né bandiera bianca. Nessun riquadro placeholder.
- La cella Località mostra solo i pezzi noti (paese/città/CAP), separati da `·`.
- Header colonne aggiornato e sort funziona sui campi giusti.
- Nessuna regressione in dettaglio contatto, drawer, azioni, deep search.
