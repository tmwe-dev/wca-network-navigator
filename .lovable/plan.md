## Problema

Sul tab background, la pagina profilo LinkedIn non sempre finisce di renderizzare entro i **6 s** (20×300 ms) di polling attuale di `probeMessageButton`. Quando scade, l'estensione esce con `profile_not_ready` **senza nemmeno tentare il click**. Risultato: errore anche quando in realtà LinkedIn era a un soffio dal montare il bottone.

Inoltre il probe attuale è "tutto o niente": non aspetta che la tab sia in stato `complete`, e la heuristic `messaggi|message|...` può non matchare la lingua corrente (es. UI inglese senza match esatto del bottone profile-action principale).

## Cosa cambio (solo `sendLinkedInMessageWithMethod` in `public/linkedin-extension/actions.js`)

Modifica chirurgica, isolata al test/invio "with method". Non tocco `sendLinkedInMessage` (outreach reale) né hybrid-ops/manifest.

### 1. Attesa "tab complete" prima del polling
Subito dopo `ensureTabVisibleAndWait`, polling fino a 4 s su `chrome.tabs.get(tab.id).status === "complete"`. Dà al renderer il tempo di finire la navigazione anche in background, prima di iniziare a cercare il bottone.

### 2. Polling profilo più lungo e più tollerante
- Da **6 s (20×300 ms)** a **15 s (30×500 ms)**: tab in background montano lenti.
- `probeMessageButton`: oltre al testo, accettare anche **`a[href*='/messaging/compose']`**, **`a[href*='/messaging/thread/']`** scoped al main, e **`button[data-control-name*='message' i]`**. Estendere la regex con `messaggio`, `mensagem`, `wiadomość`.
- Considerare "ready" anche se compare uno dei `pv-top-card` / `artdeco-card` con un `button` qualunque visibile + il bottone Connetti/Segui (segno che la hero card è renderizzata): in quel caso lo "More" potrebbe contenere il messaggio.

### 3. Tentativo ottimistico anche se il probe scade
Se dopo 15 s il bottone non è "visto" dal probe ma la tab è `complete`, **provare comunque** `HybridOps.clickMessage` una volta. `clickMessage` ha il suo scoping interno e a volte trova il bottone nascosto in un menu "More". Se anche quel click fallisce, allora ritornare `profile_not_ready` con il messaggio attuale. Così non penalizziamo i casi al limite.

### 4. Messaggio errore più informativo
Includere lo `status` ultimo della tab e la lunghezza dell'URL corrente nell'errore (es. `profile_not_ready (status=loading, url=/in/gianfranco-...)`), così se ricapita capiamo subito se è un problema di rete o di selettori.

## Cosa NON tocco

- `sendLinkedInMessage` (outreach reale, già funzionante).
- `HybridOps.clickMessage` / `hybrid-ops.js`.
- Manifest, versione estensione (resta **3.9.45**), background.js, ZIP. Solo reload card in `chrome://extensions`.
- Hard guard `wrong_recipient`, dedup, rubrica, trigger DB.

## File toccati

- `public/linkedin-extension/actions.js` — solo dentro `sendLinkedInMessageWithMethod` (righe ~196–270).

## Verifica

1. Reload estensione in `chrome://extensions` (no rimuovi/reinstalla).
2. `/test-extensions` → "Invia LI" sul profilo Gianfranco con tab LinkedIn aperta su feed.
3. Atteso: o invio OK, o errore parlante con `status` + URL invece del generico `profile_not_ready`.
