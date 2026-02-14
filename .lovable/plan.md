
# Ridisegno Header PartnerCanvas: Logo a sinistra, Info a destra

## Problema attuale

Il logo e il nome azienda sono affiancati nello stesso `flex` row, ma quando il logo e' grande o ha proporzioni scomode, il testo viene schiacciato e troncato. Inoltre il logo appare dentro un contenitore troppo rigido.

## Soluzione

Dividere l'header in due colonne distinte con layout a griglia:

```text
+---------------------------+-------------------------------+
|                           |  Nome Azienda         ★ 4.0  |
|     LOGO                  |  🇦🇫  Kabul · Afghanistan     |
|  (spazio libero)          |  🌐 http://www.example.com    |
+---------------------------+-------------------------------+
```

### File: `src/components/acquisition/PartnerCanvas.tsx` (righe 219-254)

Sostituire il blocco `flex items-start gap-4` con un layout a griglia `grid grid-cols-[minmax(80px,1fr)_2fr]`:

1. **Colonna sinistra (logo)**: 
   - Contenitore con `flex items-center justify-center min-h-[64px]`
   - Logo con `max-h-16 max-w-full object-contain` (senza bordi, senza sfondo quadrato)
   - Il logo "respira" liberamente nello spazio disponibile, senza rounded-lg ne' background
   - Se assente, mostra l'icona Building2 placeholder

2. **Colonna destra (info azienda)**:
   - Nome azienda (h2 bold) con il rating (stelline) sulla stessa riga, allineato a destra
   - Bandiera + citta' + paese sotto
   - Website sotto ancora

Il logo apparira' senza sfondo forzato, pulito, come un marchio professionale nella card.
