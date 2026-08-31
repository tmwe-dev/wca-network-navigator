# Sistema di colore semantico — Midnight Indigo

Un solo accento. Tutti gli altri colori sono **stati**, non decorazione.

## Palette base

| Ruolo | HEX | HSL (per `index.css`) | Uso |
| --- | --- | --- | --- |
| Sfondo app | `#0a0a1a` | `240 44% 7%` | `--background` — l'unico fondo della pagina |
| Superficie | `#141432` | `240 43% 14%` | `--card`, `--popover` — pannelli, card, rail |
| Bordo / elevazione | `#1e1e5a` | `240 51% 24%` | `--border`, `--input` — separatori, contorni |
| Accento unico | `#4f46e5` | `243 75% 59%` | `--primary`, `--ring` — azione primaria, selezione, focus |

Testo:

| Ruolo | HSL | Uso |
| --- | --- | --- |
| `--foreground` | `240 20% 96%` | titoli e valori |
| `--muted-foreground` | `240 12% 68%` | etichette, note, metadati |
| `--card-foreground` | `240 20% 96%` | testo dentro le superfici |

Regola di contrasto: `--muted-foreground` deve restare ≥ 4.5:1 su `--card`.
Non usare mai opacità sotto `/70` su testo informativo.

## Stati semantici (gli unici altri colori ammessi)

| Stato | Token | HSL | Quando |
| --- | --- | --- | --- |
| Successo / attivo | `--success` | `152 60% 45%` | missione attiva, invio riuscito, contatto verificato |
| Attenzione / in pausa | `--warning` | `38 92% 55%` | pausa, scadenza vicina, budget in esaurimento |
| Errore / bloccato | `--destructive` | `0 72% 58%` | fallimento, bounce, budget esaurito |
| Informazione / AI | `--info` | `265 70% 68%` | contenuto generato o suggerito dall'AI |
| Neutro / bozza | `--muted` | `240 25% 20%` | draft, archiviato, disattivo |

Ogni stato si usa **sempre** nella stessa tripletta:
`bg-<stato>/12` + `text-<stato>` + `border-<stato>/30`. Mai fondo pieno saturo.

## Canali di comunicazione

I canali non hanno un colore proprio: hanno un'**icona** e, se serve distinguerli,
una sfumatura del muted. Solo il canale attivo prende l'accento.

| Canale | Icona | Colore |
| --- | --- | --- |
| Email | `Mail` | `--muted-foreground`, accento se attivo |
| WhatsApp | `MessageCircle` | idem |
| LinkedIn | `Linkedin` | idem |
| Voce | `Phone` | idem |

Motivo: nello screenshot di riferimento i tre canali colorati diversamente su ogni riga
producono da soli tre colori per contatto, moltiplicati per 49 righe.

## Bandiere, loghi, avatar

Sono immagini, non colori del sistema. Vanno sempre dentro un contenitore neutro
(`bg-muted`, `rounded-md`, dimensione fissa 20px in lista / 40px in dettaglio).
Nessuna emoji bandiera inline nel testo.

## Divieti

1. Nessuna classe colore Tailwind grezza nelle pagine
   (`text-purple-400`, `bg-emerald-500`, `text-white`, `bg-black`, …).
   Stato attuale da bonificare: **205 occorrenze** in `src/v2`.
2. Nessun esadecimale nel JSX. Stato attuale: **11 occorrenze**.
3. Nessun gradiente decorativo: i gradienti restano solo nelle 3 pagine full-bleed.
4. Nessun bordo colorato "per bellezza": il bordo colorato significa uno stato.
5. Al massimo **un** elemento con l'accento pieno per schermata (l'azione primaria).

## Verifica

Il controllo si automatizza con una regola ESLint (`no-restricted-syntax` su
`className` che contiene `-(50|100|...|900)` delle palette Tailwind) e uno script di
conteggio, così il numero di violazioni può solo scendere.
