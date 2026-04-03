
Sì, possiamo andare avanti. Ho ricontrollato i file principali delle mail e la strada giusta è un refactor mirato, non un altro patch veloce: così sistemiamo layout, leggibilità e codice duplicato senza rompere di nuovo il download.

Obiettivi
- nuove mail in alto, non in fondo
- lista e preview che scorrono dentro i loro container, non l’intera pagina
- recupero delle mail oggi illeggibili senza obbligare reset/cancellazioni
- pulizia del codice duplicato che oggi aumenta il rischio di regressioni

Problemi trovati
- `src/pages/Settings.tsx`: il tab download resta dentro un wrapper `max-w-4xl` con `overflow-auto`, quindi non è davvero full-width/full-height e la pagina madre può continuare ad allungarsi.
- `src/pages/EmailDownloadPage.tsx`: le nuove mail vengono aggiunte in fondo (`setEmails(prev => [...prev, e])`) e la UI fa auto-scroll in basso con `listEndRef.scrollIntoView(...)`. È il contrario di ciò che serve.
- `EmailDownloadPage` usa `selectedIdx`: appena cambiamo l’ordine della lista, la selezione diventa fragile.
- `src/lib/backgroundSync.ts`: la history in memoria viene accumulata in ordine crescente, quindi anche rientrando nella pagina si rischia di mantenere l’ordine sbagliato.
- `src/components/outreach/EmailInboxView.tsx` e `EmailDetailView.tsx`: il pattern di containment/scroll non è normalizzato ovunque (`min-h-0`, `overflow-hidden`, scroll solo locale), quindi alcuni layout possono ancora spingere in basso la pagina.
- `src/hooks/useEmailSync.ts` contiene ancora una vecchia `useContinuousSync`, mentre la versione nuova sta in `src/hooks/useContinuousSync.ts`: è codice morto/pericoloso.
- `supabase/functions/check-inbox/index.ts` è molto lungo e oggi non ha un passaggio condiviso di normalizzazione finale del body: per questo alcune mail finiscono ancora come blob base64/encoded HTML invece che come HTML leggibile.
- La fallback MIME parser gestisce bene molti casi, ma non copre ancora in modo robusto alcuni body HTML annidati / encoded / immagini inline problematiche.

Piano di implementazione
1. Contenimento layout
- Separare il layout del tab “Download Email” dagli altri tab di Settings.
- Rendere il download tab full-bleed: niente `max-w-4xl`, niente scroll della pagina padre.
- Applicare `min-h-0` / `overflow-hidden` ai contenitori chiave.
- Consentire scroll solo in:
  - lista mail a sinistra
  - corpo preview a destra

2. Ordine corretto della live list
- Cambiare la live subscription e la history locale in ordine newest-first.
- Prepend delle nuove mail in alto invece di append in basso.
- Sostituire `selectedIdx` con `selectedEmailId` per evitare salti/bug quando arrivano nuovi elementi.
- Eliminare l’auto-scroll al fondo; se serve, mantenere focus/preview sul messaggio corretto senza far “scendere” l’interfaccia.

3. Recupero leggibilità delle mail già salvate
- Introdurre una utility condivisa di normalizzazione contenuto email usata sia nella preview standard sia nella pagina download.
- Euristiche previste:
  - se il body sembra base64, decodifica una volta
  - se sembra quoted-printable o raw MIME, decodifica una volta
  - se contiene HTML entity/markup codificato, normalizza prima del render
- Questo permette di migliorare anche mail già presenti nel database, senza doverle cancellare o riscaricare.

4. Hardening parser per i nuovi download
- Aggiungere la stessa normalizzazione finale dentro `check-inbox` prima del salvataggio.
- Rafforzare il fallback multipart per casi `text/html` annidati, body encoded e immagini inline non lette bene.
- Mantenere intatto il fast-forward su UID duplicati: le mail già scaricate non vanno ripassate davvero.

5. Pulizia tecnica
- Rimuovere o isolare la vecchia `useContinuousSync` rimasta in `useEmailSync.ts`.
- Centralizzare la logica di sync/progress per evitare drift tra implementazioni.
- Spezzare `EmailDownloadPage.tsx` in componenti più piccoli.
- Estrarre dal `check-inbox` almeno il blocco decode/normalization in helper separati, senza riscrivere tutta la funzione IMAP.

File coinvolti
- `src/pages/Settings.tsx`
- `src/pages/EmailDownloadPage.tsx`
- `src/lib/backgroundSync.ts`
- `src/components/outreach/EmailInboxView.tsx`
- `src/components/outreach/EmailDetailView.tsx`
- `src/components/outreach/email/EmailHtmlFrame.tsx`
- `src/components/outreach/email/emailUtils.ts` oppure nuova utility dedicata
- `src/hooks/useContinuousSync.ts`
- `src/hooks/useEmailSync.ts`
- `supabase/functions/check-inbox/index.ts` più helper estratti nella stessa cartella

Dettagli tecnici
- Root cause del comportamento “scende in basso”: append in lista + `scrollIntoView` sul fondo.
- Root cause della pagina che si allunga: wrapper `max-w-4xl`/`overflow-auto` in `Settings.tsx` + containment non abbastanza rigido nei pannelli email.
- Root cause delle mail illeggibili: manca un layer condiviso di body normalization tra parser e renderer.
- Root cause del rischio regressioni: doppia implementazione del continuous sync e file troppo lunghi nei punti più sensibili.

Verifica finale
- le nuove mail compaiono in alto
- la lista scorre dentro il suo container, non la pagina intera
- la preview scorre solo nel body, con header fermo
- il tab download usa tutta la larghezza utile
- le mail già salvate ma “sporche” tornano leggibili in UI
- il download continua a saltare i duplicati senza riscaricare tutto
- aggiungo anche regressioni mirate per i casi peggiori: base64 HTML, quoted-printable HTML, multipart con `cid:` e duplicate UID
