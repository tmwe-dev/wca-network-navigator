

# Ristrutturazione tipi email nell'Oracolo — da tooltip a dialog strutturato

## Situazione attuale

I **tipi email sono identici** tra Cockpit e Email Composer — entrambi usano `DEFAULT_EMAIL_TYPES` da `src/data/defaultEmailTypes.ts` (6 tipi: Primo contatto, Follow-up, Richiesta info, Proposta servizi, Partnership, Network espresso). Non manca nulla.

Il problema è la **presentazione**: quando passi il mouse su un tipo, appare un tooltip con il prompt grezzo (testo lungo, non formattato, illeggibile).

## Cosa cambia

### 1. Rimuovere il tooltip su hover
Eliminare il `<Tooltip>` che mostra il prompt grezzo al passaggio del mouse.

### 2. Aggiungere un pulsante "info" accanto a ogni tipo
Un'icona piccola (ℹ️ o eye) a destra di ogni riga tipo email che apre un dialog.

### 3. Dialog strutturato con contenuto formattato
Quando clicchi sull'icona info, si apre un `Dialog` ben formattato che mostra:
- **Nome e icona** del tipo in header
- **Obiettivo** — estratto dalla prima riga del prompt
- **Struttura** — i passaggi (hook → ponte → value → CTA) formattati come lista ordinata
- **Vincoli** — le regole come bullet points
- **Tono** — il tono associato
- Un pulsante **"Modifica prompt"** che attiva un `Textarea` per editare il prompt e salvarlo come nuovo tipo personalizzato

### 4. Selettore tipo come dropdown (opzionale, da confermare)
Invece della lista verticale di bottoni, un `Select` dropdown compatto nella sezione "Opzioni AI" con il tipo selezionato, liberando spazio verticale nell'Oracolo. L'icona info rimane accessibile dal dropdown.

## Dettagli tecnici

| File | Modifica |
|------|----------|
| `src/components/email/OraclePanel.tsx` | Rimuovere `<Tooltip>` da ogni tipo; aggiungere icona info con onClick che apre dialog; importare `Dialog` |
| `src/components/email/EmailTypeDetailDialog.tsx` | **Nuovo** — Dialog che riceve un `EmailType`, lo formatta in sezioni (Obiettivo, Struttura, Vincoli), e offre "Duplica e modifica" per creare un tipo custom |
| `src/data/defaultEmailTypes.ts` | Nessuna modifica (i dati sono già completi e condivisi) |

Nessuna migrazione DB.

