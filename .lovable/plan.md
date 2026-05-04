## Obiettivo

Portare nel Cockpit (`AIDraftStudio`) la stessa completezza di Email Forge per **link, immagini e allegati**, gestiti **per singola bozza** nello studio destro. Niente bulk: ogni draft ha la sua attachment-bar.

## Cosa appare in UI

Sotto la `JournalistBadge`, sopra il body della bozza email, una **toolbar compatta a 3 pulsanti** (visibile solo quando `draft.channel === "email"`):

```
[🔗 Link]   [🖼️ Immagini]   [📎 Allegati]
```

Ogni pulsante apre un `Popover`:

1. **Link** — input "Etichetta" + "URL" + "Aggiungi"; lista chip removibili. I link entrano nel **prompt** della prossima rigenerazione/Migliora come istruzione: *"Cita naturalmente questi link nel testo: [label](url)"*.
2. **Immagini** — riusa `ImageGalleryTab` esistente (bucket `email-images`, upload + galleria). Il click su un'immagine inserisce `<img src="…" style="max-width:100%">` **inline nel body** alla fine (o al cursore).
3. **Allegati** — input `<input type="file" multiple>` per upload al volo + lista chip. Upload va in un nuovo bucket `cockpit-attachments` (privato). Mostriamo nome + size + ✕.

Badge numerico sul pulsante quando ci sono elementi (come EmailToolbar esistente).

## Flusso dati

Estendiamo `DraftState` (`src/types/cockpit.ts`) con tre campi opzionali per-draft:

```ts
links?: { label: string; url: string }[];
inlineImages?: string[];          // URL già nel body, solo per badge counter
attachments?: { name: string; path: string; size: number; mime: string }[];
```

Lo stato vive nel draft corrente; navigando tra bozze del bulk (`showQueuedDraft`) è già preservato perché serializziamo l'intero `DraftState` nella queue.

## Integrazione AI (link → prompt)

`useCockpitLogic.handleImprove` e `forge.run` ricevono dal draft un blocco `extraInstructions` quando `links.length > 0`:

```
Includi nel testo, in modo naturale e contestuale, i seguenti link:
- [Catalogo](https://…)
- [Case study](https://…)
Usa il formato HTML <a href>.
```

Si appende a `customGoal` prima di chiamare `generate-email`. **Niente modifiche a `generate-email`**: è solo testo nel goal.

## Integrazione invio (allegati → SMTP)

1. **Upload**: client carica i file su `cockpit-attachments/{user_id}/{uuid}-{filename}`, ottiene `path` + signed URL.
2. **Send**: `useSendEmail.handleSend` aggiunge `attachments: [{ filename, path }]` al body verso `send-email`.
3. **Edge `send-email`**: estende `SendEmailBody` con `attachments?: { filename: string; path: string }[]`. Per ogni path scarica il file dal bucket via service role e lo passa a `denomailer` come `attachments: [{ filename, content, encoding: "base64" }]`. Cap: max 10 allegati, max 20MB totali (hard guard).

## Storage

Migrazione SQL:

- Bucket `cockpit-attachments` privato.
- RLS: utente autenticato può `INSERT/SELECT/DELETE` solo nei propri file (`(storage.foldername(name))[1] = auth.uid()::text`).
- Service role legge tutto (default) per allegare in `send-email`.

## File toccati

**Nuovi**
- `src/components/cockpit/DraftAttachmentsBar.tsx` — la toolbar 3-pulsanti con i 3 popover.
- `supabase/migrations/<ts>_cockpit_attachments_bucket.sql`.

**Modificati**
- `src/types/cockpit.ts` — aggiungi `links`, `inlineImages`, `attachments` opzionali.
- `src/components/cockpit/AIDraftStudio.tsx` — render `<DraftAttachmentsBar>` sopra il body, callback che aggiornano `draft` via `onDraftChange`. Inserimento immagini = append `<img>` nel body.
- `src/hooks/useCockpitLogic.ts` — in `handleImprove` e nella chiamata di rigenerazione, comporre `customGoal` con il blocco "Includi link…" se `draft.links?.length`.
- `src/hooks/useSendEmail.ts` — propaga `attachments` al body di `send-email` (mappa `path` → `{filename, path}`).
- `supabase/functions/send-email/index.ts` — accetta `attachments`, scarica da storage, passa a `denomailer` con cap 10/20MB.

## Vincoli rispettati

- Niente bulk break: link/immagini/allegati sono **solo per la bozza corrente**, lo scope sidebar resta invariato.
- `journalistReview` resta intoccato: gli allegati non passano per il revisore (sono binari), il body passa come oggi.
- `invokeAi` charter: nessuna nuova chiamata AI, solo arricchimento del `goal` testuale già autorizzato.
- Soft-delete & RLS storage standard.
- Hard guards in `send-email`: cap allegati lato edge function.

## Out of scope

- Bulk: stessi allegati su tutti i contatti (lo decideremo in un secondo step se serve, riusando lo stesso `DraftState`).
- Modifica del prompt operativo del Calligrafo (i link entrano via `goal`, non via prompt versionato).