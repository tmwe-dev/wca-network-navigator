

## Piano di Sviluppo: Partner Hub Redesign + Pulizia Database

---

### 1. Pulizia Duplicati nel Database

**Situazione attuale**: 51 aziende duplicate, 109 record in eccesso. Causati da download multipli sugli stessi network/paesi.

**Strategia**: Creare una edge function `deduplicate-partners` che:
- Identifica i duplicati per `company_name + country_code`
- Per ogni gruppo, mantiene il record con i dati piu completi (piu contatti, con `enrichment_data`, con `logo_url`, con `raw_profile_html`)
- Sposta i contatti e le relazioni (services, networks, certifications, interactions) dal record eliminato a quello mantenuto
- Elimina i record duplicati
- Logga le operazioni eseguite

**Impatto**: ~109 record rimossi, nessuna perdita di dati reali.

---

### 2. Redesign PartnerCard (lista sinistra nel Partner Hub)

**File**: `src/pages/PartnerHub.tsx` (righe 451-626, la lista inline)

Modifiche alla riga del partner nella lista sinistra:

```text
┌──────────────────────────────────────────────────────┐
│ [Logo] Citta              ┌──────┐ ┌──────────────┐ │
│        Company Name       │ 2015 │ │ 🏆 10 yrs WCA│ │
│        🇦🇺 ★★★★☆          └──────┘ └──────────────┘ │
│                                                      │
│  ✈️  🚢FCL  🚢LCL  🚚    │  ⚠️ DG  ❄️ Perish  💊   │
│  (trasporto, outline)     │  (specialita, outline)    │
│                                                      │
│  👤 John Smith  ✉️ 📞    +2                          │
│  🔗 LinkedIn  📘 Facebook                            │
│  🇮🇹 🇺🇸 🇬🇧 (branch flags)                          │
└──────────────────────────────────────────────────────┘
```

**Cambiamenti specifici**:
- Angolo in alto a destra: riquadro con anno di fondazione (member_since year) + coppa WCA con anni di anzianita
- Servizi di trasporto (aereo, mare FCL/LCL, road, rail) a sinistra con icone **outline** (non piene)
- Specialita (dangerous goods, perishables, pharma, ecommerce, relocations) a destra con icone **outline**
- Citta in grassetto come informazione primaria (gia presente)

---

### 3. Redesign PartnerDetailFull (pannello destro)

**File**: `src/components/partners/PartnerDetailFull.tsx` (667 righe)

**Struttura nuova**:

```text
┌─────────────────────────────────────────────────────┐
│ NETWORK BAR (orizzontale, loghi network WCA)        │
├─────────────────────────────────────────────────────┤
│ HEADER CARD (pulita)                                │
│ [Logo] Company Name  WCA #1234                      │
│        City, Country 🇦🇺  Freight Forwarder  HQ     │
│        ★★★★☆  🏆 10 yrs WCA                        │
│        ☎️ +61...  ✉️ info@...  🌐 website.com       │
│        🔗 LinkedIn  📘 Facebook                     │
├─────────────────────────────────────────────────────┤
│ ACTION BAR (Attivita, Deep Search, Workspace, Email)│
├─────────────────────────────────────────────────────┤
│ PROFILO AZIENDALE (testo descrizione)               │
├──────────────────────┬──────────────────────────────┤
│ LEFT COL (60%)       │ RIGHT COL (40%)              │
│                      │                              │
│ Servizi Trasporto    │ Contatti Azienda             │
│ (icone outline +     │ (telefono, email, fax,       │
│  label, orizzontali) │  indirizzo, social)          │
│                      │                              │
│ Specialita           │ Contatti Ufficio             │
│ (icone outline +     │ (nome, ruolo, email,         │
│  label)              │  telefono, WhatsApp,         │
│                      │  LinkedIn per ciascuno)      │
│                      │                              │
│ Enrichment AI        │ Branch Countries             │
│                      │                              │
│ Timeline             │ Key Markets / Routes         │
│                      │                              │
│ Promemoria           │ Mini Globe                   │
└──────────────────────┴──────────────────────────────┘
```

**Cambiamenti chiave**:
- **Network bar** in cima con loghi orizzontali (spostato da fondo colonna destra)
- **Eliminato** il blocco "Anni WCA" separato (righe 222-253) — integrato nella header card
- **Icone outline** per servizi (rimuovere `fill="currentColor"`)
- **Profilo aziendale** subito dopo action bar (spostato da meta lista)
- **Contatti** spostati nella colonna destra

---

### 4. Redesign Filtri (PartnerFiltersSheet)

**File**: `src/components/partners/PartnerFiltersSheet.tsx`

Trasformare i filtri da checkbox testuali a **chip visivi con icona + contatore colorato**:

```text
┌────────────────────────────────┐
│ 📞 Con telefono         [  6] │  (verde se attivo)
│ ✉️  Con email           [ 15] │  (verde se attivo)
│ 📞 Senza telefono       [  3] │  (rosso se attivo)
│ ✉️  Senza email         [  8] │  (rosso se attivo)
│ 🔍 Deep Search          [ 42] │  (azzurro)
│ ★★★★☆ Rating min        [---] │  (dropdown stelle)
│ ✈️  Air Freight          [  ] │  (con icona servizio)
│ 🚢 Ocean FCL             [  ] │
│ ⚠️  Dangerous Goods      [  ] │
│ ...                           │
└────────────────────────────────┘
```

**Cambiamenti**:
- Ogni filtro ha icona grande + label + contatore numerico
- Colore verde/rosso per indicare con/senza
- Servizi con la propria icona (da `ServiceIcons.ts`)
- Rating con dropdown stelline invece di slider

---

### 5. File coinvolti e ordine di esecuzione

| Step | File | Descrizione |
|------|------|-------------|
| 1 | `supabase/functions/deduplicate-partners/index.ts` | Nuova edge function per pulizia duplicati |
| 2 | `src/pages/PartnerHub.tsx` (righe 451-626) | Redesign riga lista con anni/coppa e separazione servizi |
| 3 | `src/components/partners/PartnerDetailFull.tsx` | Riorganizzazione layout: network in cima, profilo dopo action bar, contatti a destra, eliminare blocco anni separato |
| 4 | `src/components/partners/PartnerFiltersSheet.tsx` | Chip visivi con icone colorate e contatori |
| 5 | `src/components/partners/shared/ServiceIcons.ts` | Nessuna modifica (gia pronto) |

**Nessun file esistente funzionante viene eliminato o riscritto da zero** — tutte le modifiche sono incrementali.

---

### 6. Riepilogo duplicati trovati

| Azienda | Paese | Copie |
|---------|-------|-------|
| Express Air Freight | US | 7 |
| ACE Global Logistics | AU | 5 |
| BTX Global Logistics | US | 5 |
| Rush Cargo S.R.L. | AR | 5 |
| John S. James Co. | US | 5 |
| Coppersmith Global Logistics | US | 5 |
| 1UP CARGO | AU | 5 |
| + altre 44 aziende | vari | 2-4 |

**Totale**: 51 aziende duplicate, 109 record da rimuovere.

