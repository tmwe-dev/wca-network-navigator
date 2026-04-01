

# Aggiungere Bottone "Test LinkedIn" nel Cockpit

## Cosa si fa

Aggiungere un bottone visibile nella barra superiore del Cockpit (TopCommandBar) che apre direttamente la pagina `/test-linkedin` all'interno dell'applicazione, senza dover digitare URL.

## Modifica

### File: `src/components/cockpit/TopCommandBar.tsx`

- Importare `useNavigate` da `react-router-dom` e l'icona `FlaskConical` da lucide-react
- Aggiungere un bottone compatto (icona + testo "Test LI") nella barra, accanto ai controlli esistenti (view mode, search)
- Al click → `navigate("/test-linkedin")`
- Stile: `variant="outline"` piccolo, con icona beaker/flask per indicare che è un test diagnostico

### Dettagli tecnici

Un solo file modificato, una sola aggiunta: un `<Button>` con `onClick={() => navigate("/test-linkedin")}`.

