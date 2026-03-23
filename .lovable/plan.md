

# Piano: Aggiungere il Menu Sidebar anche nella Dashboard

## Problema

In `AppLayout.tsx`, la sidebar e l'header sono nascosti quando `isHomeRoute` (path `/`) e' true. L'utente non puo' accedere a Settings, Agents, o altre sezioni dalla homepage.

## Soluzione

Rimuovere la condizione `!isHomeRoute` che nasconde la sidebar e l'header. In questo modo il menu hamburger e la barra superiore saranno visibili su tutte le pagine, inclusa la Dashboard.

## Modifiche

| File | Azione |
|------|--------|
| `src/components/layout/AppLayout.tsx` | Rimuovere i 3 check `!isHomeRoute` che nascondono sidebar e header. Rimuovere `isHomeRoute` dalla variabile `isFullscreenRoute` se necessario. |

Il risultato: sulla Dashboard appare lo stesso header compatto con il bottone menu hamburger in alto a sinistra, identico a tutte le altre pagine. L'utente puo' aprire la sidebar e navigare ovunque.

