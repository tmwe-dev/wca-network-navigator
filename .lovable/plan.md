## Obiettivo

Adottare lo **stile delle card BCA** (Biglietti) come template grafico unico per:
- WCA Partner → vista **"Classica"** (`Operations` / `PartnerListPanel`)
- Contatti CRM → vista **"Classica"** (`ContactListPanel` / `ContactCard`)

La vista "Card-azienda" (`CompanyCardList`) resta com'è. Modifiche **solo grafiche**, nessun cambio di logica/dati.

## Principi guida (estratti dal messaggio utente)

1. **Una sola bandiera** per riga, **2× più grande** (≈32×32px invece di ~16px), con **sotto il codice/nome del paese**, affiancata orizzontalmente.
2. **Città allineata a sinistra** in colonna a destra, insieme a coppa WCA, badge holding ✈️, icone canali (Mail/WhatsApp/LinkedIn/Phone) — stesso pattern visivo dei BCA card.
3. **Holding pattern (✈️ pulsante)** sempre visibile quando attivo, sia in Contatti CRM che in WCA Partner (oggi manca).
4. **Toolbar sopra la lista**: sort + filtri rapidi visibili e accessibili (esiste già `UnifiedListToolbar`, va riusato anche su WCA Partner classica).
5. Eleganza tipo "BCA card grande" — stesso `rounded-xl`, gradient sottile, accent border sinistro.

## Struttura riga ridisegnata (template comune)

```text
┌───┬──────┬────────────────────────────────┬──────────────────────────┐
│ ☑ │ 🇨🇳   │ COMPANY NAME [WCA]🏆4 ✈️       │ Shanghai · 📧 💬 🔗 ☎     │
│   │ CHN  │ Contact Name · Position         │ Lead status · score · ⋯  │
└───┴──────┴────────────────────────────────┴──────────────────────────┘
```

- Col 1: checkbox + index
- Col 2: **bandiera grande (32px)** + codice paese 3-lettere sotto
- Col 3 (flex): azienda + badge WCA/coppa + ✈️ holding + posizione/contatto
- Col 4 (destra, allineato sinistra): città · icone canali · status · score · menu

## Piano di lavoro (solo presentation layer)

### Fase 1 — Atom condiviso `EntityRowFlag`
File nuovo: `src/v2/ui/atoms/EntityRowFlag.tsx`
- Props: `countryCode`, `size?: "lg" | "md"`.
- Renderizza emoji bandiera 28–32px + codice ISO sotto in 9px uppercase muted.
- Riusa `countryCodeToFlag` esistente.

### Fase 2 — Atom condiviso `ChannelIcons`
File nuovo: `src/v2/ui/atoms/ChannelIcons.tsx`
- Props: `email`, `phone`, `whatsapp`, `linkedin`, `website`, `unread?`.
- Stessi colori usati in `ContactSubCard.tsx` (mail primary, WA emerald, LI sky).
- Una sola riga di icone 12×12, gap-1.

### Fase 3 — Refactor grafico `ContactCard.tsx` (Contatti CRM "Classica")
- **Rimuovere** la doppia rappresentazione paese (oggi: bandiera in col 2 + nessun nome paese sotto in modo evidente). Sostituire con `EntityRowFlag size="lg"`.
- Spostare la **città** in colonna destra (oggi è col 5 centrale): allineata sinistra dentro la colonna right.
- Aggiungere **`ChannelIcons`** accanto alla città (mail/phone/linkedin/website già presenti in `enrichment_data`, non leggere altre fonti).
- Garantire che **`HoldingPatternBadge` ✈️** sia visibile sempre quando in holding (già usato, verificare animazione `animate-pulse` come in BCA).
- Aggiornare `CONTACT_GRID_COLS` in `contactGridLayout.ts` per riflettere il nuovo layout: `42px 56px minmax(180px,1fr) minmax(160px,0.8fr) 80px`.
- Mantenere intatti props, callback, drawer, filtri inline.

### Fase 4 — Refactor grafico vista "Classica" WCA Partner
File da toccare: `src/components/operations/PartnerVirtualList.tsx` (e/o `PartnerListPanel.tsx`).
- Sostituire la riga partner attuale con un componente nuovo `PartnerRowCard.tsx` (in `src/components/operations/partner-list/`) che usa lo stesso template di `ContactCard` aggiornato:
  - `EntityRowFlag` grande
  - Nome azienda + 🏆 anni WCA + ✈️ holding (se applicabile)
  - Città allineata destra-sinistra
  - `ChannelIcons` (email/website/phone/linkedin presenti in partner)
- **Aggiungere `UnifiedListToolbar`** sopra la lista (sort + filter chips), come già fa `ContactListPanel`. Riutilizza `useActiveFilterChips("wca")` se esiste; altrimenti fase secondaria (vedi sotto).

### Fase 5 — Holding Pattern visibile su WCA Partner
- Nei dati partner verificare il flag/derivato già usato in `useWcaPartnersAsCompanies` (`meta.holding`).
- Esportare lo stesso indicatore ✈️ pulsante nel nuovo `PartnerRowCard`.

### Fase 6 — Toolbar unificata su WCA Partner Classica
Se `useActiveFilterChips("wca")` non esiste come variante, aggiungerlo in `src/components/shared/entity-toolbar/useActiveFilterChips.ts` (solo presentazione: leggere `gf.country`, `gf.holdingMode`, `gf.wcaYears`, ecc.). Nessuna nuova logica di filtraggio.

### Fase 7 — Rimozione doppione bandiera
- Audit: cercare ogni occorrenza di doppia bandiera nelle righe (es. `countryFlag` + `countryCodeToFlag` nello stesso componente). Se ne troviamo altre, eliminarle.

## Dettagli tecnici

- **Niente cambi a hook, DAL, query, edge function**. Solo file in `src/components/contacts/`, `src/components/operations/`, `src/v2/ui/atoms/`.
- Tailwind tokens semantici (no colori hardcoded, HSL via design system).
- Virtualizzazione esistente preservata: aggiornare solo l'altezza stimata della riga (passare da ~56 a ~64 per ospitare la bandiera grande).
- Test esistenti che asseriscono presenza di `countryFlag` o classi specifiche vanno aggiornati di conseguenza (`src/test/contact-helpers.test.ts`, `src/test/groupByCountry.test.ts` se toccati — non previsto).

## File previsti (creazione/modifica)

Creazione:
- `src/v2/ui/atoms/EntityRowFlag.tsx`
- `src/v2/ui/atoms/ChannelIcons.tsx`
- `src/components/operations/partner-list/PartnerRowCard.tsx`

Modifica (solo JSX/className):
- `src/components/contacts/ContactCard.tsx`
- `src/components/contacts/contactGridLayout.ts`
- `src/components/operations/PartnerVirtualList.tsx`
- `src/components/operations/PartnerListPanel.tsx` (toolbar wrap)
- `src/components/shared/entity-toolbar/useActiveFilterChips.ts` (variante "wca", se mancante)

## Out-of-scope (per chiarezza)

- Nessuna modifica al detail drawer o ai dati esposti.
- Nessuna modifica alla vista "Card-azienda" (già conforme).
- Nessuna modifica alla vista BCA (è il template di riferimento, resta intoccata).
- Nessuna modifica a sort/filter logic — solo presentazione della toolbar.

## Domanda di conferma

Procedo con tutte le 7 fasi in un unico passaggio, o preferisci che parta solo dalla **Fase 3 (Contatti CRM Classica)** così possiamo validare lo stile prima di applicarlo anche a WCA Partner?