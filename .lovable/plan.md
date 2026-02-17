
# Piano: ActiveJobBar piu chiara e visibile

## Problema
La barra del job attivo in alto e troppo compatta e confusa. Troppe informazioni su una riga sola rendono difficile capire a colpo d'occhio se c'e un job in esecuzione, in pausa, o se non ce n'e nessuno.

## Soluzione
Ridisegnare la `ActiveJobBar` per renderla immediatamente leggibile. Layout su due righe:

- **Riga 1**: Stato chiaro a sinistra (pallino animato + etichetta "ATTIVO" / "IN PAUSA"), percentuale grande al centro, pulsanti azione a destra
- **Riga 2**: Barra di progresso full-width con dettagli sotto (paese, contatore, ultimo partner)

Quando non ci sono job attivi, il componente resta nascosto (come ora).

## Dettagli tecnici

### File modificato: `src/components/download/ActiveJobBar.tsx`

Modifiche:
- **Etichetta di stato prominente**: badge colorato "ATTIVO" (verde pulsante) o "IN PAUSA" (giallo) accanto al pallino, font piu grande
- **Percentuale ancora piu grande**: da `text-lg` a `text-2xl`, centrata e ben visibile
- **Barra di progresso full-width**: spostata su una riga dedicata sotto, larga tutto il pannello invece che `w-32`
- **Dettagli secondari sotto la barra**: paese + contatore + ultimo partner + stats contatti, tutti su una riga separata con testo piu piccolo
- **Rimozione del clutter**: i badge contatto (email/phone) dell'ultimo risultato vengono semplificati, niente piu badge multipli sovrapposti
- **Bordo piu visibile**: quando un job e attivo, il bordo diventa piu marcato (amber-500/40 in dark, sky-300 in light) per attirare l'attenzione

Layout risultante:

```text
+--------------------------------------------------+
| [*] ATTIVO          42%        [⏸] [■] [v]       |
| ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  |
| 🇮🇹 Italy · 42/100 · Ultimo: ABC Logistics  ✓12 ✗3 |
+--------------------------------------------------+
```
