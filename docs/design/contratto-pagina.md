# Contratto di pagina — regole valide per ogni maschera

Struttura unica: **Dashboard a pannelli**. Densità di default: **2/5 (essenziale)**.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ TOP BAR globale (44px) — identità, contesto, sistema                 │
├───┬──────────────────────────────────────────────────────────────┬───┤
│ F │ HEADER DI PAGINA (36px)                                      │ W │
│ I │  breadcrumb / titolo          [✦ AI] [az.1] [az.2] [ … ]     │ O │
│ L ├──────────────────────────────────────────────────────────────┤ R │
│ T │ TOOLBAR contestuale (36px, opzionale) — tab, ricerca, conteg.│ K │
│ R ├──────────────────────────────────────────────────────────────┤ F │
│ I │                                                              │ L │
│   │                    PANNELLI DI CONTENUTO                     │ O │
│   │                                                              │ W │
└───┴──────────────────────────────────────────────────────────────┴───┘
```

## 1. Header — una sola riga, sempre uguale

- Sinistra: breadcrumb (o titolo se la pagina è di primo livello). Mai entrambi.
- Destra, in quest'ordine fisso: **✦ AI** → **max 3 azioni primarie** → **menu «…»**.
- Tutto ciò che non entra nelle 3 azioni va nel menu «…», mai in una seconda riga.
- Il pulsante AI è sempre nella stessa posizione in tutte le 91 maschere.
- Nessun conteggio, nessun filtro, nessun badge nell'header: vanno nella toolbar.

## 2. Rail — dove vive cosa

| Zona | Contenuto | Mai |
| --- | --- | --- |
| Rail sinistro | Filtri, faccette, saved views | Azioni di scrittura |
| Rail destro | Workflow, azioni di contesto, stato dati | Filtri |
| Corpo pagina | Solo dati e azioni su singolo elemento | Filtri o workflow duplicati |

I rail sono montati **una sola volta** da `AuthenticatedLayout`. Una pagina che disegna
i propri filtri nel corpo sta creando un doppione: va corretta.

Su mobile i due rail diventano drawer richiamabili dalla toolbar.

## 3. Densità a due livelli

**Livello 1 — sempre visibile (max 5 informazioni per riga/card):**
identità (nome + logo/bandiera), stato, valore chiave, ultima attività, 1 azione.

**Livello 2 — a richiesta:** tutto il resto, dentro
«Mostra dettagli», hover card, drawer o pannello di dettaglio.

Nello screenshot di riferimento una singola riga partner mostra 14 elementi
(nome, badge WCA, trofeo, «…», bandiera, sigla paese, etichetta Contatto, nome contatto,
email, città, badge DS, orologio, contatore, 3 icone canale). Il contratto ne ammette 5.

## 4. Badge

- Massimo **2** badge visibili per riga o card; gli altri collassati in `+N`
  con tooltip che li elenca.
- Un badge è sempre `bg-<stato>/12 text-<stato> border-<stato>/30`, altezza 18px,
  testo 10px maiuscoletto.
- Un badge senza stato semantico (etichetta descrittiva) usa il muted, non l'accento.

## 5. Tipografia — 5 livelli, nessuno di più

| Livello | Classe | Uso |
| --- | --- | --- |
| Titolo pagina | `text-sm font-semibold` | header |
| Titolo sezione/pannello | `text-xs font-semibold uppercase tracking-wide text-muted-foreground` | intestazione pannello |
| Valore | `text-sm font-medium text-foreground` | dato principale |
| Etichetta | `text-[11px] text-muted-foreground` | nome del campo |
| Nota | `text-[11px] text-muted-foreground/80` | metadati, timestamp |

Titoli di pagina: **niente maiuscolo forzato** sui nomi propri (oggi
`"EUGENE" LOGISTICS …` in lista e `"EUGENE" Logistics Co., Ltd.` in dettaglio:
due rese diverse dello stesso dato).

## 6. Spaziatura e forme

- Griglia base 4px. Padding pannello `p-4`. Gap tra pannelli `gap-3`.
- Un solo raggio: `rounded-lg` per pannelli e card, `rounded-md` per controlli.
- Un solo bordo: `border border-border`. Niente ombre colorate, niente glow.
- Nessun pannello annidato oltre 2 livelli (card dentro card dentro card = vietato).

## 7. Azioni

- **Una** azione primaria per schermata (accento pieno). Tutte le altre sono
  `variant="outline"` o `ghost`.
- Le azioni su singolo elemento **non** usano il menu `…`: l'icona che segnala
  il canale (busta, WhatsApp, telefono) è essa stessa il pulsante d'azione.
  Icone spente = canale assente.
- **Ordinamento**: un solo controllo. Clic breve inverte A→Z / Z→A,
  pressione lunga (o tasto destro) apre la tendina dei criteri.
- **Filtri**: nessun pulsante «Filtri» in toolbar. Si entra solo dalla linguetta
  laterale (icona imbuto); i filtri avanzati stanno in fondo al rail.
- **Stati ciclici** (es. circuito di attesa): una sola icona che cambia colore
  al clic, mai una fila di pillole testuali.
- Ogni pulsante icona ha `aria-label`.

## 8. Stati vuoti, caricamento, errore

Ogni pannello dichiara i tre stati con lo stesso componente:
titolo breve, una riga di spiegazione, al massimo una azione.
Nessuno spinner a pagina intera: skeleton nel pannello.

## 9. Checklist di conformità (da applicare in migrazione)

- [ ] Usa `StandardPageFrame`, non header fatto a mano
- [ ] Max 3 azioni in header, nessun menu «…» in toolbar elenco
- [ ] Sort unico (clic = direzione, pressione lunga = criterio)
- [ ] Icone canale cliccabili al posto del menu riga
- [ ] Pulsante AI presente e in posizione standard
- [ ] Nessun filtro nel corpo pagina
- [ ] Max 5 informazioni di livello 1 per riga/card
- [ ] Max 2 badge visibili, resto in `+N`
- [ ] Zero colori fuori palette
- [ ] 5 livelli tipografici, nessun altro
- [ ] Stati vuoto/caricamento/errore presenti
- [ ] Nessuna modifica alla logica della pagina
