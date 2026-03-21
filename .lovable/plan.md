
Obiettivo: rifare davvero il flusso download in modo semplice e robusto, perché oggi il problema non è “il tempo”, ma il fatto che il sistema ha ancora troppi strati che si contraddicono tra loro.

Stato reale che ho verificato:
- L’ultimo job attivo è `Dominican Republic`, ora `paused` a `0/41` per `5 timeout consecutivi`.
- Quindi il motore non sta fallendo “a metà”: in certi casi parte già con uno stato tecnico incoerente.

Problemi trovati nel codice, file per file

1. `src/hooks/useDownloadEngine.ts`
- Usa ancora logica a soglia (`5 timeout consecutivi`) invece di aspettare e diagnosticare il singolo profilo.
- Ignora di fatto la velocità configurata del job: usa `waitForGreenLight()` globale, non `job.delay_seconds`.
- `current_index: processedSet.size` è sbagliato: se salti profili o riprendi job, l’indice non rappresenta più la posizione reale nel vettore.
- In retry salva solo se il partner esiste già; se non esiste, quel profilo fallisce anche quando l’estrazione va bene.
- `completeJob()` non salva `processed_ids`, `current_index`, `contacts_found_count`, `contacts_missing_count`: quindi il job può risultare “completed” con stato interno incompleto.
- `stop()` abortisce solo localmente: non porta il job in uno stato DB esplicito.
- I casi `memberNotFound`, `retry`, `error` non vengono loggati/persistiti in modo coerente profilo per profilo.

2. `src/hooks/useExtensionBridge.ts`
- Continua a fare polling ogni 3 secondi: è rumore tecnico costante, può creare falso “extension not responding” e non serve durante un job lineare.
- `checkAvailable()` controlla solo se l’estensione risponde, non se l’estrazione WCA funziona davvero.
- La gestione “stale response” esiste perché il contratto messaggi è fragile, non perché il dominio lo richieda.
- Il bridge lato app usa `window.location.origin`, ma il content script risponde con `*`: è incoerente con la policy di sicurezza.

3. `public/chrome-extension/content.js`
- Usa `window.postMessage(..., "*")` per tutte le risposte.
- Non limita l’origine di ritorno.
- È un relay minimale, ma oggi non porta abbastanza contesto per distinguere i tipi di errore.

4. `public/chrome-extension/background.js`
- È ancora un monolite enorme e mescola:
  - estrazione DOM
  - gestione tab
  - verifica sessione
  - auto-login
  - sync cookie
  - salvataggio server
- `extractContacts` nel listener risponde quasi sempre con `success: true` anche quando `result.error` o `pageLoaded: false`: questo falsa il contratto con il frontend.
- Non rimanda sempre `htmlLength` / `error` / motivazione reale al client, quindi il motore non può diagnosticare bene.
- `verifyWcaSession()` controlla i cookie, non l’accesso reale al contenuto protetto.
- `checkPageLoaded()` usa euristiche fragili (`html.length > 2000`, `h1`) che possono fallire su pagine valide.
- Fa sia salvataggio lato estensione (`sendContactsToServer`) sia salvataggio lato app (`saveExtractionResult`): doppio percorso, doppia fonte di verità.
- Continua ad avere `autoLogin`, che era esattamente una delle cause del casino.

5. `src/hooks/useWcaSession.ts`
- Contraddice il modello “manual-first”:
  - verifica sessione
  - prende credenziali
  - tenta auto-login
  - fa sync cookie
- Quindi il sistema che doveva essere semplice continua ad avere un secondo flusso parallelo.

6. `src/components/download/ActionPanel.tsx`
7. `src/hooks/useDirectoryDownload.ts`
8. `src/components/operations/PartnerListPanel.tsx`
- Questi tre punti bloccano ancora i download con `ensureSession()` prima di creare il job.
- Quindi anche se il motore download è stato “semplificato”, l’ingresso al flusso non lo è affatto.

9. `src/components/layout/AppLayout.tsx` e `src/pages/Global.tsx`
- C’è ancora auto-start:
  - `ai-ui-action -> start_download_job`
  - `Global.handleJobCreated -> startJob(job.job_id)`
- Quindi il sistema non è davvero solo manuale.

10. `src/hooks/useJobHealthMonitor.ts`
- Continua a interpretare e notificare stall/sessione/errori globalmente.
- Non è il problema principale, ma aggiunge un altro layer che osserva e interpreta lo stato.

Soluzione definitiva che implementerei

Fase 1 — Unica fonte di verità
- Il download deve avere una sola catena:
```text
UI crea job -> motore legge job -> estensione estrae -> app salva -> motore aggiorna stato
```
- Tolgo completamente:
  - auto-login
  - verify session via cookie
  - sync cookie come prerequisito al download
  - doppio salvataggio estensione/server

Fase 2 — Nuovo contratto estensione/app
- `background.js` deve restituire sempre una risposta strutturata vera:
```text
{
  success,
  wcaId,
  state: "ok" | "member_not_found" | "not_loaded" | "bridge_error",
  companyName,
  contacts,
  profile,
  profileHtml,
  htmlLength,
  error
}
```
- Nessun `success: true` se la pagina non è leggibile.
- L’estensione non salva più nulla nel backend: estrae e basta.

Fase 3 — Motore lineare senza euristiche tossiche
- `useDownloadEngine` va riscritto per:
  - usare la posizione reale del loop, non `processedSet.size`
  - persistere ogni profilo processato
  - salvare sempre stato finale coerente
  - distinguere:
    - `member_not_found`
    - `page_not_loaded`
    - `temporary_error`
    - `cancelled`
- Niente pausa automatica dopo 5 timeout come regola principale.
- Se un profilo non risponde:
  - lo marchi come errore tecnico
  - passi avanti
  - fai un retry finale
- Il job si ferma solo per:
  - stop utente
  - estensione non disponibile
  - errore strutturale ripetuto dell’intero bridge, non del singolo profilo

Fase 4 — Ingresso download pulito
- Rimuovere `ensureSession()` come gate in:
  - `ActionPanel`
  - `useDirectoryDownload`
  - `PartnerListPanel`
- Il job deve partire sempre.
- Se WCA non è accessibile, sarà l’estrazione del singolo profilo a restituire il motivo reale.

Fase 5 — Eliminare gli automatismi residui
- Rimuovere auto-start in:
  - `AppLayout`
  - `Global`
- Lasciare solo:
  - Start
  - Pause
  - Resume
  - Stop
  espliciti dall’utente o da un singolo entrypoint controllato.

Fase 6 — Spezzare davvero l’estensione
- `background.js` va diviso almeno in:
  - `tabManager.js`
  - `pageChecks.js`
  - `profileExtractor.js`
  - `messageRouter.js`
- Così si isola subito dove si rompe:
  - apertura tab
  - attesa caricamento
  - lettura DOM
  - ritorno messaggio

File che toccherei nel refactor
- `src/hooks/useDownloadEngine.ts`
- `src/hooks/useExtensionBridge.ts`
- `src/hooks/useWcaSession.ts`
- `src/hooks/useDirectoryDownload.ts`
- `src/components/download/ActionPanel.tsx`
- `src/components/operations/PartnerListPanel.tsx`
- `src/components/layout/AppLayout.tsx`
- `src/pages/Global.tsx`
- `src/hooks/useJobHealthMonitor.ts`
- `public/chrome-extension/background.js`
- `public/chrome-extension/content.js`
- nuovi moduli estensione estratti dal background

Risultato atteso
- Niente più “sessione WCA non attiva” come blocco preventivo sparso in giro.
- Niente più doppio flusso app/estensione/backend.
- Niente più job “completed” con stato interno sporco.
- Niente più indice progresso falsato.
- Ogni fallimento avrà una causa vera e tracciabile per profilo.
- Il download diventa finalmente un flusso unico, leggibile e debuggabile.

In sintesi: il problema principale non è WCA, ma il fatto che oggi convivono ancora 4 sistemi diversi nello stesso flusso: gate sessione, bridge, motore job, automatismi globali. La soluzione definitiva è togliere i gate e le scorciatoie, far parlare estensione e motore con un contratto pulito, e lasciare un solo percorso esecutivo end-to-end.
