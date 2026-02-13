
# Guida Report Aziende - Ricerca Personalizzata

## Struttura della pagina originale

La pagina `searchPersonalizzata.php` di Report Aziende ha un layout a 2 colonne (4/8) con 3 sezioni operative:

### SEZIONE 1: Filtri di ricerca (colonna sinistra)
Accordion con checkbox. Selezionando un checkbox si attiva il filtro e appare un campo input per impostare il valore (min/max per i numerici, dropdown per i geografici, testo libero per denominazione/CF/PIVA).

### SEZIONE 2: Campi da visualizzare nei risultati (colonna sinistra, sotto la Sezione 1)
Accordion identico alla Sezione 1, ma serve per scegliere quali colonne mostrare nella tabella risultati. "Denominazione" e' sempre selezionata e non rimovibile.

### SEZIONE 3: Tabella risultati (larghezza intera, sotto le colonne)
DataTable con le colonne selezionate nella Sezione 2, filtrate secondo i criteri della Sezione 1.

---

## Mappa completa di tutti i filtri e campi

Ogni voce puo' essere sia un FILTRO (Sezione 1) che un CAMPO visualizzabile (Sezione 2). Il `value` e' il parametro tecnico usato internamente dal sito.

### 1. GEOGRAFICI

| value | Label | Tipo filtro |
|-------|-------|-------------|
| `regione` | Regione | Dropdown multi-selezione (20 regioni italiane) |
| `provincia` | Provincia | Dropdown multi-selezione (107 province, filtrate per regione) |
| `comune` | Comune | Testo libero / autocomplete |
| `cap` | CAP | Testo libero |

### 2. ANAGRAFICI

| value | Label | Tipo filtro |
|-------|-------|-------------|
| `denominazione` | Denominazione | Testo libero (contiene) |
| `cf` | Codice Fiscale | Testo esatto |
| `piva` | Partita IVA | Testo esatto |
| `forma_giuridica` | Forma giuridica | Dropdown (SRL, SPA, SAS, SNC, ecc.) |
| `ateco` | Codice ATECO | Albero gerarchico (gia' implementato nel progetto) |
| `inizio_attivita` | Inizio attivita' | Range date (da/a) |

### 3. BILANCIO - CONTO ECONOMICO

| value | Label | Tipo filtro |
|-------|-------|-------------|
| `fatturato` | Fatturato | Range numerico (min/max in EUR) |
| `ricavi_operativi` | Ricavi operativi | Range numerico |
| `valore_produzione` | Totale valore della produzione | Range numerico |
| `totale_costi_produzione` | Totale costi della produzione | Range numerico |
| `costo_acquisti` | Costo per acquisti | Range numerico |
| `costo_servizi` | Costo per servizi | Range numerico |
| `costo_godimento_beni` | Costo per godimento di beni di terzi | Range numerico |
| `oneri_gestione` | Oneri diversi di gestione | Range numerico |
| `mol` | Margine operativo lordo (EBITDA) | Range numerico |
| `ammortamenti` | Ammortamenti e svalutazioni | Range numerico |
| `ebit` | Risultato operativo (EBIT) | Range numerico |
| `oneri_finanziari` | Proventi e oneri finanziari | Range numerico |
| `risultato_prima_imposte` | Risultato prima delle imposte | Range numerico |
| `imposte` | Imposte sul reddito d'esercizio | Range numerico |
| `utile` | Utile (Perdita) dell'esercizio | Range numerico |
| `flusso_cassa` | Flusso di cassa | Range numerico |

### 4A. STATO PATRIMONIALE ATTIVO

| value | Label | Tipo filtro |
|-------|-------|-------------|
| `immobilizzazioni_immateriali` | Immobilizzazioni immateriali | Range numerico |
| `immobilizzazioni_materiali` | Immobilizzazioni materiali | Range numerico |
| `immobilizzazioni` | Totale immobilizzazioni | Range numerico |
| `crediti_totali` | Totale crediti | Range numerico |
| `crediti` | Crediti entro 12 mesi | Range numerico |
| `imposte_anticipate` | Imposte anticipate | Range numerico |
| `liquidita` | Totale disponibilita' liquide | Range numerico |
| `attivo_circolante` | Totale attivo circolante | Range numerico |
| `ratei_attivi` | Ratei e risconti attivi | Range numerico |
| `totale_attivo` | Totale attivo | Range numerico |

### 4B. STATO PATRIMONIALE PASSIVO

| value | Label | Tipo filtro |
|-------|-------|-------------|
| `patrimonio` | Patrimonio netto | Range numerico |
| `capitale_sociale` | Capitale Sociale | Range numerico |
| `riserve` | Altre riserve | Range numerico |
| `utile` | Utile (Perdita) dell'esercizio | Range numerico |
| `tfr` | Fondi TFR | Range numerico |
| `debiti_totali` | Totale debiti | Range numerico |
| `debiti_breve` | Debiti entro 12 mesi | Range numerico |
| `debiti_lungo` | Debiti oltre i 12 mesi | Range numerico |
| `ratei_passivi` | Ratei e risconti passivi | Range numerico |
| `totale_passivo` | Totale passivo | Range numerico |

### 5. INDICI DI BILANCIO

| value | Label | Tipo filtro |
|-------|-------|-------------|
| `var_ricavi` | Variazione dei ricavi (%) | Range percentuale |
| `var_produzione` | Variazione valore della produzione (%) | Range percentuale |
| `var_attivo` | Variazione dell'attivo (%) | Range percentuale |
| `var_patrimonio` | Variazione del patrimonio netto (%) | Range percentuale |
| `ros` | R.O.S. (Return On Sales) (%) | Range percentuale |
| `roi` | R.O.I. (Return On Investment) (%) | Range percentuale |
| `roe` | R.O.E. (Return On Equity) (%) | Range percentuale |
| `indice_liquidita` | Indice di liquidita' immediata (Acid Test) | Range numerico (ratio) |
| `pfn` | P.F.N. (Posizione Finanziaria Netta) | Range numerico |

### 6. PERSONALE

| value | Label | Tipo filtro |
|-------|-------|-------------|
| `dipendenti` | Numero dipendenti | Range numerico (intero) |
| `costo_personale` | Costo del personale | Range numerico |

### 7. CONTATTI (solo filtri, non campi visualizzabili come range)

**Come filtri:**

| value | Label | Tipo |
|-------|-------|------|
| `numero_telefono` | Esiste numero di telefono | Checkbox booleano (si/no) |
| `indirizzo_email` | Esiste indirizzo email | Checkbox booleano |
| `esiste_tel_o_email` | Esiste telefono o email | Checkbox booleano |
| `esiste_tel_e_email` | Esiste telefono e email | Checkbox booleano |

**Come campi visualizzabili:**

| value | Label |
|-------|-------|
| `telefono` | Numero di telefono |
| `email` | Indirizzo email |

---

## Colonna destra (sticky)

La colonna destra mostra in tempo reale:
- **Riepilogo filtri attivi**: chip rimovibili con il nome del filtro e il valore impostato
- **Riepilogo campi selezionati**: chip rimovibili (tranne "Denominazione" che e' obbligatoria)
- **Pulsante "Cerca"**: avvia la ricerca
- **Pulsante "Reset filtri"**: pulisce tutti i filtri

---

## Flusso operativo

1. L'utente apre un accordion nella Sezione 1 e attiva un filtro (es. "Fatturato")
2. Appare un campo input inline (es. due campi "Da" e "A" per il range)
3. L'utente imposta i valori (es. 1.000.000 - 10.000.000)
4. Il filtro appare come chip nella colonna destra
5. L'utente apre la Sezione 2 e seleziona i campi da visualizzare
6. Clicca "Cerca"
7. La tabella risultati appare sotto con le colonne scelte e i dati filtrati

---

## Note per l'implementazione nello scraper

- Il sito usa un form POST con input hidden generati dinamicamente via JavaScript
- I filtri numerici usano sempre due campi: `{value}_min` e `{value}_max`
- I filtri percentuali usano la stessa logica min/max ma i valori sono in percentuale (es. 5 = 5%)
- I filtri geografici (regione, provincia) sono dropdown con valori standard italiani
- Il filtro ATECO e' un campo di testo con autocomplete (nel nostro progetto abbiamo gia' l'albero completo)
- I filtri contatti (telefono/email) sono booleani: "esiste" o "non esiste"
- La tabella risultati viene caricata via AJAX in un DataTable con paginazione server-side
- L'export dei risultati (CSV/Excel) e' disponibile dopo la ricerca
