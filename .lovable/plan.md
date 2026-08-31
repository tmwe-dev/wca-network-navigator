# V2 — Analisi navigazione e piano di ristrutturazione

## Cosa ho misurato (dati reali del codice)

- **153 rotte** registrate in `src/v2/routes.tsx`
- **91 pagine** in `src/v2/ui/pages/`
- **15 voci** nel menu principale (`navConfig.tsx`), raggruppate in 7 macro-aree
- Quindi: **circa 120 rotte non sono raggiungibili dal menu**. Vivono solo dentro Config › Development › «Tutte le pagine», che non è una cartella di sviluppo ma il vero elenco delle maschere del sistema.

## Le tre malattie della navigazione

**1. Rotte doppie e triple sulla stessa maschera.** Lo stesso schermo ha più indirizzi, quindi il menu non può mai evidenziare "dove sono":

| Maschera        | Indirizzi attivi                                                             |
| --------------- | ---------------------------------------------------------------------------- |
| Contatti        | `/v2/contacts`, `/v2/crm/contacts`, `/v2/pipeline/contacts`, `/v2/partner-directory` |
| Agenda          | `/v2/agenda`, `/v2/calendar`, `/v2/outreach/agenda`, `/v2/pipeline/agenda`     |
| Biglietti       | `/v2/biglietti`, `/v2/business-cards`, `/v2/crm/biglietti`, `/v2/pipeline/biglietti` |
| Campagne        | `/v2/campaigns`, `/v2/communicate/campaigns`, `/v2/pipeline/campaigns`         |
| Approvazioni    | `/v2/approvals`, `/v2/approvazioni`, `/v2/communicate/approve`                 |
| Prompt Lab      | `/v2/prompt-lab`, `/v2/ai-staff/prompt-lab`, `/v2/settings/prompt-lab`         |
| Ricerca aziende | `/v2/ra-explorer`, `/v2/research/explorer`, `/v2/deep-search`                  |

Sono almeno **40 rotte alias** su ~20 maschere reali.

**2. Il menu non riflette il lavoro.** Le 15 voci in menu sono un misto di cose quotidiane (Command, Inbox, Email, Cockpit) e cose rare o tecniche (Cestinone, Lab, Rubrica WhatsApp, Rubrica LinkedIn) mentre mancano dal menu maschere che l'utente usa davvero: Contatti, Biglietti da visita, Campagne, Approvazioni, Pipeline/Kanban, Knowledge Base, Prompt Lab.

**3. "Development" è diventato l'indice del sistema.** Il pannello dentro Config raccoglie le maschere sotto etichette da manutentore ("Legacy & Controllo", "Lab & Verifiche", "Sistema & Diagnostica"). L'utente ci va per trovare cose importanti, con l'impressione che tutto sia sperimentale.

## Ristrutturazione proposta — per priorità d'uso, non per storia del codice

### Livello 1 — Menu quotidiano (7 voci, sempre visibili)

Sono le maschere del ciclo commerciale: si usano ogni giorno.

```text
Command        /v2/command          chiedere e far fare
Contatti       /v2/contacts         anagrafica unificata (persone, aziende, biglietti)
Messaggi       /v2/inbox            posta in arrivo, tutti i canali
Scrivi         /v2/communicate/compose  redazione + invio bulk
Da fare        /v2/cockpit          approvazioni, agenda, coda in un'unica maschera
Campagne       /v2/campaigns        cadenze e circuito di attesa
Regole         /v2/email-intelligence   catalogazione, filtri, classificazione
```

### Livello 2 — Menu di secondo piano (accessibile dal ☰, sotto una riga di separazione)

Cervello e configurazione: si usano una volta a settimana.

```text
Agenti · Knowledge Base · Prompt Lab · Andamento (KPI/Analytics) · Impostazioni
```

### Livello 3 — Strumenti tecnici (dentro Impostazioni › Sistema)

Diagnostica, Telemetria, Osservabilità, E2E, Galassia, Design System, Test hub. Qui "Development" ha finalmente senso, perché contiene solo cose da manutentore.

### Regola sulle rotte

Per ogni maschera **un solo indirizzo canonico**. Tutti gli alias diventano redirect permanenti verso il canonico, così i vecchi link continuano a funzionare ma il menu può sempre evidenziare la voce attiva. Nessuna pagina viene cancellata in questa fase.

## Ordine di esecuzione

1. **Inventario canonico** — tabella maschera → indirizzo canonico → alias, scritta in un file di configurazione unico (`src/v2/navigation/canonical.ts`). Nessun cambio di comportamento, solo verità scritta.
2. **Redirect degli alias** — `routes.tsx` riscritto: le ~40 rotte alias diventano `<Navigate replace>`. Le maschere restano identiche.
3. **Nuovo menu a 3 livelli** — `navConfig.tsx` riorganizzato sui livelli sopra; il ☰ mostra Livello 1 sempre, Livello 2 sotto separatore, Livello 3 solo dentro Impostazioni.
4. **Config › Development ripulito** — resta solo il Livello 3; le maschere operative escono da lì ed entrano nel menu.
5. **Barra superiore** — il template a tre zone (identità / contesto pagina / sistema) descritto nell'analisi precedente, applicato dopo che il menu è stabile.

## Cosa serve da te

Conferma sui **7 nomi del Livello 1** e su quali maschere consideri quotidiane. Se il tuo lavoro reale ha una voce in più o in meno rispetto a quella lista, la sistemiamo prima di toccare il codice: da lì dipende tutto il resto.
