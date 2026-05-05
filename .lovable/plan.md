
## Cosa cambia

Quando dal Cockpit si lavora a una **risposta a una mail entrante**, oggi succedono 3 cose sbagliate:

1. La label "Risposta email: RE: …" viene mostrata **due volte** (una nella card contatto a sinistra, una nell'header del pannello bozza a destra) e ripete inutilmente la parola "Risposta" / "Email".
2. Non c'è alcun modo di **leggere la mail originale** che ha generato la risposta.
3. L'Oracolo (configurazione AI a sinistra) parte sempre con tipo email **"Primo contatto"**, anche quando in realtà stiamo rispondendo a una mail. Risultato: l'AI non capisce che deve agganciarsi al contesto della mail entrante.

Interveniamo solo su frontend del Cockpit e sui default dell'Oracolo. Niente refactor, niente touch su submit, generazione, edge function, classify-email-response, holding pattern, batch.

---

## 1. Niente più testo "Risposta" duplicato — solo icone

Due punti di duplicazione, entrambi diventano **icona**:

- **Card contatto (`src/components/cockpit/CockpitContactHeader.tsx`)**
  - Oggi: chip `<Reply/> Risposta` + dettaglio.
  - Dopo: solo icona `<Reply/>` (in tooltip "Risposta email"), senza la parola "Risposta". Stessa regola per `Riprogrammato` (icona `CalendarClock`) e azione generica (icona `Mail`).
  - Il `detail` continua a mostrare il subject pulito (regex già presente che strippa `risposta email:` e `📅`).

- **Header pannello bozza (`src/components/cockpit/AIDraftStudio.tsx`, righe ~67-82)**
  - Oggi: `<Icon canale/> Email → Nome contatto`, e sotto `Lingua: it · Azienda`. Se `contactName` arriva valorizzato come "Risposta email: RE: RFP…" appare di nuovo la stringa.
  - Dopo:
    - Mostriamo `<Icon canale/>` + (se è risposta) un piccolo badge icona `<Reply/>` accanto, **senza** la parola "Email" né "Risposta".
    - Puliamo `contactName` togliendo eventuali prefissi `Risposta email:` / `RE:` / `Re:` prima di renderizzarlo.
    - Manteniamo `Lingua` e `companyName` come sono.

Stessa pulizia del prefisso anche nel breadcrumb interno del Cockpit (`CockpitWorkspace.tsx`, riga ~156 `draftState.contactName`) per evitare che ricompaia altrove.

## 2. Pulsante "Leggi mail originale"

Quando la bozza è una risposta, aggiungiamo nell'header dell'`AIDraftStudio` un piccolo bottone-icona `<Mail/>` (tooltip: "Apri mail originale"). 

- Sorgente del link: `draft.replySource` — nuovo campo opzionale su `DraftState` (`{ messageId: string; subject: string; channelMessageId?: string }`), popolato da `useCockpitLogic.handleDrop` quando il contatto del Cockpit deriva da un'attività di tipo risposta (oggi quell'info esiste già in `cockpit_queue`/`activities` come `source_id` + `source_type='channel_message'`).
- Click: apre l'inbox FunneMail filtrata sul `messageId` (route già esistente `/v2/funnemail-inbox?msg=…`). Niente nuovi endpoint.
- Se `replySource` non è disponibile, l'icona resta nascosta (no rumore).

## 3. Default Oracolo: nuovo tipo "Contesto mail"

In `src/data/defaultEmailTypes.ts` aggiungiamo un nuovo `EmailType`:

- `id: "contesto_email"`, `name: "Contesto mail"`, `icon: "Reply"`, `category: "risposta"`, `tone: "professionale"`.
- `kb_categories: ["identita", "vendita", "email_modelli"]`.
- `prompt`: stile "professore" (Identità / Obiettivo / Metodo / Guardrail / Output) — riassunto:
  - **Obiettivo**: rispondere alla mail in arrivo agganciandosi al suo reale contesto (oggetto, contenuto, richiesta esplicita).
  - **Metodo**: leggere il thread, individuare la richiesta, rispondere in modo chiaro, lunghezza **media** (8-14 righe), tono **professionale**, mai aprire come fosse un primo contatto.
  - **Guardrail**: niente pitch generico, niente "Mi chiamo / La nostra azienda…", niente CTA da first-touch.
  - **Output**: subject `Re: <oggetto originale>` se non già impostato.

Questo nuovo tipo viene aggiunto in coda alla lista (resta visibile come chip nei pannelli che usano `DEFAULT_EMAIL_TYPES`, incluso `OraclePanelV2`).

### Selezione automatica del default

Nelle pagine che inizializzano il tipo email:

- **`src/v2/hooks/useForgeLabStore.ts`** (`emailType: DEFAULT_EMAIL_TYPES[0]` → calcolato).
- **`src/v2/hooks/useEmailComposerV2.ts`** (`useState("primo_contatto")` → calcolato).
- **`src/v2/ui/pages/command/tools/composeEmail.ts`** (defaults hard-coded a `primo_contatto`).

Aggiungiamo un piccolo helper `pickDefaultEmailType(ctx: { isReply?: boolean })` che ritorna `contesto_email` se `isReply`, altrimenti `primo_contatto`. Il flag `isReply` arriva:

- nel Cockpit dal `draft.replySource` di cui sopra;
- in `composeEmail` dal payload del tool quando il command-loop sta rispondendo (campo già presente come `inboundMessageId`/contesto);
- in `useEmailComposerV2` da una nuova prop opzionale `initialIsReply` (default `false` → comportamento invariato negli altri ingressi).

Tono di default: invariato (`professionale`). Lunghezza: gestita dal nuovo prompt "Contesto mail" (media). Niente toggle aggiuntivi.

## 4. Non tocchiamo

- `check-inbox`, `email-imap-proxy`, `mark-imap-seen` (vincolo memoria).
- `journalistReview`, generate-email, classify-email-response.
- Logica di submit, batch, dedup, holding pattern.
- Tipi email esistenti e i loro prompt: solo **aggiunta** del nuovo tipo.

## Mappa file

```text
edit  src/components/cockpit/CockpitContactHeader.tsx         # icona-only per Risposta/Riprogrammato
edit  src/components/cockpit/AIDraftStudio.tsx                # header icone + pulsante "mail originale", clean contactName
edit  src/components/cockpit/CockpitWorkspace.tsx             # clean contactName nel breadcrumb
edit  src/types/cockpit.ts                                    # +DraftState.replySource opzionale
edit  src/hooks/useCockpitLogic.ts                            # popola replySource al drop quando applicabile
edit  src/data/defaultEmailTypes.ts                           # +EmailType "contesto_email"
add   src/data/pickDefaultEmailType.ts                        # helper isReply→contesto_email|primo_contatto
edit  src/v2/hooks/useForgeLabStore.ts                        # default via helper
edit  src/v2/hooks/useEmailComposerV2.ts                      # default via helper (+ initialIsReply opzionale)
edit  src/v2/ui/pages/command/tools/composeEmail.ts           # default via helper
```

Nessuna migrazione DB, nessuna nuova edge function, nessun tocco a invokeAi / scope / RLS.
