

# Piano: Logo a destra del nome + Bandiera grande a destra della card

## Problema attuale
- `CompanyLogo` è usato come avatar a sinistra con la bandiera sovrapposta in piccolo
- L'utente vuole: **logo reale (solo Clearbit)** inline accanto al nome del mittente, **bandiera grande** sul lato destro della riga

## Cosa cambia

### 1. Separare Logo e Bandiera nel `CompanyLogo`
Creare due sotto-componenti esportati:
- **`CompanyLogoInline`** — solo il logo Clearbit, piccolo (16-20px), senza fallback visivo (se non trova il logo, non renderizza nulla). Da mettere accanto al nome del mittente.
- **`CountryFlag`** — solo la bandiera dal TLD, dimensione grande (20-24px), da posizionare sul lato destro della card.

Il componente `CompanyLogo` esistente (con InitialsAvatar) resta come avatar a sinistra.

### 2. Layout `EmailMessageList.tsx`
```text
Attuale:
[Logo+Flag]  Nome         Data
             Oggetto
             Email

Nuovo:
[Iniziali]  Nome [Logo🔹]        🇻🇳  Data
            Oggetto                    ✈️
            Email
```
- A sinistra: `InitialsAvatar` (sempre, con le iniziali del brand)
- Dopo il nome: `CompanyLogoInline` (solo se Clearbit trova il logo reale, altrimenti niente)
- A destra: `CountryFlag` grande (20-24px) estratta dal TLD dell'email
- Rimuovere `showFlag` dal `CompanyLogo` nella lista (la bandiera è ora separata)

### 3. Layout `DownloadedEmailList.tsx`
Stesso schema: iniziali a sinistra, logo inline dopo il nome, bandiera grande a destra.

### 4. `EmailDetailView.tsx`
Stesso approccio nel header del dettaglio email: logo inline accanto al nome, bandiera grande a destra.

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/ui/CompanyLogo.tsx` | Esportare `CompanyLogoInline` (solo logo, nessun fallback) e `CountryFlag` (solo bandiera, grande) |
| `src/components/outreach/EmailMessageList.tsx` | Nuovo layout: iniziali sx, logo inline dopo nome, bandiera dx grande |
| `src/components/outreach/download/DownloadedEmailList.tsx` | Stesso nuovo layout |
| `src/components/outreach/download/DownloadedEmailPreview.tsx` | Logo inline + bandiera separata |
| `src/components/outreach/EmailDetailView.tsx` | Logo inline + bandiera separata |

## Risultato
- Logo reale Clearbit: appare piccolo accanto al nome del mittente, solo se esiste
- Nessun logo inventato, nessun fallback generico vicino al nome
- Bandiera del paese: grande, posizionata chiaramente a destra della riga
- InitialsAvatar: resta come identificativo visivo a sinistra

