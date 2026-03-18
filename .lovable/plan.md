

## Country Workbench — Redesign Toolbar + Card

### Cosa cambia

#### 1. Toolbar: sostituire dropdown sort con icone toggle
Rimuovere il `Select` dropdown. Al suo posto, una riga di icone-bottone per ordinamento:
- **User** → ordina per Nome (click 1: A-Z, click 2: Z-A)
- **MapPin** → ordina per Città
- **Star** → ordina per Rating
- **Trophy** → ordina per Anni WCA

Ogni icona mostra una freccia ↑/↓ quando attiva. Click ripetuto inverte la direzione.

#### 2. Filter chips: solo icona + numero, senza testo
Compattare i filtri rimuovendo le label testuali ("Telefono", "Email", etc.):
- **Phone** icona verde + conteggio
- **Mail** icona sky + conteggio  
- **Send** (deep search) icona + conteggio
- **Star** (rating 3+) icona amber + conteggio
- **Package** (servizi) icona + conteggio

Icone più grandi (w-4 h-4), numeri più leggibili.

#### 3. Card partner: layout pulito
```text
┌──────────────────────────────────────────┐
│ 1 ☐ [Logo]  COMPANY NAME       🏆 12 yr │
│              ⭐⭐⭐⭐☆ 4.2               │
│              👤 Mario Rossi  +2          │
│              ✉ email  📞 phone           │
│              ───────────────────────────  │
│              ✈ 🚛 📦  · InterGlob, Proj  │
└──────────────────────────────────────────┘
```

Modifiche:
- **Anni WCA** spostati in alto a destra (angolo), ben visibili con trofeo
- **Rating** sotto il nome, riga dedicata
- **Contatti** subito sotto (nome contatto, email, telefono)
- **Servizi + Network** in fondo, separati da linea sottile
- Rimuovere la riga separata Città (la città resta visibile ma meno prominente, accanto al contatto o nel tooltip)

#### File coinvolto
- `src/components/partners/CountryWorkbench.tsx` — unico file

