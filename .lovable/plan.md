## Problema

Nel Cockpit la pipeline funziona (Sherlock → KB → Calligrafia → Giornalista), ma all'utente mancano gli stessi controlli che ha in Email Forge / Composer:

1. **Obiettivo libero ("testo dell'Oracolo")** — il campo dove digiti *cosa vuoi dire* (es. "proporre tariffa LCL Genova→Tunisi, sconto introduttivo, urgenza fine mese").
2. **Elementi da inserire** — il brief strutturato (punti, USP, link, allegati da menzionare).
3. **Migliora bozza** — far rilavorare l'AI sulla bozza corrente.
4. **Editing assistito** — modificare il testo e ricevere suggerimenti / re-pass dell'AI.

Tutto questo deve restare coerente con il fatto che il Cockpit lavora **N contatti contemporaneamente** (drag bulk → `draftQueue`).

## Strategia consigliata

**Una sola configurazione condivisa, applicata a tutta la selezione.**

- Tipo email, tono, KB, **obiettivo libero**, **brief strutturato** vivono già in `ComposeAiConfigContext` (storage `compose-ai-config-v1`) e sono editabili dalla **sidebar a scomparsa** già montata sul Cockpit (`ContextFiltersRail` → `EmailComposeFiltersSection`).
- Aggiungiamo nella stessa sidebar i due campi che oggi mancano: **Obiettivo (Oracolo)** e — quando serve — la microcard "deep search del destinatario" (già live nel Forge).
- L'utente fissa l'intento *una volta sola*, poi droppa N contatti: `useCockpitLogic.generate()` legge `cfg.customGoal + cfg.brief + cfg.selectedType.prompt` e li passa a tutti i destinatari (già lo fa).

**Per-bozza (azioni non condivisibili) restano nello studio a destra:**
- Editor del body con preview/HTML.
- Pulsante **Migliora** che rilancia `useEmailForge.run({ base_proposal: bodyAttuale, goal: cfg.customGoal })` per quel singolo contatto.
- Pulsante **Rigenera** (già presente).
- Suggerimenti post-edit (riusiamo `EmailEditLearningDialog` già esistente in Composer): se l'utente modifica manualmente la bozza prima di inviare, al click su Invia si apre il dialog "salva come pattern / invia senza salvare".

## Cosa cambia (UI)

### A. Sidebar `EmailComposeFiltersSection` (un solo file)
Aggiungere in cima alla sezione:
- `Textarea` **Obiettivo email (Oracolo)** legata a `cfg.customGoal` (con micro-helper "vale per tutti i contatti selezionati").
- Riga informativa "🎯 Si applica a N contatti" quando `selection.count > 1`.

Il resto (tipo / tono / brief / KB) è già lì.

### B. `AIDraftStudio` (pannello destro Cockpit)
- Trasformare il blocco "Messaggio" del tab **Preview** da read-only (TypewriterText) a un `Textarea`/`contenteditable` semplice quando la generazione è finita. Lo stato vive già in `draftState.body` via `onDraftChange`.
- Aggiungere accanto ai bottoni Copia/Rigenera un bottone **Migliora** (icona `Wand2`) che chiama una nuova action `handleImprove(draftState)` esposta da `useCockpitLogic`.
- Mostrare lo `JournalistBadge` aggiornato dopo Migliora (già supportato).

### C. `useCockpitLogic`
Aggiungere `handleImprove()`:
```
const handleImprove = async () => {
  const r = await forge.run({
    ...stessi parametri della generate corrente...,
    base_proposal: draftState.body,    // bozza attuale come base
    goal: `${cfg.customGoal}\n\nMIGLIORA mantenendo voce e intento.`,
  });
  if (r) setDraftState(prev => ({ ...prev, subject: r.subject, body: r.body, journalist_review: r.journalist_review, ... }));
};
```
Nessun cambio al backend: `generate-email` già accetta `base_proposal` e attiva il path "improve" della pipeline.

### D. Bulk
- Il `draftQueue` resta com'è. Aggiungiamo nel banner "Bulk: N bozze generate" due frecce ◀ ▶ per scorrere le bozze (già accumulate in queue) e poter editare/migliorare ognuna prima di inviare.
- Migliora opera sempre sulla bozza visibile.

## Cosa NON cambia
- `generate-email` edge function.
- Editorial Review (Giornalista) resta obbligatorio e inviolato.
- Sherlock / KB / Calligrafia: già iniettati dalla pipeline unica.
- Nessuna duplicazione di salvataggi o invii: `handleImprove` riusa la stessa `forge.run` (no side-effect).

## File toccati (stima)
- `src/components/global/filters-drawer/EmailComposeFiltersSection.tsx` — aggiungere Textarea obiettivo + hint bulk.
- `src/components/cockpit/AIDraftStudio.tsx` — body editabile + bottone Migliora.
- `src/hooks/useCockpitLogic.ts` — esporre `handleImprove`, navigazione queue (prev/next).
- `src/v2/ui/pages/CockpitPage.tsx` — collegare prev/next nel banner bulk.

## Check finale (regole interne)
- Pipeline unica Email Forge ✅ (no duplicati).
- Giornalista sempre attivo ✅.
- Bulk preservato, ordine queue stabile ✅.
- Nessun nuovo invio o side-effect ✅.
- Logica solo frontend, niente RLS / edge / DB.
