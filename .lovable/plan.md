
Obiettivo: refactoring completo della maschera Operations per risolvere definitivamente 2 problemi: download che non parte e scroll bloccato.

1) Refactor sessione WCA (blocco download)
- `src/hooks/useWcaSession.ts`
  - Separare stato: `extensionAvailable`, `sessionActive`, `isChecking`, `lastError`.
  - Rendere `ensureSession()` strict per download: prima verifica estensione, poi verifica sessione, poi auto-login via estensione, poi re-verify.
  - Rimuovere fallback server-side dal percorso operativo download (tenere solo eventuale utilità diagnostica separata).
- `src/lib/download/sessionVerifier.ts`
  - Stessa logica strict del punto sopra.
  - Se estensione non disponibile: return immediato con errore esplicito.
- `src/hooks/useDownloadProcessor.ts`
  - Preflight obbligatorio prima del loop: estensione disponibile + sessione valida.
  - Se preflight fallisce: job in `paused` con motivo tecnico chiaro, senza tentativi vuoti.

2) Refactor UX avvio download (niente “non parte” silenzioso)
- `src/components/operations/PartnerListPanel.tsx`
  - Bottone download con stati espliciti: “Verifica estensione…”, “Sessione non attiva”, “Scarica N profili”.
  - Banner bloccante in alto quando estensione assente con CTA a `/download-wca-extension.html`.
- `src/components/download/ActionPanel.tsx`
  - Allineare la stessa logica di preflight e messaggistica.
- `src/components/download/WcaSessionIndicator.tsx`
  - Mostrare stato reale condiviso del hook (non “sconosciuto” permanente).

3) Refactor layout/scroll (elimina blocchi e nested-scroll instabile)
- `src/pages/Operations.tsx`
  - Rimuovere catena di `overflow-hidden` sul contenitore principale.
  - Struttura unica: header fisso + area centrale `flex-1 min-h-0` + scroller espliciti.
- `src/components/download/CountryGrid.tsx`
  - Convertire lo scroller lista paesi a wrapper nativo `overflow-y-auto` (con `min-h-0`) per evitare lock da nested ScrollArea.
- `src/components/operations/PartnerListPanel.tsx`
  - Stesso approccio: un solo scroller verticale principale per la lista partner.
- `src/components/layout/AppLayout.tsx`
  - Route-aware overflow per Operations: niente doppio livello competitivo di scroll (`main` + child).

4) Refactor coerenza estensione distribuita
- `public/download-wca-extension.html`
  - Eliminare `content.js` inline hardcoded e scaricarlo da `/chrome-extension/content.js` (come già fatto per `background.js`) per evitare drift futuro.
  - Versione visualizzata coerente con estensione reale.
- `public/chrome-extension/*`
  - Tenere `manifest/content/background` come unica source of truth.

5) Validazione end-to-end dopo refactor
- Test 1: Operations con molti paesi/partner → scroll fluido fino in fondo in ogni pannello.
- Test 2: Estensione assente → bottone download bloccato con motivo esplicito (nessun job sporco creato).
- Test 3: Estensione presente + sessione scaduta → auto-login estensione, sessione attiva, job parte.
- Test 4: AF “senza profilo” → download profili rieseguito, contatore “Senza Profilo” si aggiorna correttamente.
- Test 5: refresh pagina durante job → recovery senza duplicazioni e senza freeze UI.
