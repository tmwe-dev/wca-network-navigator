

# Aggiunta Sezione LinkedIn nelle Impostazioni

## Approccio

Anziche username/password (bloccato da LinkedIn), usiamo lo stesso approccio dei cookie di sessione gia funzionante per WCA. L'utente effettua il login manualmente su LinkedIn nel browser, e il sistema cattura il cookie di sessione per poter accedere ai profili.

In aggiunta, salviamo anche le credenziali LinkedIn (email/password) per riferimento e per un eventuale futuro auto-login tramite estensione Chrome, ma il metodo principale resta il cookie `li_at`.

## Cosa viene aggiunto

### Nella tab WCA (o nuova tab dedicata)

Una nuova Card "LinkedIn" nella pagina Settings con:
- **Email LinkedIn** (input text)
- **Password LinkedIn** (input password con toggle visibilita)
- **Cookie di sessione `li_at`** (textarea) - il cookie principale che LinkedIn usa per l'autenticazione
- Istruzioni su come ottenere il cookie: "Accedi a linkedin.com, apri DevTools (F12) > Application > Cookies > linkedin.com > copia il valore di `li_at`"
- Pulsante "Salva"
- Badge "Configurato" / "Non configurato"

### Storage

Tutto salvato nella tabella `app_settings` esistente con le chiavi:
- `linkedin_email`
- `linkedin_password`
- `linkedin_session_cookie` (il cookie `li_at`)

Nessuna migrazione database necessaria.

## Dettagli Tecnici

### File da modificare

**`src/pages/Settings.tsx`**
- Aggiungere una nuova Card nella tab "WCA" (dato che sono servizi esterni correlati), oppure rinominare la tab in "Connessioni" per includere WCA + LinkedIn
- Alternativa: creare una tab dedicata "LinkedIn" con icona dedicata

La scelta migliore e aggiungere la sezione LinkedIn direttamente nella tab WCA, rinominandola "Connessioni" con icona `Globe`, dato che sia WCA che LinkedIn sono servizi esterni per il reperimento dati partner.

### Struttura della Card LinkedIn

```text
Card: LinkedIn
  Header: icona LinkedIn + titolo + badge stato
  Content:
    - Input: Email LinkedIn
    - Input: Password LinkedIn (con toggle eye)
    - Separator
    - Label: "Cookie di sessione (li_at)"
    - Textarea: per incollare il cookie
    - Info: istruzioni per ottenere il cookie
    - Button: "Salva Credenziali LinkedIn"
```

### Integrazione futura

Una volta salvato il cookie `li_at`, la edge function `deep-search-partner` potra usarlo per:
- Accedere direttamente ai profili LinkedIn dei contatti trovati
- Verificare informazioni come ruolo attuale, esperienza, foto profilo
- Estrarre dati piu completi rispetto alla sola ricerca Google

Questa integrazione nella edge function sara un passo successivo dopo aver configurato il salvataggio delle credenziali.

## Risultato

L'utente avra un'area dedicata dove inserire le proprie credenziali LinkedIn e il cookie di sessione. Il sistema usera queste informazioni per accedere ai profili LinkedIn in modo piu affidabile durante la Deep Search.
