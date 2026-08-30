# Modulo 1 — Identità e accesso (innestato)

Primo modulo della V3. Nessun file esistente è stato modificato nella logica: la V3 vive accanto a V1 e V2.

## Cosa esiste ora

| File | Ruolo |
|---|---|
| `src/v3/app/pageContract.ts` | Registro delle 22 pagine. Il router registra solo quelle con `implemented: true` (oggi 2). |
| `src/v3/app/PageFrame.tsx` | L'unico guscio di maschera: filtri a sinistra, header + toolbar + contenuto al centro, workflow a destra, ✦AI sempre nello stesso punto. |
| `src/v3/app/AppShell.tsx` | Top bar globale unica, guard di accesso, navigazione generata dal contratto. |
| `src/v3/app/routes.tsx` | Un percorso per pagina. Nessun alias. |
| `src/v3/modules/identita/useLogin.ts` | Accesso email + password. Nessun OAuth sociale. |
| `src/v3/modules/identita/useOperatori.ts` | Stato e filtri della lista operatori. |
| `src/v3/modules/identita/pages/LoginPage.tsx` | Maschera pubblica di accesso. |
| `src/v3/modules/identita/pages/OperatoriPage.tsx` | Maschera Lista: chi può fare cosa. |
| `src/data/v3/identita.ts` | DAL del modulo: unisce whitelist e anagrafica operatori in una sola vista. |

Rotta di ingresso: `/v3` (aggiunta in `src/App.tsx` accanto a `/v2/*`, senza toccare le rotte esistenti).

## Isolamento imposto dal lint

Due blocchi in `eslint.config.js` su `src/v3/**`:

- import da `@/v2/**` e `@/pages/**` → errore;
- import da `@/components/**` diversi da `@/components/ui/**` → errore (le primitive shadcn sono l'unica eredità ammessa);
- le pagine V3 non importano `@/data/**`: passano da un hook di modulo;
- `supabase.from()` vietato fuori dal DAL.

Le regole sono state verificate con un file sonda: entrambe scattano davvero.

## Verifica eseguita

- Typecheck pulito.
- Lint di `src/v3` e `src/data/v3` a zero errori e zero warning.
- Browser: `/v3/operatori` da non autenticato reindirizza a `/v3/login`; con sessione attiva la lista rende 12 operatori reali con ruolo, stato, ultimo accesso e conteggio accessi. Filtri e rail destro montati come da contratto.

## Limiti dichiarati

- Il tasto "Invita operatore" è disattivato: la gestione della whitelist resta in V2 finché il modulo non è completo. La V3 oggi legge, non scrive.
- Il badge "solo whitelist" segnala le email autorizzate senza record operatore: è un'incoerenza dei dati esistenti, resa visibile invece che nascosta.

## Prossimo passo

Modulo 2 — Contatti: `/v3/contatti` (Lista) e `/v3/contatti/:id` (Dettaglio), con il DAL di lettura su partner e contatti.
