
L'utente vuole che verifichi la build e faccia un test E2E rapido sulla pagina `/v2/command`. Sono in modalità plan (read-only), quindi presento il piano di verifica che eseguirò una volta approvato.

## Piano di verifica build + E2E `/v2/command`

### 1. Verifica build
- `npx tsc --noEmit` per controllare che non ci siano errori TypeScript residui dopo le modifiche di FASE 1+2 (types estesi, nuovi hook, canvas riscritti).
- `npm run lint` mirato sui file toccati (`src/v2/ui/pages/command/**`, `src/components/workspace/CanvasViews.tsx`).
- `npm run build` per validare che Vite produca il bundle senza errori.

### 2. Smoke test browser su `/v2/command`
Uso il browser tool per:
- Navigare a `/v2/command` (assumendo sessione già attiva nel preview).
- Screenshot iniziale per verificare che la pagina monti senza error boundary.
- Inviare un prompt reale: **"cerca i miei partner in Italia"** → verifica che:
  - Il canvas tabellare appaia con badge LIVE
  - Le checkbox siano visibili sulle righe
  - La barra bulk-action compaia selezionando ≥1 riga
  - Il `LiveActivityRail` sia montato in fondo al canvas
- Screenshot finale del canvas con selezione attiva.

### 3. Verifica console
- `code--read_console_logs` per intercettare eventuali errori runtime (subscription Supabase, render checkbox, ecc.).

### 4. Report finale
Riassunto con: stato build, screenshot canvas, eventuali bug trovati. Se trovo bug li fixo subito (uscendo dalla read-only mode una volta approvato il piano).

### Note operative
- **Nessuna azione distruttiva**: solo lettura partner + selezione UI, nessun outreach effettivo, nessun bulk-action eseguito.
- Se il preview richiede login, mi fermo e te lo segnalo.
- Se il browser tool non è disponibile (rate-limited), ripiego su build + lettura console logs del preview corrente.
