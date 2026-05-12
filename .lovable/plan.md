## Punto della situazione

Lo screenshot di `/v2/inbox` mostra tre problemi che si ripetono in tutte le viste email del sistema (Inbox, Funnemail, Email Intelligence, Holding, Smart Inbox):

1. **Contrasto basso**: testo del preview, mittente secondario, date e suggerimenti vivono su `text-muted-foreground/70` su sfondo molto scuro → quasi illeggibili.
2. **Gruppi senza colore**: il DB tiene `email_address_groups.colore` e `icon`, ma `EmailMessageList` mostra il badge gruppo con un fisso `bg-primary/15` ignorando il colore. Risultato: nessuna differenziazione visiva tra "partner", "newsletter", "fornitori", ecc.
3. **Manca un badge "tipo contenuto"**: oggi vediamo solo "Non classificata" / "partner" generici. Non si capisce a colpo d'occhio se è una newsletter, una richiesta, un bounce, una notifica LinkedIn, un report.
4. **Azioni nascoste**: i pulsanti "Deep Search · Azioni · Assegna gruppo" appaiono uguali per tutte le righe, non hanno gerarchia, e i tooltip ("Assegna a un gruppo") flottano in modo confuso (visibile in screenshot).

Inoltre l'utente vuole una **mappa esplicita** di cosa il sistema sa già fare intorno alle email.

---

## Mappa attività email esistenti (cosa il sistema può già fare)

### Lettura & sincronia
- Scarico nuove email (IMAP `check-inbox`), download massivo, auto-sync, reset cursore.
- Sincronia continua con progress, pausa notturna automatica.
- Visualizzazione per canale (Email / WhatsApp / LinkedIn) nello stesso pannello Inbox.

### Classificazione & gruppi
- Classificazione automatica via `classify-emails-batch` + learning loop (dominio/mittente).
- Assegnazione manuale a gruppo (icona + colore) tramite `InlineGroupAssigner`.
- Suggerimenti AI di nuovi gruppi (`suggest-email-groups`) editabili da Prompt Lab.
- Categorie: partner, newsletter, notifiche, automatiche, spam, archiviata, ecc.

### Regole & azioni automatiche
- `email_address_rules`: per mittente, scegli fra `mark_read`, `archive`, `hide`, `spam`, `move_to_folder` (+ folder target), con o senza retro-applicazione su storico (`apply-email-rules`, `backfill-email-rules`).
- Cartelle IMAP: `manage-email-folders` permette move, archive, spam, delete, list_folders, create_folder direttamente sul server di posta.
- Soft-delete UI (`hidden_by_rule`) senza toccare IMAP.
- Bulk action toolbar (`MultiSelectBulkBar`) per applicare azione a N email selezionate.

### Intelligence & risposta
- Editorial review obbligatorio su qualsiasi email generata (`journalistReview`).
- Generazione risposta (`generate-email`) e miglioramento (`improve-email`) via Prompt Lab.
- Classificazione delle risposte in arrivo (`classify-email-response`) con escalation automatica del `lead_status`.
- Autoresponder template-only via `funnemail-send-autoresponder`.
- Funnemail claim "Lo prendo io" + realtime banner su email orfane.
- Bounce automation (hard/soft) via `check-inbox`.

### Ricerca & contesto
- Deep Search (Sherlock Scout/Detective/Sherlock) per arricchire il mittente.
- Apertura partner/contact drawer dal messaggio.
- Holding pattern: chip ✈️ pulsante per contatti in pausa controllata.

### Governance
- Prompt Lab Catalog: ogni prompt operativo email è versionato, testabile, modificabile da DB.
- AI Interaction Log con thumbs up/down su ogni messaggio AI.
- Pipeline Traces viewer (`/v2/pipeline-traces`) per vedere passo-passo cosa fa la pipeline su una mail.

---

## Cosa propongo (ergonomia + chiarezza)

### A. Leggibilità (alto impatto, basso rischio)
- Promuovere il testo preview da `text-muted-foreground/70` a `text-foreground/85` e i meta da `/50` a `/70`.
- Aumentare il contrasto delle date (oggi `text-muted-foreground/60`) e dei "Pag. 1 · 50 vis.".
- Tooltip ("Assegna a un gruppo") spostati in posizione stabile sotto il pulsante e con sfondo `bg-popover` opaco (oggi sembra fluttuare staccato).
- Risolvere lo "stato vuoto" del subject (mostrato solo "I: Candidatura spontanea") con peso e dimensione corretti.

### B. Gruppi colorati riconoscibili (alto impatto)
- `EmailMessageList`: usare `group.groupColor` come `borderLeft` sticker della riga (4px) + come `background` del badge gruppo (con fallback se colore null).
- Badge gruppo con icona emoji + nome + pallino colore, non più "primary/15" generico.
- Aggiungere una **legenda gruppi** collassabile in cima alla lista (chip cliccabili → filtro istantaneo per gruppo).

### C. Badge "tipo contenuto" (nuovo)
- Mostrare il `category` (newsletter, notifica, partner, bounce, automatica, richiesta, ecc.) come pill colorato accanto al gruppo.
- Mappare ogni categoria a un colore semantico definito in `index.css` (no colori inline).
- Quando la categoria è "non_classificata" mostrare azione rapida "Classifica con AI" inline, non solo il badge grigio.

### D. Pannello azioni più chiaro
- Riorganizzare la toolbar di riga in tre cluster con separatori sottili:
  1. **Apri/Leggi** (Apri drawer · Segna letta · Rispondi rapido)
  2. **Organizza** (Assegna gruppo · Sposta cartella · Archivia · Spam · Nascondi)
  3. **Approfondisci** (Deep Search · Crea regola mittente · Vai a partner)
- Dropdown "Azioni" con sezioni etichettate invece di lista piatta.
- Su hover, evidenziare l'intera riga (oggi cambia solo il bg del subject).

### E. "Punto della situazione" — header inbox
- Sostituire la riga "951 in db · pag. 1 · 50 vis." con un header informativo:
  - N. non lette per gruppo (chip)
  - N. in attesa di classificazione AI
  - N. con regola pendente/da applicare
  - Ultimo sync ed eventuale cron in pausa
- Pulsante "Cosa può fare l'AI qui" → drawer con la mappa attività di sopra (così l'operatore scopre le funzioni esistenti).

### F. Promp/azioni personalizzate visibili
- Sul detail di un'email, sezione "Automatizza questo mittente" con:
  - Anteprima della regola che verrà creata
  - Toggle "Applica anche allo storico"
  - Link a Prompt Lab per modificare il prompt che ha classificato questa mail
- Dal menu Azioni, voce "Crea prompt personalizzato per questa categoria" che apre il Prompt Lab pre-compilato.

---

## Dettagli tecnici (per sviluppo)

- File da toccare per A+B+C+D: `src/components/outreach/EmailMessageList.tsx`, `src/components/outreach/EmailMessageActions.tsx`, `src/components/outreach/email/InlineGroupAssigner.tsx`, `src/v2/ui/molecules/email/MailRowChrome.tsx`, `src/hooks/useEmailAddressGroups.ts` (esporre già `groupColor` — c'è).
- Aggiungere token semantici in `src/index.css` per categorie email (`--cat-newsletter`, `--cat-notification`, `--cat-partner`, `--cat-bounce`, `--cat-request`, `--cat-auto`).
- Header inbox (E): nuovo organismo `src/v2/ui/organisms/inbox/InboxStatusBar.tsx` montato dentro `EmailInboxView`.
- Drawer "Cosa può fare l'AI qui": nuovo `src/v2/ui/organisms/inbox/InboxCapabilitiesDrawer.tsx` con il contenuto della mappa attività.
- **Niente modifiche** a `check-inbox`, `email-imap-proxy`, `mark-imap-seen` (vincolo memoria).
- Nessun refactor della logica di sync, solo presentazione.

---

## Cosa scelgo di fare nel primo round (proposta)

Per rispettare l'atomicità (Vol II), spaccherei in due interventi separati:

1. **Round 1 — Leggibilità + gruppi colorati + badge categoria** (A, B, C). Cambio puramente UI/CSS, zero rischio sul flusso.
2. **Round 2 — Pannello azioni + status bar + drawer capability map** (D, E, F). Richiede nuovi componenti.

Confermi che parto dal Round 1, oppure preferisci che l'ordine sia diverso (es. prima la mappa attività)?