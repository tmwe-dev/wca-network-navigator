## Obiettivo
Differenziare visivamente tutti i campi compilabili (input, textarea, select, search, combobox) dal background della pagina, in modo coerente su tutti i temi:
- **Tema scuro** → sfondo campo più scuro del background (quasi nero)
- **Tema chiaro** → sfondo campo leggermente più chiaro/contrastato del background

## Strategia (UI-only, zero logica)

### 1. Nuovo design token globale `--field`
In `src/index.css` aggiungo, accanto a `--input` (che oggi è il bordo), un nuovo token che rappresenta lo **sfondo** dei campi:
- `:root` (light): `--field: 0 0% 100%;` o leggermente più chiaro del background
- `.dark`: `--field: 222 47% 6%;` (più scuro del background dark)
- Replicato per tutti i temi custom presenti in `index.css` (Lilac, Emerald, ecc.) — variante light e `.dark`

### 2. Mappatura Tailwind
In `tailwind.config.ts` aggiungo:
```ts
field: { DEFAULT: "hsl(var(--field))", foreground: "hsl(var(--field-foreground))" }
```
Espone la classe `bg-field`.

### 3. Aggiornamento primitive shadcn (un solo punto)
Cambio `bg-background` → `bg-field` nei primitive condivisi:
- `src/components/ui/input.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/select.tsx` (SelectTrigger)
- `src/components/ui/command.tsx` (CommandInput)

Tutto il sistema (Funnemail, Inbox, Prompt Lab, dialog, drawer, filtri…) eredita automaticamente.

### 4. Verifica
Smoke visivo su `/v2/lab` (dark) e `/v2` (light): contrasto bordo `border-input` ancora visibile, testo leggibile, nessuna regressione su campi che già forzano `bg-card`/`bg-muted`.

## File toccati
- `src/index.css` (aggiunta token su tutti i temi)
- `tailwind.config.ts` (registrazione `field`)
- `src/components/ui/input.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/command.tsx`

## Fuori scope
- Componenti che già usano sfondi custom (`bg-card`, `bg-muted`) restano invariati.
- Nessuna modifica a logica, dati, edge function, RLS.
