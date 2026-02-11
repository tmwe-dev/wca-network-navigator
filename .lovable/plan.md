

# Fix: Lo stato sessione resta "expired" anche con cookie valido

## Problema

Il cookie WCA nel database contiene `.ASPXAUTH` ed e' valido, ma il sistema mostra "Sessione scaduta" perche':

1. C'e' un job in pausa (USA) con messaggio "5 profili consecutivi senza contatti"
2. La funzione `check-wca-session` vede quel job e forza lo stato a `expired`
3. Anche se il cookie e' stato ri-sincronizzato DOPO la pausa del job, il vecchio job continua ad avvelenare il risultato

## Soluzione

### File 1: `supabase/functions/check-wca-session/index.ts`

Modificare la logica dei job (righe 53-71):
- Se il cookie ha `.ASPXAUTH`, lo stato base e' `ok`
- Controllare i job recenti SOLO se sono stati aggiornati DOPO l'ultimo salvataggio del cookie
- Se il job in pausa e' PIU' VECCHIO dell'ultimo cookie sync, ignorarlo (il cookie e' stato rinnovato)

```text
Logica attuale (sbagliata):
  cookie valido + job in pausa con "senza contatti" = expired

Logica nuova (corretta):
  cookie valido + job in pausa MA cookie salvato DOPO il job = ok
  cookie valido + job in pausa E cookie salvato PRIMA del job = expired
```

### File 2: `src/hooks/useWcaSessionStatus.ts`

Il `triggerCheck` chiama la Edge Function che ora restituisce risultati corretti. Nessuna modifica strutturale necessaria, ma aggiungere un `refetch` immediato dopo il `triggerCheck` per aggiornare l'UI.

## Dettagli tecnici

Nel `check-wca-session`, leggere anche il `updated_at` del cookie e confrontarlo con il `updated_at` del job in pausa:

```typescript
// Se il cookie e' stato aggiornato DOPO la pausa del job, il cookie e' fresco
const cookieUpdatedAt = map['wca_auth_cookie_updated_at']
if (job.status === 'paused' && cookieUpdatedAt > job.updated_at) {
  // Cookie rinnovato dopo la pausa - sessione probabilmente OK
  status = 'ok'
}
```

## File modificati

| File | Modifica |
|------|----------|
| `supabase/functions/check-wca-session/index.ts` | Confrontare timestamp cookie vs job per evitare falsi "expired" |

