

# Piano: Nome intelligente dei mittenti in Email Intelligence

## Problema
Attualmente il nome visualizzato sulle card dei mittenti usa la parte locale dell'email (es. "notifications" da notifications@vercel.com) o il primo segmento del dominio. Il risultato è poco leggibile e non rappresentativo.

## Logica richiesta
- **Email aziendali** (dominio non personale): usare il nome del dominio pulito e capitalizzato
  - `notifications@vercel.com` → **Vercel**
  - `broadcast@wcabroadcast.com` → **WCA Broadcast** (split su camelCase/separatori)
  - `marketing@everest.com` → **Everest**
  - `newsletters-noreply@linkedin.com` → **LinkedIn**
  - `sara.triassi@tmwi.com` → **Sara Triassi · TMWI** (nome riconosciuto + azienda)
- **Email personali** (gmail, yahoo, hotmail, outlook, etc.): usare la parte locale come nome
  - `john.smith@gmail.com` → **John Smith**

## Modifiche

### 1. Nuova utility `src/lib/senderDisplayName.ts`
Funzione pura `deriveSenderDisplayName(email: string): string` con questa logica:
- Estrai `localPart` e `domain`
- Lista di domini personali noti: gmail, yahoo, hotmail, outlook, live, icloud, aol, protonmail, etc.
- Se dominio personale: formatta `localPart` sostituendo `.` e `_` con spazi, capitalizza ogni parola
- Se dominio aziendale:
  - Prendi il nome base del dominio (senza TLD): `vercel.com` → `vercel`, `wcabroadcast.com` → `wcabroadcast`
  - Split intelligente su camelCase, trattini, underscore: `wcabroadcast` → `wca broadcast`
  - Mappa di override per brand noti: `linkedin` → `LinkedIn`, `tmwe` → `TMWE`, `tmwi` → `TMWI`
  - Se `localPart` sembra un nome di persona (contiene `.` o `_` tra due parole, nessuna keyword di ruolo): mostra `"Nome Cognome · Azienda"`
  - Altrimenti: solo nome azienda capitalizzato

### 2. Applicazione nei 3 punti di costruzione `companyName`

**`ManualGroupingTab.tsx` riga 129** (lettura da DB):
```
companyName: r.company_name || deriveSenderDisplayName(r.email_address)
```

**`ManualGroupingTab.tsx` riga 243** (populateAddressRules — INSERT nuove regole):
Aggiungere `company_name: deriveSenderDisplayName(addr)` e `display_name` nel payload INSERT.

**`SenderManagementTab.tsx` riga 121** (costruzione in-memory):
```
companyName: deriveSenderDisplayName(email)
```

### 3. File toccati
- `src/lib/senderDisplayName.ts` (nuovo)
- `src/components/email-intelligence/ManualGroupingTab.tsx` (2 righe)
- `src/components/email-intelligence/SenderManagementTab.tsx` (1 riga)

Zero modifiche al database. La funzione `deriveSenderDisplayName` è pura e testabile.

