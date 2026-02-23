
# Piano: Redesign completo della pagina Workspace

## Panoramica

Ricostruzione totale del layout e della grafica della pagina Email Workspace con un design moderno, morbido e dinamico. La GoalBar attuale viene smontata e trasformata in tab orizzontali con icone. Il canvas email diventa navigabile con frecce avanti/dietro per scorrere le email generate per gruppo. Viene aggiunto un pulsante "Genera Tutte" per creare email in batch.

---

## Nuovo Layout (dall'alto in basso)

```text
+---------------------------------------------------------------+
| [Sparkles] Email Workspace    [Cerca partner...] (in alto dx) |
+---------------------------------------------------------------+
| TAB ICONS:  [Target] Goal  |  [FileText] Proposta  |         |
|             [Paperclip] Documenti  |  [Link2] Link           |
+---------------------------------------------------------------+
| Contenuto della tab attiva (collassabile, 1 riga alla volta)  |
+---------------------------------------------------------------+
|  PARTNER LIST (sx, 320px)  |  EMAIL CANVAS (dx, flex-1)      |
|                            |  +----------------------------+  |
|                            |  | Partner info + LinkedIn    |  |
|                            |  | Subject / Body (3D canvas) |  |
|                            |  | [< Prev] 1/5 [Next >]     |  |
|                            |  | [Modifica][Copia][Invia]   |  |
|                            |  +----------------------------+  |
|                            |                                  |
|                            |  [Genera Tutte] button in basso  |
+---------------------------------------------------------------+
```

## Palette colori

- Sfondo principale: grigio caldo molto tenue (stone-50/stone-100)
- Pannelli: bianco con ombre morbidissime, bordi stone-200/stone-300
- Accenti: lilla chiaro (violet-300/violet-400), marrone chiaro (amber-200/stone-400)
- Testo: stone-700/stone-800, muted: stone-400
- Tab attiva: sfondo violet-50, bordo-bottom violet-400
- Badge e chip: violet-100/violet-200 con testo violet-700
- Bottoni primari: gradiente violet-400 -> violet-500
- Canvas email: sfondo bianco puro con bordo sottilissimo stone-200, ombra soft

## Dettagli tecnici

### 1. `Workspace.tsx` - Ristrutturazione completa

- Header compattato: titolo a sinistra, campo cerca partner a destra (spostato da ContactListPanel)
- Sotto: barra tab orizzontale con 4 icone-tab (Goal, Proposta, Documenti, Link)
- Ogni tab mostra solo il suo contenuto quando attiva (non tutto insieme)
- Stato aggiuntivo: `generatedEmails: Map<string, {subject, body, contactEmail}>` per salvare le email generate per ogni attivita
- Stato `currentEmailIndex` per navigare tra le email generate
- Funzione `handleGenerateAll` che cicla su tutte le attivita filtrate e genera email in sequenza
- Passa `search` e `onSearchChange` a ContactListPanel (il campo cerca si sposta in alto)

### 2. `GoalBar.tsx` -> Rinominato in `WorkspaceTabs.tsx`

- Componente con `Tabs` di Radix (4 tab orizzontali)
- Ogni tab ha icona + label breve
- Tab "Goal": textarea singola
- Tab "Proposta": textarea singola
- Tab "Documenti": area upload con chip
- Tab "Link": area input URL con chip
- Altezza compatta: max 120px per il contenuto della tab
- Stile: sfondo trasparente, tab pills arrotondate con sfondo violet-50 quando attive

### 3. `ContactListPanel.tsx` - Semplificazione

- Rimuovere il campo cerca interno (spostato nel header globale)
- Ricevere `search` come prop
- Palette: card con sfondo bianco, hover stone-50, selected con bordo violet-300 e sfondo violet-50/30
- Badge paese: testo stone-500, sfondo stone-100

### 4. `EmailCanvas.tsx` - Redesign con navigazione e batch

**Navigazione email:**
- Nuovo stato: `emails: GeneratedEmail[]` (array di tutte le email generate per il gruppo)
- Nuovo stato: `currentIndex: number`
- Frecce `ChevronLeft` / `ChevronRight` per navigare tra le email
- Indicatore "2 / 5" tra le frecce
- Ogni email mostra il partner/contatto a cui e destinata

**Canvas 3D-style:**
- Il body dell'email viene renderizzato in un "canvas" con sfondo bianco puro, bordo stone-200 sottilissimo (1px), ombra `shadow-sm`, bordi arrotondati `rounded-2xl`
- Transizione animata tra le email (slide orizzontale con `transition-transform`)

**Pulsante "Genera Tutte":**
- Posizionato nella toolbar in basso
- Genera email per tutte le attivita nella lista (max 20 alla volta)
- Progress bar durante la generazione batch
- Le email generate vengono salvate nello stato del Workspace e navigabili con le frecce

**LinkedIn:** mantiene le icone LinkedIn gia implementate nella barra partner

### 5. Stile globale

- Nessuna modifica a `index.css` (i colori si applicano con classi Tailwind dirette)
- Tutto usa classi Tailwind: `bg-stone-50`, `border-stone-200`, `text-violet-500`, ecc.
- Effetto glassmorphism leggero sui pannelli: `backdrop-blur-sm bg-white/80`

### 6. File modificati

| File | Azione |
|------|--------|
| `src/pages/Workspace.tsx` | Ristrutturazione completa layout, aggiunta batch generate, navigazione email |
| `src/components/workspace/GoalBar.tsx` | Rinominato logicamente, trasformato in tab orizzontali con icone |
| `src/components/workspace/ContactListPanel.tsx` | Riceve search come prop, palette aggiornata |
| `src/components/workspace/EmailCanvas.tsx` | Canvas con bordi sottili, navigazione avanti/dietro, batch support |

### 7. Flusso "Genera Tutte"

1. Utente clicca "Genera Tutte"
2. Il sistema prende tutte le attivita email filtrate nella lista
3. Per ognuna, chiama `generate-email` in sequenza (con delay di 500ms tra una e l'altra per non sovraccaricare)
4. Ogni email generata viene salvata in una mappa `activityId -> GeneratedEmail`
5. Il canvas mostra la prima email e l'utente naviga con le frecce
6. Una progress bar mostra "Generazione 3/12..."
7. Al termine, toast "12 email generate con successo"
