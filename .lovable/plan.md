

## Piano: Import Intelligente Universale

### Problema
Il parser CSV splitta solo per virgola (il file TMW usa `;`), il campione AI è solo 5 righe (troppo poche per certezza), e la modalità "File Standard" bypassa l'AI causando import vuoti quando le colonne non matchano esattamente.

### Modifiche

**1. `src/pages/Import.tsx` — Parser e UI**
- **Auto-detect delimitatore**: contare `;`, `,`, `\t` nella prima riga e usare il più frequente
- **Gestione colonne duplicate**: quando due header hanno lo stesso nome normalizzato, aggiungere suffisso `_2`, `_3` ecc.
- **Rimuovere la modalità "File Standard"**: resta solo "Incolla Testo" e "File + Mapping AI"
- **Aumentare il campione AI da 5 a 30 righe** per maggiore affidabilità
- **Aggiungere bottone "Esporta errori CSV"** nel tab errori per scaricare le righe fallite

**2. `src/hooks/useImportLogs.ts` — Alias TMW**
- Aggiungere alias mancanti: `cell` → mobile, `position` → note, `Address` → address, `company_alias` → company_alias, `contact_alias` → contact_alias
- Usare `FIELD_ALIASES` anche nel path AI come fallback

**3. `supabase/functions/analyze-import-structure/index.ts` — Prompt migliorato**
- Aggiungere `company_alias` e `contact_alias` alle colonne target
- Istruire l'AI a gestire strutture a doppia entità (contatto + azienda nella stessa riga, colonne duplicate con suffisso)

### File coinvolti

| File | Modifica |
|------|----------|
| `src/pages/Import.tsx` | Auto-detect delimitatore, rimuovere "Standard", campione 30 righe, colonne duplicate |
| `src/hooks/useImportLogs.ts` | Alias TMW aggiuntivi |
| `supabase/functions/analyze-import-structure/index.ts` | Aggiungere company_alias/contact_alias, prompt doppia entità |

Nessun file eliminato. Le modifiche sono retrocompatibili con tutti i formati CSV/Excel esistenti.

