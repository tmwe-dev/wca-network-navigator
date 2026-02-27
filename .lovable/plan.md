

## Analisi dei problemi ergonomici

Dopo aver esaminato il codice, ecco i problemi principali:

1. **Top bar Operations**: Titolo minuscolo, SpeedGauge/WCA Session/theme toggle ammassati senza gerarchia
2. **Stats strip globale**: Emoji brutte (🌍👥📄✉️📞📁), separatori puntini, tutto in una riga piatta senza peso visivo
3. **PartnerListPanel header**: 5 righe impilate (nome paese + stats + barra, chips contatti, chips arricchimento, search + sort, conteggio + filter bar) — troppo denso, nessun respiro
4. **Partner cards**: La citta' e' in bold come titolo primario e il nome azienda e' secondario — invertito. Flag del paese ripetuta inutilmente (siamo gia' nel contesto di un paese). Troppi elementi piccoli ammassati
5. **Wizard**: Sezione collapsible che aggiunge altro rumore quando aperta
6. **Mancanza di icone Lucide**: Si usano emoji testuali invece di icone coerenti con il design system

## Piano di redesign

### File: `src/pages/Operations.tsx`

**Top bar** — Ridisegnare come barra compatta con gerarchia:
- Sinistra: titolo "Operations" con font piu' grande + badge attivi con animazione pulse
- Centro: Strip stats globali con icone Lucide (Globe, Users, FileX, MailX, PhoneOff, FolderOpen) invece di emoji. Numeri grandi, etichette piccole sotto. Ogni stat e' una "mini-card" con bordo sottile e sfondo leggero
- Destra: WCA Session + theme toggle (invariati)
- Rimuovere SpeedGauge dalla top bar (si mostra solo quando c'e' un job attivo, nel pannello destro)

**Stats strip** — Sostituire completamente:
- Da riga piatta con emoji a una serie di "pill" compatte con icone Lucide colorate
- Ogni pill: icona + numero bold + label piccola
- Le pill "missing" usano colore rosso/ambra, le pill "ok" usano emerald
- Click su una pill filtra la CountryGrid (comportamento invariato)

### File: `src/components/operations/PartnerListPanel.tsx`

**Header paese** — Riduzione drastica a 2 righe max:
- **Riga 1**: Flag + Nome paese (font medio bold) | barra progresso inline (piu' larga, h-2) con percentuale | bottone Step wizard
- **Riga 2**: 6 mini-indicatori circolari in una riga compatta (Profilo, Email, Tel, Deep, Alias Az, Alias Ct) — ciascuno e' un cerchietto colorato (verde se completo, rosso con numero se mancante), cliccabile come filtro. Niente etichette "CONTATTI:" e "ARRICCHIMENTO:" — solo icone con tooltip
- Rimuovere le label testuali "Senza Profilo", "Senza Email" etc. Usare solo icone (FileText, Mail, Phone, Telescope, Building2, UserCircle) con badge numerico sovrapposto
- Search + sort restano sotto ma compattati

**Partner cards** — Redesign completo:
- **Nome azienda** come titolo primario (bold, testo piu' grande)
- **Citta'** come sottotitolo secondario
- Rimuovere la flag del paese (ridondante)
- **Indicatori di stato** come 4 dot colorati allineati a destra (profilo, email, tel, deep) — verde/grigio
- **Contatto primario** su una riga dedicata con nome + icone email/phone colorate
- **Trophy** anni membership come badge compatto in alto a destra
- **Rating stelle** inline con il nome
- **Alias** come tag piccolo sotto il nome azienda
- **Send email** button invariato (hover)

**Wizard** — Semplificare:
- Quando aperto, occupa meno spazio: le 3 WizardRow diventano una riga orizzontale di 3 step compatti (non verticale)
- Solo lo step attivo si espande con le opzioni di download
- Steps completati mostrano solo un check verde, non l'intera row

**FilterActionBar** — Rendere piu' visivamente prominente:
- Background con gradiente leggero e bordo colorato in base al filtro attivo
- Icona piu' grande, label piu' chiara

### File: `src/components/download/CountryGrid.tsx`

- Le country card sono ok ma le stats inline (✉ ☎) usano caratteri unicode — sostituire con micro-icone Lucide per coerenza

### Riepilogo modifiche

| File | Cosa cambia |
|------|-------------|
| `src/pages/Operations.tsx` | Top bar + stats strip: emoji → icone Lucide, layout a pill |
| `src/components/operations/PartnerListPanel.tsx` | Header compatto (2 righe max), card partner ridisegnate, wizard orizzontale, indicatori a icone |
| `src/components/download/CountryGrid.tsx` | Micro-icone Lucide al posto di ✉ ☎ unicode |

