

## Piano: Indicatori tri-stato + Toast z-index + Contatori visibili

### Problema 1: Toast nascosti
Il componente `Sonner` in `src/components/ui/sonner.tsx` non ha `z-index` esplicito. La pagina Operations usa `relative z-10`, coprendo i toast.

**Fix**: Aggiungere `style={{ zIndex: 9999 }}` al `<Sonner>`.

---

### Problema 2: Logica tri-stato per gli indicatori

Gli `IconIndicator` attualmente hanno solo 2 stati: verde (count=0) o rosso (count>0). Serve un terzo stato: **"verificato ma assente"** (verde con conteggio).

**Logica di verifica** (senza nuovi campi DB):
- **Profilo**: Verde ✓ se `count === 0`. Rosso se mancante (invariato).
- **Email/Telefono**: Se il profilo esiste (`raw_profile_html` presente) ma email/telefono mancano → il download è stato fatto, dato verificato → **verde con numero**. Se nemmeno il profilo c'è → rosso.
- **Deep Search**: Se `enrichment_data.deep_search_at` esiste → verificato. Mancante ma non ancora eseguito → rosso.
- **Alias Azienda/Contatto**: Se `ai_parsed_at` esiste → verificato (alias generation già eseguita). Se non esiste → rosso.

**Implementazione in `PartnerListPanel.tsx`**:
1. Aggiungere al `stats` un campo `verified` per ogni metrica, calcolato da `useCountryStats` o dal conteggio locale. Serve estendere l'RPC `get_country_stats` per restituire:
   - `with_profile_no_email` (profilo OK ma email mancante = verified missing)
   - `with_profile_no_phone`
   - `with_deep_no_alias_co` (deep fatto ma alias mancante)
   
   **Alternativa più semplice** (senza toccare RPC): Calcolare client-side dalla lista `partners` già caricata. Per ogni indicatore, contare quanti hanno "operazione prerequisita completata ma dato assente".

2. Modificare `IconIndicator` per accettare un prop `verified: boolean`:
   - `count === 0` → verde con ✓
   - `count > 0 && verified` → **verde con numero** (sfondo emerald, badge emerald invece di rosso)
   - `count > 0 && !verified` → rosso con numero (attuale)

3. Nella tooltip: 
   - Verificato: "Email: 2 mancanti (verificato ✓)"
   - Non verificato: "Email: 2 mancanti"

---

### Problema 3: Contatori totale/scaricati non visibili

Il conteggio `downloadedCount/totalCount` c'è nella progress bar ma l'utente non lo vede. Renderlo più prominente:
- Aggiungere sotto la barra di progresso due chip compatti: `Totale: N` e `Scaricati: N/M` con font più grande e visibilità maggiore.

---

### Problema 4: Sincronizzazione indicatori dopo operazioni

Dopo ogni operazione (alias, deep search, download), invalidare `country-stats` e `partners` per aggiornare tutti i contatori. Verificare che `handleGenerateAliases` in `Operations.tsx` invalidi anche `country-stats`.

---

### File da modificare

| File | Modifica |
|------|----------|
| `src/components/ui/sonner.tsx` | Aggiungere `style={{ zIndex: 9999 }}` |
| `src/components/operations/PartnerListPanel.tsx` | Tri-stato per `IconIndicator`, contatori totale/scaricati più visibili |
| `src/pages/Operations.tsx` | Invalidare `country-stats` dopo alias/deep search |

