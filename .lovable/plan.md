

# Piano: Tasto Emergency Stop e Parametri Anti-Ban Piu' Sicuri

## 1. Tasto EMERGENCY STOP

Aggiungere un grosso tasto rosso "BLOCCA TUTTO" visibile in modo permanente nell'Operations Center quando ci sono job attivi. Non nascosto in una tab, ma sempre visibile nella top bar o come floating button.

### Comportamento

- Un click cancella **tutti** i job con status `running` o `pending` (non solo uno)
- Imposta `cancelRef.current = true` per interrompere immediatamente il loop in corso
- Aggiorna lo status di ogni job a `cancelled` nel DB
- Scrive nel terminal log "EMERGENCY STOP attivato dall'utente"
- Mostra conferma visiva (toast rosso)

### Implementazione

**`src/hooks/useDownloadJobs.ts`**: aggiungere una mutation `useEmergencyStop` che:
```
UPDATE download_jobs SET status = 'cancelled', error_message = 'EMERGENCY STOP'
WHERE status IN ('running', 'pending')
```

**`src/hooks/useDownloadProcessor.ts`**: esporre una funzione `emergencyStop()` che imposta `cancelRef.current = true` e chiama la mutation. Restituire questa funzione dal hook.

**`src/pages/Operations.tsx`**: rendere visibile il tasto Emergency Stop nella top bar, accanto a "N job attivi". Stile: sfondo rosso, icona octagon/stop, testo "BLOCCA TUTTO".

### Posizione UI

Il tasto appare nella barra superiore dell'Operations Center, a fianco del badge "N job attivi", con:
- Sfondo rosso intenso (`bg-red-600 hover:bg-red-700`)
- Icona `OctagonX` o `ShieldAlert`
- Testo "BLOCCA TUTTO"
- Visibile SOLO quando ci sono job attivi (running o pending)
- Nessuna conferma richiesta (azione immediata per emergenza)

## 2. Parametri anti-ban piu' sicuri (consigliati)

Attualmente i parametri nel DB sono troppo aggressivi per un sito che ha gia' bloccato 4 volte. Suggerisco di aggiornare via SQL:

| Parametro | Attuale | Consigliato |
|---|---|---|
| `scraping_delay_min` | 10s | **15s** |
| `scraping_delay_default` | 9s | **20s** |
| `scraping_jitter_min` | 1.3 | **1.5** |
| `scraping_jitter_max` | 1.5 (default) | **2.5** |
| `scraping_antiban_duration_s` | 20s | **60s** |
| `scraping_antiban_every_n` | 10 (default) | **8** |
| `scraping_inter_job_pause_s` | 30s (default) | **60s** |

Questo porterebbe il delay effettivo minimo da 13s a **22.5s** e il massimo a **50s**, con pause anti-ban di 1 minuto ogni 8 profili. Molto piu' sicuro.

Non modifico questi valori automaticamente: li applichero' solo se approvi, perche' rallentano il processo.

## File da modificare

1. **`src/hooks/useDownloadJobs.ts`** -- aggiungere `useEmergencyStop()` mutation
2. **`src/hooks/useDownloadProcessor.ts`** -- esporre `emergencyStop()` e collegare al cancelRef
3. **`src/pages/Operations.tsx`** -- aggiungere il tasto rosso nella top bar

## Come raggiungere il Terminal

Il terminal e' visibile in: **Operations Center -> seleziona un paese -> tab "Scarica"** (seconda tab). Appare sotto il pannello di download e sopra il monitor dei job. Se vuoi che sia visibile anche senza selezionare un paese (nella vista globale), posso spostarlo li'.

