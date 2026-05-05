## Aggiungere voce "Logout" al NavMenuPopover

Il logout esiste già nel dropdown ⋯ Strumenti dell'header. L'utente chiede di aggiungerlo anche nel **menu di navigazione principale** (☰ NavMenuPopover) come tab/voce dedicata.

### Modifica
File: `src/v2/ui/templates/NavMenuPopover.tsx`

1. Importare `LogOut` da lucide-react e `useAuthV2` da `@/v2/hooks/useAuthV2`.
2. In fondo al popover (dopo il blocco Development), aggiungere un separatore e un bottone "Logout" che chiama `signOut()` dal hook (stesso pattern già usato in `HeaderToolsMenu`, garantito non-loop).
3. Stile rosso (`text-destructive`) per distinguerlo come azione di uscita.

### Note
- Nessun cambio di logica di auth: si riusa lo stesso `signOut` già funzionante.
- Cambiamento puramente UI/presentational, isolato a un file.
