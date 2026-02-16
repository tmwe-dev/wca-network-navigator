

# Miglioramenti Country Cards, Pannello Partner e Tab Acquisisci

## Problemi Identificati

### 1. Country Cards: icone poco chiare
Attualmente le card mostrano `Users 45/120` e `Mail 25` ma manca l'icona Phone per i telefoni. I dati sono compressi e non immediatamente leggibili.

### 2. Pannello Partner (destra): informazioni insufficienti
Quando si seleziona un paese, il tab Partner mostra solo la lista dei singoli partner con i loro contatti individuali. Non c'e' un riepilogo aggregato del paese (quanti partner, quanti con profilo, quanti con email/telefono) che rispecchi le info della card a sinistra.

### 3. Tab Scarica: nessuna menzione dei profili
L'ActionPanel dice "Ri-scarica anche i 3 esistenti" ma non distingue tra partner con profilo e senza profilo. L'utente non sa se deve ri-scaricare per ottenere i profili mancanti. Serve un selettore per scegliere COSA scaricare (tutto, solo profili mancanti, solo nuovi).

### 4. Tab Acquisisci: link inutile a pagina separata
La tab mostra solo un link a /acquisizione. La pagina AcquisizionePartner.tsx (1234 righe) e' un modulo complesso con pipeline, coda partner, canvas, bridge con estensione Chrome. Non ha senso tenerla separata se l'Operations Center e' il punto unico di lavoro.

## Piano di Implementazione

### Fase 1: Country Cards con icone chiare

Aggiungere nella card paese una riga con 3 micro-indicatori con icone esplicite:
- `Users` icona + numero partner / directory
- `Mail` icona + numero con email (colorata: verde se >80%, arancione se >50%, rossa altrimenti)  
- `Phone` icona + numero con telefono (stessa logica colore)
- Mantenere il badge profilo mancante (`!Xp`) gia' presente

File: `src/components/download/CountryGrid.tsx` -- aggiornare la sezione stats nella CountryCard per includere Phone con icona dedicata.

### Fase 2: Header riepilogativo nel Pannello Partner

Aggiungere un blocco riepilogo in cima al PartnerListPanel che mostri le stesse metriche della card paese, piu' dettagliate:
- Totale partner nel DB
- Con profilo / Senza profilo (con barra progresso)
- Con email / Senza email
- Con telefono / Senza telefono
- Qualita' contatti (completi/parziali/mancanti)

Questi dati sono gia' disponibili tramite `useCountryStats` -- basta passare i `countryCodes` e leggere i dati aggregati.

File: `src/components/operations/PartnerListPanel.tsx` -- aggiungere un header con stats aggregate prima della lista partner.

### Fase 3: ActionPanel con opzioni di download granulari

Aggiungere nel pannello Scarica un selettore per il tipo di download:
- "Nuovi partner" (default): scarica solo gli ID non presenti nel DB
- "Solo profili mancanti": ri-scarica solo i partner che hanno `without_profile > 0` (cioe' manca `raw_profile_html`)
- "Aggiorna tutti": ri-scarica tutti i partner esistenti

Mostrare chiaramente i conteggi:
- "X partner nella directory"
- "Y gia' scaricati (di cui Z senza profilo)"
- "W da scaricare"

Il conteggio "senza profilo" viene da `useCountryStats` gia' disponibile.

File: `src/components/download/ActionPanel.tsx` -- sostituire il checkbox "Ri-scarica esistenti" con un Select a 3 opzioni e mostrare il conteggio profili mancanti.

### Fase 4: Rimuovere tab Acquisisci (link a pagina separata)

La tab "Acquisisci" attualmente mostra solo un link alla pagina /acquisizione. Poiche' l'acquisizione richiede l'estensione Chrome con una pipeline complessa (1200+ righe), non ha senso integrarla inline. Tuttavia il semplice link e' confuso.

Soluzione: rimuovere la tab "Acquisisci" dal pannello contestuale. La pagina /acquisizione resta accessibile dalla sidebar di navigazione. Questo semplifica l'interfaccia Operations e riduce la confusione.

File: `src/pages/Operations.tsx` -- rimuovere la TabsTrigger e TabsContent "acquire", rimuovere il componente AcquisitionLink.

## Dettagli Tecnici

### CountryGrid.tsx -- Fase 1
- Nella CountryCard, aggiungere `<Phone>` icona accanto a `<Mail>` nella riga stats
- Colorare le icone in base alla copertura: verde (>80%), arancione (>50%), rossa (<50%)
- I dati `with_phone` sono gia' disponibili nel `stats[country.code]`

### PartnerListPanel.tsx -- Fase 2
- Importare `useCountryStats` hook
- Aggiungere un blocco `CountrySummary` prima della SearchBar con 4-5 mini indicatori
- Layout: riga orizzontale con icone + numeri + barre progresso compatte

### ActionPanel.tsx -- Fase 3
- Aggiungere `useCountryStats` per ottenere il conteggio `without_profile`
- Sostituire il checkbox `includeExisting` con un Select: "Nuovi" | "Profili mancanti" | "Tutti"
- Filtrare `idsToDownload` in base alla selezione: per "profili mancanti", serve una query ai partner senza `raw_profile_html` per ottenere i `wca_id` corrispondenti
- Mostrare nel riepilogo: "Y scaricati (Z senza profilo)"

### Operations.tsx -- Fase 4
- Rimuovere la tab "acquire" e il componente AcquisitionLink
- Rimangono solo 2 tab: "Partner" e "Scarica"

