

# Pre-flight Check per Deep Search: Verifica Estensione e Configurazione

## Problema attuale
Quando lanci la Deep Search, non c'e nessun controllo preliminare: non sai se l'estensione LinkedIn e attiva, se le credenziali sono configurate, se la sessione e valida, o se i servizi necessari (Firecrawl, AI) sono pronti. Il processo parte alla cieca.

## Soluzione
Aggiungere un **pannello di pre-flight check** che verifica tutto PRIMA di avviare la Deep Search, sia nel Workspace che nel Partner Hub.

## Modifiche

### 1. Nuovo componente: `DeepSearchPreflightDialog`

**File: `src/components/workspace/DeepSearchPreflightDialog.tsx`**

Un dialog modale che appare quando clicchi "Deep Search" e esegue i controlli in sequenza:

| Check | Cosa verifica | Come |
|-------|--------------|------|
| Credenziali LinkedIn | `linkedin_email` e `linkedin_password` presenti in `app_settings` | Query diretta al DB |
| Cookie LinkedIn (li_at) | `linkedin_li_at` presente e non vuoto | Query diretta al DB |
| Estensione LinkedIn | L'estensione Chrome risponde al ping | `useLinkedInExtensionBridge.isAvailable` |
| Sessione LinkedIn | L'estensione conferma sessione attiva | `verifySession()` via bridge |
| Crediti sufficienti | L'utente ha almeno 10 crediti per partner | Query `user_credits` |

Ogni check mostra:
- Cerchio verde con check: superato
- Cerchio rosso con X: fallito (con link "Vai alle Impostazioni" o azione correttiva)
- Spinner: in corso
- Cerchio giallo con warning: opzionale/non critico

**Comportamento:**
- I check critici (crediti) bloccano il pulsante "Avvia Deep Search"
- I check non critici (estensione, sessione LinkedIn) mostrano un warning ma permettono di procedere (la deep search funziona anche senza estensione, usa Firecrawl)
- Pulsante "Avvia Deep Search" abilitato solo quando i check critici passano

### 2. Aggiornamento Workspace

**File: `src/pages/Workspace.tsx`**
- Importare il nuovo `DeepSearchPreflightDialog`
- Importare `useLinkedInExtensionBridge`
- Il pulsante "Deep Search" ora apre il dialog di preflight invece di avviare direttamente
- Aggiungere stato `showPreflight` per controllare il dialog
- Una volta confermato nel dialog, esegue `handleDeepSearch` come prima

### 3. Aggiornamento PartnerHub (BulkActionBar)

**File: `src/pages/PartnerHub.tsx`**
- Stessa logica: il pulsante Deep Search nella BulkActionBar apre il preflight dialog prima di procedere

### 4. Hook helper per i check

**File: `src/hooks/useDeepSearchPreflight.ts`**
- Hook riutilizzabile che esegue tutti i check e ritorna lo stato di ciascuno
- Usa `useAppSettings` per verificare credenziali
- Usa `useLinkedInExtensionBridge` per ping e sessione
- Usa `useCredits` per verificare il saldo
- Ritorna: `{ checks: CheckResult[], allCriticalPassed: boolean, runChecks: () => void }`

## Flusso utente

1. Utente clicca "Deep Search"
2. Si apre il dialog con lista di check
3. I check partono automaticamente in sequenza
4. L'utente vede in tempo reale lo stato di ogni check
5. Se tutto OK: pulsante "Avvia Deep Search" verde
6. Se manca qualcosa: link diretto a Impostazioni -> Connessioni per configurare
7. Click su "Avvia" chiude il dialog e lancia la deep search come prima

## Riepilogo file

| File | Modifica |
|------|----------|
| `src/components/workspace/DeepSearchPreflightDialog.tsx` | Nuovo componente dialog con check visivi |
| `src/hooks/useDeepSearchPreflight.ts` | Nuovo hook con logica dei check |
| `src/pages/Workspace.tsx` | Integrazione dialog prima della deep search |
| `src/pages/PartnerHub.tsx` | Integrazione dialog prima della deep search (bulk) |

