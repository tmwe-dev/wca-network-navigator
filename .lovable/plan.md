# Command — pulizia totale dello stato vuoto

## Decisione di prodotto

Lo stato vuoto della pagina `/v2/command` oggi è rumore. Le tue indicazioni:

- **Niente briefing** ("Buongiorno, ho 4784 email…") — quei dati vivono già altrove (Inbox, Approval queue).
- **Niente snapshot numerico** ("14 sorgenti · 12.847 contatti · 234 partner · 1.420 BCA") — distrae.
- **Nessun suggerimento** ("Cerca i partner di Malta", "Scrivi mail a Luca Arcanà…") — meglio nulla che ultimi prompt buttati lì senza ragionamento commerciale. L'utente fa le sue ricerche.

Risultato: una landing zen — solo titolo, l'orb AI, e l'input. L'utente arriva e *parla*.

## Cosa resta visibile sullo stato vuoto

```text
                  [ AI Orb pulsante ]

                  Cosa vuoi ottenere?

                ( input + microfono )
```

Nient'altro. Niente chip, niente proposte, niente snapshot, niente briefing.

## Modifiche tecniche

**File toccato**: `src/v2/ui/pages/CommandPage.tsx`
- Rimuovere il render di `<BriefingPanel>` nel ramo `isEmpty` (riga ~193).
- Rimuovere import `BriefingPanel` e `useCommandBriefing` se non più usati.

**File toccato**: `src/v2/ui/pages/command/components/CommandSuggestions.tsx`
- Eliminare il blocco "allPrompts" (suggerimenti dinamici + fallback statici) e il blocco "capabilities".
- Lasciare solo: AI orb + titolo "Cosa vuoi ottenere?". Niente sottotitolo con i numeri.
- (In alternativa: eliminare il file e inline il minimo nello stato vuoto della CommandPage. Decido in implementazione, dipende da quanti consumer ha.)

**File da archiviare (non eliminare)**:
- `src/v2/ui/pages/command/components/BriefingPanel.tsx`
- `src/v2/ui/pages/command/hooks/useCommandBriefing.ts`

Restano sul filesystem (regola progetto: non cancellare componenti potenzialmente in sviluppo) ma non più importati. Se in futuro vorrai un "briefing intelligente" davvero ragionato, partiremo da lì.

## Cosa NON tocco

- Header alto della pagina (Dashboard, Sessione attiva, Monitor, Realtime, IT, "Cosa posso fare").
- Composer / input / voice.
- Logica conversazione, scenari, tool execution.
- Bottom dock azioni (Source Unification, Search Partners, ecc.) — quello è un menu rapido strumenti, non un suggerimento commerciale: resta.

## Nota sulla visione (per dopo)

Hai detto chiaramente: *"il sistema deve assistere un ufficio commerciale autonomo"*. Quando vorrai reintrodurre proposte sotto il titolo, il pattern giusto sarà **regole DAL → AI ragiona → 1-2 next best action commerciali** (partner inattivi da X giorni, BCA mai contattate, missioni ferme). Lo apriremo come progetto a sé — `command-next-best-action` — non come patchwork di "ultimi prompt".

Per ora: **silenzio pulito**.