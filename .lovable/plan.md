

## Audit completo dei contatori Operations

### Problemi trovati

**1. Barra globale in alto (Operations.tsx) ancora con formato vecchio**

La stats strip mostra "📄 183 profili (13%)" — cioè quanti CE L'HANNO. Questo è incoerente con i MissingChip nel pannello paese che mostrano "Senza Profilo 3". L'utente vede due informazioni contrastanti: in alto "183 profili" sembra positivo, ma aprendo l'Afghanistan vede "Senza Profilo 3".

**Fix**: Convertire i chip cliccabili della barra globale allo stesso formato "mancanti" usato nel pannello paese:
- "Senza Profilo **1217**" invece di "📄 183 profili (13%)"
- "Senza Email **1052**" invece di "✉️ 348 email (25%)"  
- "Senza Telefono **779**" invece di "📞 621 tel (44%)"
- Chip non cliccabili (paesi, partner totali, directory) restano invariati

**2. Badge paese verde = solo "scaricato", ignora profili mancanti**

La card Afghanistan mostra pallino verde "100%" perché `3/3 scaricati`. Ma il profilo HTML è NULL per tutti e 3. La logica `isDone` nel filtro considera `allProfiles`, ma il badge visivo usa solo `dlPct` (linea 233 CountryGrid). L'utente legge "verde 100%" come "tutto fatto" — falso.

**Fix**: Il badge deve diventare giallo/ambra se `allDownloaded` ma `noProfile > 0`. Aggiungere un sotto-indicatore per profili mancanti:
- 🟢 100% = scaricati + profili completi
- 🟡 100%↓ = scaricati ma profili mancanti (tooltip "3 scaricati, 3 senza profilo")
- Logica: `if (dlPct >= 100 && noProfile > 0)` → ambra

**3. Afghanistan with_profile: 0 — atteso**

I 3 partner afghani hanno `raw_profile_html = NULL` nel DB. Il fix al `profileSaver.ts` è stato appena applicato ma i profili non sono stati ri-scaricati. Questo è corretto — richiede un nuovo download con il pulsante "Scarica Profili" dal filtro "Senza Profilo".

**4. Selezione multipla paesi per download cumulativo — non supportata**

Attualmente `activeCountry` è un singolo oggetto `{ code, name } | null`. La CountryGrid ha un pulsante "Seleziona tutti" ma il click su un paese sostituisce la selezione precedente (`setActiveCountry`). Non è possibile selezionare più paesi incompleti e fare un download cumulativo.

**Fuori scope per ora** — richiede refactoring significativo del flusso download che opera su un singolo `countryCode`.

### File modificati

1. **`src/pages/Operations.tsx`** — Convertire i StatsChip di profili/email/telefono al formato "mancanti" con stile verde quando il conteggio è 0
2. **`src/components/download/CountryGrid.tsx`** — Badge: ambra se 100% scaricati ma profili mancanti; aggiungere micro-indicatore profilo nella card

### Dettaglio implementazione

**Operations.tsx** (stats strip, ~linea 162-175):
```typescript
// Chip cliccabili: mostrare MANCANTI
const missingProfile = globalStats.totalPartners - globalStats.withProfile;
const missingEmail = globalStats.totalPartners - globalStats.withEmail;
const missingPhone = globalStats.totalPartners - globalStats.withPhone;

// Render:
<MissingGlobalChip emoji="📄" label="Profilo" missing={missingProfile} onClick={...} />
<MissingGlobalChip emoji="✉️" label="Email" missing={missingEmail} />
<MissingGlobalChip emoji="📞" label="Tel" missing={missingPhone} />
// Se missing=0 → "✓ Profilo" verde
```

**CountryGrid.tsx** (badge, ~linea 233-248):
```typescript
// PRIMA: verde se dlPct >= 100
// DOPO: verde solo se dlPct >= 100 AND noProfile === 0
if (st.cCount > 0 && dlPct >= 100 && st.noProfile === 0) {
  dotColor = "bg-emerald-500"; // veramente completo
} else if (st.cCount > 0 && dlPct >= 100 && st.noProfile > 0) {
  dotColor = "bg-amber-500"; // scaricato ma profili mancanti
  label = "100%";
  tooltip = `Tutti scaricati — ${st.noProfile} senza profilo`;
}
```

