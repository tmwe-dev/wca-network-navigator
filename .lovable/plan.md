

## Rimozione della "tendina" (backdrop overlay) dalla sidebar

### Problema
In `src/components/layout/AppLayout.tsx` (righe 40-52), quando la sidebar si apre, viene mostrato un overlay fisso con `bg-background/60 backdrop-blur-[2px]` che copre tutto lo schermo. Questo overlay crea un effetto "tendina" (velo semitrasparente sfocato) davanti al contenuto della pagina, incluso il Partner Hub. In certi casi (mouse che esce dal browser, transizioni rapide), l'overlay potrebbe anche restare visibile erroneamente.

### Soluzione
Rimuovere completamente il backdrop overlay (`AnimatePresence` + `motion.div` alle righe 41-52). La sidebar si chiude già automaticamente con `onMouseLeave` e cliccando fuori non serve un overlay dedicato — basta che la sidebar scivoli via.

### File da modificare

| File | Modifica |
|---|---|
| `src/components/layout/AppLayout.tsx` | Rimuovere il blocco `AnimatePresence` con il backdrop (righe 40-52). Aggiungere un semplice click-outside handler al div principale per chiudere la sidebar quando si clicca fuori. |

