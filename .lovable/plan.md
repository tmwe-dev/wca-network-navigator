

## Diagnosi: il "File Standard" non mappa correttamente le colonne

### Il problema

In `src/hooks/useImportLogs.ts` (righe 168-183), la funzione `useCreateImport` mappa le colonne del file usando lookup **case-sensitive** su nomi hardcoded:

```typescript
company_name: row.company_name || row.ragione_sociale || row.azienda || null,
name: row.name || row.nome || row.contatto || null,
email: row.email || row.mail || null,
phone: row.phone || row.telefono || row.tel || null,
```

Se il file TMW Engine ha header come `"Ragione Sociale"` (maiuscole), `"E-mail"`, `"Telefono"` con spazi o accenti, **nessuno di questi match funziona** perché `row["ragione_sociale"]` non corrisponde a `row["Ragione Sociale"]`.

Inoltre, il parsing Excel (`parseFile` in Import.tsx riga 76-84) usa i nomi header **così come sono nel file**, preservando maiuscole e spazi.

### Bug aggiuntivo: country_code

Righe 259 e 329: `(c.country || "XX").substring(0, 2).toUpperCase()` — "South Africa" diventa "SO", "Italy" diventa "IT" per caso. Va usata la funzione `resolveCountryCode` già presente in `src/lib/countries.ts`.

### Soluzione

#### 1. Normalizzazione header in `parseFile` (Import.tsx)
Normalizzare i nomi delle chiavi al momento del parsing: lowercase, rimuovere accenti, collassare spazi/trattini in underscore.

#### 2. Ampliare gli alias di mapping in `useCreateImport` (useImportLogs.ts)
Creare una funzione `findField(row, aliases[])` che cerca il valore tra più nomi possibili normalizzati. Alias da supportare:

| Campo target | Alias aggiuntivi |
|---|---|
| company_name | ragione_sociale, azienda, company, societa, ditta, denominazione |
| name | nome, contatto, referente, contact, nome_contatto, nome_referente |
| email | e_mail, mail, email_address, posta_elettronica, e-mail |
| phone | telefono, tel, phone_number, numero_telefono |
| mobile | cellulare, cell, mobile_phone, cell_phone |
| country | paese, nazione, stato, country_name |
| city | citta, città, localita, comune |
| address | indirizzo, via, sede |
| zip_code | cap, postal_code, codice_postale |
| note | notes, annotazioni, commenti, osservazioni |
| origin | origine, provenienza, fonte, source |

#### 3. Usare `resolveCountryCode` in `useTransferToPartners` e `useCreateActivitiesFromImport`
Importare e usare `resolveCountryCode(c.country)` invece di `.substring(0,2)`.

### File da modificare

| File | Modifica |
|---|---|
| `src/pages/Import.tsx` | Normalizzare le chiavi degli oggetti in `parseFile` (lowercase, strip accenti, underscore) |
| `src/hooks/useImportLogs.ts` | Aggiungere funzione `findField` con alias multipli in `useCreateImport` (righe 168-183). Usare `resolveCountryCode` in `useTransferToPartners` (riga 259) e `useCreateActivitiesFromImport` (riga 329) |

