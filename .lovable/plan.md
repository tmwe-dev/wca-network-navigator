

## Problema: `raw_profile_html` non viene salvato

Ho trovato il bug nel file `src/lib/download/profileSaver.ts`.

### Causa root

Il salvataggio di `raw_profile_html` (riga 88) si trova **dentro** il blocco `if (result.profile)` (riga 67). Se l'estensione Chrome restituisce `profileHtml` (il body HTML della pagina) ma il parsing strutturato del profilo non produce un oggetto `profile` valido, l'HTML grezzo non viene mai scritto nel database.

Per i 3 partner afghani, l'estensione ha estratto contatti (email + telefoni) e catturato l'HTML, ma il parser dei campi profilo (`address`, `phone`, `website`, etc.) non ha trovato abbastanza dati strutturati, quindi `result.profile` era vuoto/nullo. Di conseguenza:
- `raw_profile_html` = mai scritto nel DB
- `get_country_stats()` controlla `raw_profile_html IS NOT NULL` → risultato: 0 profili

### Dato attuale nel DB (Afghanistan)

```text
with_profile: 0      ← raw_profile_html è NULL per tutti e 3
with_email: 3         ← contatti email estratti correttamente  
with_phone: 3         ← contatti telefono estratti correttamente
with_deep_search: 3   ← deep search completato
```

### Fix

**File: `src/lib/download/profileSaver.ts`**

Spostare il salvataggio di `raw_profile_html` **fuori** dal blocco `if (result.profile)`, in modo che venga salvato indipendentemente dalla presenza di dati strutturati nel profilo:

```typescript
// PRIMA (bug): raw_profile_html dentro if (result.profile)
if (result.profile) {
    // ... campi strutturati ...
    if (result.profileHtml) upd.raw_profile_html = result.profileHtml;  // ← mai raggiunto se profile è vuoto
}

// DOPO (fix): salvataggio separato
if (result.profile) {
    // ... campi strutturati ...
}

// Salva sempre l'HTML grezzo, indipendentemente dal profilo strutturato
if (result.profileHtml) {
    await supabase.from("partners").update({ raw_profile_html: result.profileHtml }).eq("id", partnerId);
    profileSaved = true;
}
```

Questo fix è una modifica di ~5 righe nel file `profileSaver.ts`. Dopo l'applicazione, i prossimi download salveranno sempre l'HTML. Per i 3 partner afghani già scaricati, sarà necessario ri-scaricarli (usando il filtro "Senza Profilo" + pulsante "Scarica Profili").

