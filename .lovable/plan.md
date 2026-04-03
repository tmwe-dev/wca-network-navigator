

# Piano: Aggiungere scroll al container preview email

## Problema
Il container della preview email ha `overflow-hidden` e un'altezza fissa (`calc(100vh - 260px)`). L'iframe `EmailHtmlFrame` si auto-ridimensiona all'altezza completa dell'email, ma il container lo taglia. Se l'email inizia con un'immagine grande, il testo sotto viene nascosto.

## Soluzione
Cambiare `overflow-hidden` in `overflow-y-auto` nel div container della preview in `EmailSlide`, così l'utente può scrollare per vedere tutto il contenuto dell'email.

### File: `src/pages/EmailDownloadPage.tsx` (riga 252)

Sostituire:
```
overflow-hidden
```
con:
```
overflow-y-auto
```

Una modifica di una parola che abilita lo scroll verticale nel riquadro di anteprima.

