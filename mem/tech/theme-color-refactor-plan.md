# Refactor grafico: SSOT tema + contrasti

## Obiettivo

Un solo modulo centrale governa colori/temi di tutte le pagine. Niente colori
raw nei componenti: solo token semantici Tailwind. Contrasti garantiti in
light e dark per ognuno dei 4 temi (amber, lilac, space, notte).

## Fase 1 — Single Source of Truth (FATTA)

- Creato `src/v2/ui/theme/themeRegistry.ts`: id temi, modi, chiavi storage,
  eventi, `applyTheme/applyMode/readStored*`, `bootstrapThemeClasses`.
- `src/main.tsx` usa `bootstrapThemeClasses()` pre-render (anti-flash).
- `ThemePicker.tsx` importa tutto dal registry (zero duplicazioni).
- Valori HSL per (tema, modo) restano SOLO in `src/index.css`.

## Fase 2 — Bonifica contrasti (IN CORSO)

Regola di mapping da colore raw → token semantico:

- emerald/green → `success`
- amber/yellow/orange → `warning`
- red/rose → `destructive`
- sky/blue → `chart-3`
- violet/purple/indigo → `chart-4`
- text-white su card → `text-foreground`

Fatto: tutto `src/components/cockpit/*` (bug schermata: nome `text-white` su
card chiara) + 13 file con `text-*-300` su tinta chiara (rischio light mode).

Da completare (stesso metodo): restanti `text-*-100/200/300` foreground senza
variante `dark:`. I `dark:text-*` con coppia light già corretta NON si toccano.
I `text-white` su pulsanti con `bg-*` pieno scuro sono corretti, si lasciano.

## Fase 3 — Guardrail (DA FARE)

ESLint rule (`no-restricted-syntax`/regex) che vieta utility colore raw nei
`className`, suggerendo i token. Esenzioni: brand fissi documentati.

## Fase 4 — Menu (PRUDENTE)

`NavMenuPopover.tsx` (552 righe) + `navConfig.tsx`. Dead-code da rimuovere solo
dopo verifica usi. Da fare a parte per evitare regressioni di navigazione.
