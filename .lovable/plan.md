

# Refactoring Partner Hub: Scatole Cinesi (Navigazione a Livelli)

## Concetto

Sostituire l'interfaccia attuale (tutto visibile insieme) con una navigazione a livelli progressivi. L'utente vede solo quello che serve nel momento in cui serve, e puo tornare indietro.

```text
LIVELLO 1: Panoramica Paesi
+--------------------------------------------------+
|  Partner Hub                    [eventi attivi]   |
+--------------------------------------------------+
|  [Cerca paese...]                                 |
+--------------------------------------------------+
|  IT Italia        312 partner                     |
|  ████████████░░  87% profili  |  156 tel  98 mail |
|                                                   |
|  DE Germania      89 partner                      |
|  ████████████████ 100%        |  67 tel   54 mail |
|                                                   |
|  US Stati Uniti   45 partner                      |
|  ██████░░░░░░░░  42% profili  |  12 tel   8 mail  |
|  ⚠ 26 senza profilo - [Scarica profili]           |
+--------------------------------------------------+

LIVELLO 2: Scheda Paese (click su un paese)
+--------------------------------------------------+
|  ← Torna ai Paesi     IT Italia                  |
+--------------------------------------------------+
|  RIEPILOGO                                        |
|  312 totali | 272 con profilo | 40 SENZA PROFILO  |
|  156 con telefono | 98 con email                  |
|  [Scarica 40 profili mancanti]                    |
+--------------------------------------------------+
|  FILTRA E LAVORA                                  |
|  [Tutti 272] [Con Tel 156] [Con Email 98]         |
|  [Senza Tel 116] [Senza Email 174]                |
+--------------------------------------------------+
|  Lista filtrata: 156 partner        [Sel. tutti]  |
|  ☐ Acme Logistics - Roma  ✉ ☎                    |
|  ☐ Beta Transport - Milano  ✉                    |
|  ...                                              |
+--------------------------------------------------+
|  [3 selezionati] [Email] [Deep Search] [WhatsApp] |
+--------------------------------------------------+

LIVELLO 3: Dettaglio Partner (click su un partner)
+--------------------------------------------------+
|  ← Torna a Italia                                 |
|  Scheda completa del partner (come ora)            |
+--------------------------------------------------+
```

## Struttura Tecnica

### Stato di navigazione

Un singolo stato `viewLevel` controlla cosa viene mostrato:
- `"countries"` → griglia paesi con statistiche
- `"country"` → scheda paese con filtri e lista partner
- Quando si clicca un partner, il pannello destro mostra il dettaglio (come ora)

### File da modificare

#### 1. `src/pages/PartnerHub.tsx` - Logica di navigazione

Sostituire il toggle `viewMode: "list" | "country"` con `viewLevel: "countries" | "country"` e `selectedCountry: string | null`.

Il pannello sinistro mostra:
- **Livello "countries"**: nuovo componente `CountryCards` (griglia di card-paese con statistiche)
- **Livello "country"**: nuovo componente `CountryWorkbench` (scheda paese + filtri + lista partner filtrata)

Il pannello destro resta invariato (dettaglio partner).

In alto, una barra mostra gli **eventi attivi** (deep search in corso, download attivi) in modo compatto.

#### 2. Nuovo `src/components/partners/CountryCards.tsx` - Livello 1

Griglia scrollabile di card per paese. Ogni card mostra:
- Bandiera + nome paese
- Numero totale partner
- Barra progresso profili (con/senza `raw_profile_html`)
- Contatori: con telefono, con email
- Se ci sono partner senza profilo: warning + pulsante "Scarica profili"
- Ricerca e ordinamento (per nome, totale, completamento)

Dati: usa `usePartners()` esistente, raggruppa client-side per `country_code`. Per i conteggi profilo/telefono/email, itera su `partner_contacts` e `raw_profile_html`.

#### 3. Nuovo `src/components/partners/CountryWorkbench.tsx` - Livello 2

Riceve il `countryCode` selezionato. Contiene:

**Intestazione**: pulsante "Torna ai Paesi", bandiera + nome paese

**Riepilogo** (card con numeri grandi):
- Totali, con profilo, senza profilo (evidenziato rosso se > 0)
- Con telefono, con email
- Pulsante "Scarica profili mancanti" se senza profilo > 0

**Filtri rapidi** (chips mutuamente esclusivi):
- Tutti (con profilo) | Con Telefono | Con Email | Senza Telefono | Senza Email
- Ogni chip mostra il conteggio

**Lista partner filtrata**:
- Checkbox per selezione multipla
- Nome, citta, icone contatto (mail/phone presenti o assenti)
- Contatore "X partner" in base al filtro attivo

**Barra azioni** (in basso, visibile se selezione > 0):
- Contatore selezionati
- Pulsanti: Email, Deep Search, WhatsApp
- Usa `BulkActionBar` esistente

#### 4. Eliminare `src/components/partners/CountryOverview.tsx`

Il vecchio componente viene sostituito dai due nuovi. Puo essere rimosso.

#### 5. Barra eventi attivi

Piccola barra in alto nel pannello sinistro che mostra operazioni in corso:
- Deep Search: "Deep Search 3/12..." con progress bar
- Download attivi: "Scaricando IT..." (se integrato con download jobs)

Usa lo stato `deepSearching` / `deepSearchProgress` gia presente.

### Flusso utente

1. Apre Partner Hub → vede tutti i paesi con statistiche chiare
2. Clicca "Italia" → vede la scheda Italia con riepilogo e filtri
3. Clicca "Con Telefono" → vede solo i 156 partner con telefono
4. Seleziona 20 partner con checkbox → appare barra azioni
5. Clicca "Email" → va all'Email Composer con quei 20
6. Torna indietro → ritrova la scheda Italia
7. Clicca un partner → dettaglio nel pannello destro

### Dettagli implementativi

- I filtri nel `CountryWorkbench` sono puramente client-side (filtra l'array dei partner del paese)
- Il conteggio "senza profilo" si basa su `raw_profile_html === null`
- Il conteggio "con telefono" si basa su `partner_contacts.some(c => c.mobile || c.direct_phone)`
- Il conteggio "con email" si basa su `partner_contacts.some(c => c.email)`
- La query `usePartners` esistente viene riusata; quando si entra nel livello paese, si filtrano i partner per `country_code` client-side
- Il pulsante "Scarica profili mancanti" puo navigare all'Operations Center con il paese preselezionato, oppure avviare direttamente un job di download

