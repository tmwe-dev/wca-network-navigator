## Audit sintetico

### 1) I due selettori in alto sono tecnicamente diversi, ma oggi sono presentati male

**Selettore operatore** (`OperatorSelector`)
- Serve solo agli amministratori.
- Cambia la vista CRM/app: “io”, “un altro operatore”, oppure “tutti gli operatori”.
- Non c’entra con la casella email da cui leggi o scrivi.

**Selettore casella** (`MailboxSelector`)
- Serve a scegliere la casella di posta attiva: personale, booking, amministrazione, operativo, ecc.
- È visibile a chi ha più di una casella accessibile.
- Non cambia la visibilità globale degli operatori.

**Problema reale:** Luca vede entrambi perché è admin e ha più caselle; per un utente non-admin resta solo il selettore casella. Ma nell’header sembrano due “account selector” uguali, quindi confondono.

### 2) Il bug della tab bianca è confermato nel codice

In entrambe le estensioni esiste ancora questo schema:

```text
chrome.windows.create({ url: "about:blank", ... })
poi chrome.tabs.create({ url: WhatsApp/LinkedIn, windowId: automationWindow })
```

Quindi quando l’estensione crea la finestra di automazione, Chrome apre una finestra con una tab `about:blank`; poi viene aggiunta una seconda tab con WhatsApp o LinkedIn. Questo spiega esattamente quello che descrivi: una pagina bianca + una pagina WA/LI nella stessa finestra. È fragile perché le operazioni successive possono stabilizzare o leggere la tab sbagliata, oppure rimanere agganciate a un placeholder.

## Piano di intervento

### A) Rendere chiara la barra in alto senza duplicare sistemi

1. **Unificare la presentazione in un solo blocco “Contesto operativo”** nell’header.
   - Riga/trigger unico, non due controlli separati visivamente.
   - Dentro al menu: sezione “Visibilità” e sezione “Casella”.

2. **Regole UI:**
   - Utente normale: vede solo le sue caselle disponibili (`Personale`, `Booking`, `Amministrazione`, ecc.).
   - Luca/admin: vede anche “Visibilità: tutti gli operatori / singolo operatore”.
   - Le due funzioni restano distinte internamente, ma la UI le presenta come un unico contesto, non come due selettori concorrenti.

3. **Nessuna modifica alla logica business:**
   - Mantengo `ActiveOperatorContext` per visibilità operatori.
   - Mantengo `ActiveMailboxContext` per casella email.
   - Cambio solo la composizione UI nell’header per evitare confusione.

### B) Correggere la gestione tab WA/LinkedIn

1. **Eliminare la creazione della finestra con `about:blank`.**
   - Quando serve una nuova tab, creare direttamente la tab target con URL reale:
     - `https://web.whatsapp.com`
     - `https://www.linkedin.com/...`
   - Se Chrome obbliga una finestra, la prima tab deve essere già WA/LI, non `about:blank`.

2. **Non marcare mai `about:blank` come tab posseduta.**
   - Oggi il placeholder può finire negli owned tab.
   - Dopo la correzione, gli owned tab devono contenere solo URL validi WA/LI.

3. **Pulizia difensiva all’avvio:**
   - Se nello storage sessione esistono tab possedute con `about:blank`, `chrome://newtab`, URL vuoti o non WA/LI, rimuoverle dal set.
   - Questo evita che vecchie installazioni continuino a portarsi dietro stato sporco.

4. **Lookup tab più rigido:**
   - WhatsApp deve selezionare solo tab con `web.whatsapp.com`.
   - LinkedIn deve selezionare solo tab con `linkedin.com`.
   - Mai usare tab bianca come fallback operativo.

5. **Packaging:**
   - Incrementare versioni estensioni.
   - Rigenerare `public/whatsapp-extension.zip` e `public/linkedin-extension.zip`.

### C) Verifica finale

1. Controllare staticamente che non restino `windows.create({ url: "about:blank" })` nelle due estensioni.
2. Controllare che non restino percorsi che marcano `about:blank` come tab owned.
3. Controllare che l’header monti un solo controllo di contesto operativo al posto dei due selettori separati.
4. Consegnare le nuove versioni delle estensioni con istruzione di ricarica.