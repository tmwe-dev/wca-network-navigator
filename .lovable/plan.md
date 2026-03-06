

## Piano: Migliorare leggibilità card contatti — testi bianchi, origine e città evidenti

### Problema

I testi nelle card contatti usano `text-muted-foreground` (grigio tenue) che nel tema dark è quasi invisibile. Mancano origine e città/provincia come informazioni evidenti.

### Modifiche in `src/components/contacts/ContactListPanel.tsx`

**1. Colori testo — da grigio a bianco**
- Nome contatto: da `text-muted-foreground` → `text-foreground/90` (bianco leggero)
- Posizione: da `text-primary/70` → `text-primary` 
- Email, telefono: da `text-muted-foreground` → `text-foreground/80`
- Icone: da `text-muted-foreground/60` → `text-foreground/60`

**2. Aggiungere origine e città/provincia visibili**
- Nuova riga nella card tra contatto e link: mostra **origine** come badge colorato + **città, provincia** in testo bianco
- Origine ben evidente con badge a contrasto (es. `bg-primary/20 text-primary`)

**3. Card background leggermente più contrastata**
- Card di default: aggiungere `bg-card/80` per dare un minimo di sfondo che faccia risaltare il testo bianco

### Struttura card risultante

```text
🏢 ACME LOGISTICS                    [status]
👤 Mario Rossi • Sales Manager
📍 Milano, MI  |  🏷️ Cosmoprof
✉ mario@acme.it  📱 WA  ☎ +39...
```

