## Diagnosi

Ho ricostruito gli ultimi 4 push sul codice della Command:

| Commit | File | Tipo modifica | Può rompere il render? |
|---|---|---|---|
| `6c59cc410` | `localResultFormatter.ts` | Cambiate 3 etichette azioni suggerite (testo) | No |
| `97170ee47` | `aiBridge.ts` | Aggiunto blocco testuale al prompt AI | No |
| `6beb62ae6` | `batchEnrichPartners.ts` + `registry.ts` | Nuovo tool + registrazione | No |
| `977f13739` | `CommandPage.tsx` | **Mio fix anti-sparizione messaggi** | È il fix |

**Nessuno dei 3 push precedenti tocca i file di rendering della chat** (`CommandThread.tsx`, `CommandPage.tsx`, `useConversation.ts`, `useCommandSubmit.ts`). Si limitano a cambiare testo dei prompt/etichette e aggiungere un tool.

## Causa reale della sparizione

Bug vecchio nel `useEffect` di rehydrate in `CommandPage.tsx`. Riascoltava `conv.messages.length`: ogni `addMessage` persistito sul DB faceva ripartire il rehydrate, che sovrascriveva i messaggi RAM con uno snapshot DB stantio → il messaggio assistant scompariva subito dopo essere apparso.

Era latente da prima dei 3 push; si è manifestato di più adesso perché la nuova logica fa più append rapidi (utente, automation, direttore, suggested actions).

## Stato attuale

Il commit `977f13739` (già in `main`) introduce `pendingConversationLoadRef`: il rehydrate parte **solo** quando l'utente clicca una conversazione in sidebar, mai durante append normali.

## Cosa propongo

**Nessun rollback necessario.** I 3 push precedenti sono modifiche di testo/registry, isolate e utili. Il fix al render è già attivo.

Azione: ricarica la pagina `/v2/command`, manda un prompt e verifica che il messaggio del Direttore resti visibile. Se sparisce ancora, raccolgo log specifici di `useConversation` + `useCommandSubmit` e isolo il path residuo.

Se invece vuoi tornare comunque a uno stato pre-3-push, posso revertire `6c59cc410`, `97170ee47`, `6beb62ae6` mantenendo solo il fix `977f13739` — ma perderesti azioni "comunicazione-first" e il tool batch-enrich.

## Dettagli tecnici

- File toccato dal fix: `src/v2/ui/pages/CommandPage.tsx` (effetto rehydrate + handler `onSelect`/`onNew` della sidebar)
- Nessuna migrazione DB, nessuna edge function toccata
- Compatibile con `useConversation` esistente (nessun cambio di firma)
