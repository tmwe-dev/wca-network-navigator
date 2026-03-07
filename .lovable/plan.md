

## Rendere più evidenti i contatti, email e cellulari nelle card

### Problema
Attualmente le informazioni di contatto (nome persona, email, telefono/cellulare) sono mostrate in modo poco evidente: testo piccolo (`text-[10px]`), colori sbiaditi (`text-muted-foreground`), icone solo come indicatori senza testo visibile, e in alcuni casi i dati sono nascosti dietro tooltip. L'utente non riesce a capire a colpo d'occhio chi ha dati sufficienti per essere lavorato nel Workspace.

### Card coinvolte (6 componenti)

1. **PartnerCard** (`src/components/partners/PartnerCard.tsx`) — action bar in basso mostra solo icone Phone/Mail senza testo. I contatti personali (`partner_contacts`) non sono mostrati affatto — solo il badge "Contatti OK/Parziale/No contatti"
2. **PartnerListItem** (`src/components/partners/PartnerListItem.tsx`) — mostra nome contatto primario ma email/telefono sono solo icone colorate in tooltip, mai testo visibile
3. **PartnerDetailCompact** (`src/components/partners/PartnerDetailCompact.tsx`) — nella sezione contatti mostra Mail/Phone come icone colorate ma senza il testo dell'email/telefono visibile
4. **ContactCard** (`src/components/contacts/ContactCard.tsx`) — già mostra email e telefono con testo, ma in `text-[10px]` molto piccolo e `text-foreground` poco contrastato
5. **CompactContactCard** (`src/components/import/CompactContactCard.tsx`) — mostra email/phone con emoji ✉/☎ in `text-muted-foreground`, poco leggibile
6. **Workspace ContactListPanel** (`src/components/workspace/ContactListPanel.tsx`) — mostra icone Mail/Phone colorate ma senza il testo dell'email o numero visibile

### Modifiche per ogni componente

#### 1. PartnerCard — aggiungere sezione contatto primario
- Sopra la action bar, aggiungere una riga con nome del contatto primario (da `partner_contacts`), la sua email e il suo cellulare in testo visibile
- Usare `text-xs font-medium` con colori ad alto contrasto (email in `text-sky-400`, telefono in `text-emerald-400`)
- Se nessun contatto: mostrare "Nessun contatto personale" in rosso

#### 2. PartnerListItem — rendere email/telefono visibili come testo
- Sotto il nome del contatto primario, mostrare email e telefono come testo troncato visibile (non solo icone)
- Formato: `📧 mario@azienda.com · 📱 +39 333...`

#### 3. PartnerDetailCompact — mostrare email/telefono sotto il nome contatto
- Aggiungere sotto ogni nome contatto una riga con email e telefono in testo visibile, cliccabile

#### 4. ContactCard — aumentare dimensione e contrasto
- Email/telefono da `text-[10px]` a `text-xs`
- Colore da `text-foreground` a `text-sky-400` per email e `text-emerald-400` per telefono/WA
- Aumentare `max-w` dei truncate

#### 5. CompactContactCard — stile uniforme con icone Lucide
- Sostituire emoji ✉/☎ con icone `Mail`/`Phone` colorate
- Aumentare contrasto e dimensione del testo email/phone

#### 6. Workspace ContactListPanel — mostrare email/telefono come testo
- Sotto le icone Mail/Phone, aggiungere il testo dell'email troncato e il numero di telefono visibile
- Questo rende immediatamente chiaro quali attività sono "pronte" per il Workspace

### File coinvolti
- `src/components/partners/PartnerCard.tsx`
- `src/components/partners/PartnerListItem.tsx`
- `src/components/partners/PartnerDetailCompact.tsx`
- `src/components/contacts/ContactCard.tsx`
- `src/components/import/CompactContactCard.tsx`
- `src/components/workspace/ContactListPanel.tsx`

