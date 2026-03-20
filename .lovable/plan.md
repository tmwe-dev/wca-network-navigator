

## Piano: Terminale Download come Dialog/Popup

### Problema
Il `DownloadTerminal` è attualmente inline in fondo alla colonna dei paesi o sotto il pannello partner — posizione scomoda, l'utente non può seguire il progresso del download senza scrollare in basso.

### Soluzione
Trasformare il terminale in un **Dialog popup** (come già fatto per `JobTerminalViewer`), rimuovendo le istanze inline e aggiungendo un pulsante per aprirlo.

### Modifiche

**File 1: `src/components/download/DownloadTerminal.tsx`**
- Wrappare il contenuto esistente in un `Dialog` con `DialogContent`
- Esportare come `DownloadTerminalDialog` con props `open` / `onOpenChange`
- Stile: `max-w-2xl`, sfondo `bg-slate-950`, altezza terminale generosa (~400px)
- Riutilizzare tutta la logica log/auto-scroll già presente

**File 2: `src/pages/Operations.tsx`**
- Rimuovere le 3 istanze inline di `<DownloadTerminal />` (righe 283, 339, e nel PartnerListPanel)
- Aggiungere stato `terminalOpen` e un pulsante `Terminal` nella top bar (accanto ai filtri o nell'ActiveJobBar) che apre il dialog
- Renderizzare `<DownloadTerminalDialog open={terminalOpen} onOpenChange={setTerminalOpen} />` una sola volta a livello pagina

**File 3: `src/components/operations/PartnerListPanel.tsx`**
- Rimuovere l'import e l'istanza di `<DownloadTerminal />` (riga 323)

### Risultato
Il terminale diventa un overlay accessibile da qualsiasi punto della pagina, apribile con un click sul pulsante Terminal nella barra superiore, senza occupare spazio nel layout.

