
# Piano: Fix Logo Falsi e Bandiera

## Problemi dallo screenshot
1. Il fallback Google Favicon mostra globi generici (non sono loghi reali) — vanno nascosti
2. La bandiera è piccola e posizionata in basso a sinistra, sovrapposta al logo
3. Servono bandiere più grandi, spostate in basso a destra

## Modifiche in `src/components/ui/CompanyLogo.tsx`

### A. Eliminare il fallback Google Favicon
Quando Clearbit fallisce, invece di provare Google Favicon (che spesso restituisce un globo generico), andare direttamente a "none" (spazio vuoto o iniziali). Rimuovere completamente la logica `google` dal flusso.

**Flusso attuale**: Clearbit → Google Favicon → none
**Nuovo flusso**: Clearbit → none (con InitialsAvatar)

### B. Bandiera più grande e in basso a destra
- `FlagBadge`: aumentare dimensione da `size * 0.4` a `size * 0.55` (minimo 14px)
- Spostare posizione da `-bottom-0.5 -left-0.5` a `-bottom-1 -right-1`

### C. Quando nessun logo è trovato
Mostrare `InitialsAvatar` (le iniziali del nome) invece di uno spazio vuoto — più utile visivamente.

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/ui/CompanyLogo.tsx` | Rimuovere fallback Google, ingrandire e spostare bandiera a destra, mostrare InitialsAvatar quando nessun logo |
