

# LOVABLE-76A: Fix contrasto testo dark mode

## Obiettivo
Risolvere il problema globale di leggibilità in dark mode: testo `text-muted-foreground` su `bg-muted` ha contrasto ~3.7:1 (sotto WCAG AA 4.5:1).

## Modifiche

### 1. Token CSS globali — `src/index.css`

Nel blocco `.dark`:
- `--muted-foreground: 215 20% 65%` → `215 20% 75%` (luminosità +10%)
- `--muted: 216 34% 14%` → `216 28% 17%` (background leggermente più chiaro)

Impatto: contrasto sale da ~3.7:1 a ~4.8:1 ✓ WCAG AA. Migliora **tutta l'app** automaticamente, non solo Email Forge.

### 2. Eliminare testo ultra-piccolo — file Email Forge + Enrichment

Cartelle target:
- `src/v2/ui/pages/email-forge/**`
- `src/components/settings/enrichment/**`
- `src/components/email/OraclePanel.tsx` e `EnrichmentStatusBadges` (LOVABLE-73)
- `src/components/settings/enrichment/EnrichmentExtraInfo.tsx` (LOVABLE-75)

Sostituzioni:
- `text-[9px] text-muted-foreground` → `text-[11px] text-foreground/70`
- `text-[10px] text-muted-foreground` → `text-xs text-foreground/70`

Regola: niente testo sotto 11px in dark mode.

### 3. Gerarchia opacità su sfondi scuri

Sostituire `text-muted-foreground` quando si trova dentro `bg-muted`/`bg-card`/`bg-background` secondo il ruolo:
- **Label** (intestazione sezione, nome campo): `text-foreground/80`
- **Valore secondario** (descrizione, hint): `text-foreground/70` o `text-foreground/60`
- **Disabilitato**: `text-foreground/40`

File principali da rivedere:
- `ForgeSummaryPanel.tsx` (sezioni Section, badge sorgente, sottotitoli)
- `ResultPanel.tsx`
- `PromptInspector.tsx`
- `LabBottomTabs.tsx` e tab figli (`DeepSearchTab`, ecc.)
- `EnrichmentRowList.tsx` (nome partner, dominio, email count)
- `EnrichmentToolbar.tsx`, `BulkActionBar.tsx`, `SourceTabBar.tsx`

### 4. Bordi più visibili

In tutti i file Email Forge + Enrichment:
- `border-border/40` → `border-border/60`

### 5. Snapshot badges (LOVABLE-73/75)

Allineare anche `EnrichmentStatusBadges` (in `OraclePanel.tsx`) e `EnrichmentExtraInfo.tsx` allo stesso standard: niente `text-[10px] text-muted-foreground`.

## File toccati (stima ~15-20)

**Modificati**:
- `src/index.css` (2 token .dark)
- `src/v2/ui/pages/email-forge/ForgeSummaryPanel.tsx`
- `src/v2/ui/pages/email-forge/ResultPanel.tsx`
- `src/v2/ui/pages/email-forge/PromptInspector.tsx`
- `src/v2/ui/pages/email-forge/LabBottomTabs.tsx`
- `src/v2/ui/pages/email-forge/EmailForgePage.tsx` (header subtitle)
- altri tab figli sotto `src/v2/ui/pages/email-forge/` (Deep Search, KB, ecc.)
- `src/components/settings/enrichment/EnrichmentRowList.tsx`
- `src/components/settings/enrichment/EnrichmentToolbar.tsx`
- `src/components/settings/enrichment/BulkActionBar.tsx`
- `src/components/settings/enrichment/SourceTabBar.tsx`
- `src/components/settings/enrichment/EnrichmentExtraInfo.tsx`
- `src/components/email/OraclePanel.tsx` (snippet `EnrichmentStatusBadges`)

**Nessun nuovo file. Nessuna migration DB. Nessun tocco a logica/edge functions.**

## Constraints rispettati

- ✅ Token semantici design system (no colori hardcoded HEX)
- ✅ Nessuna modifica a edge functions critiche (`check-inbox`, ecc.)
- ✅ No DB changes
- ✅ Type safety invariata (solo classi CSS)
- ✅ Cambio token globale `.dark` migliora l'intera app, non solo aree target

## Verifica post-applicazione

1. Aprire Email Forge in dark mode → ogni label leggibile senza sforzo
2. Settings → Arricchimento → nome partner, dominio e email count chiaramente leggibili
3. Snapshot badges (✓ Base / ○ Deep) — testo non più sbiadito
4. Bordi delle card visibili senza essere invadenti
5. Nessun testo < 11px ovunque in dark mode
6. Verificare che il cambio di `--muted` non rovini altre pagine (Cockpit, NetworkPage) — il delta è minimo (14%→17%) quindi sicuro

## Cosa otterrai

- Lettura senza sforzo in dark mode su Email Forge, Settings, Deep Search, Prompt Lab
- Standard di accessibilità WCAG AA rispettato globalmente
- Gerarchia visiva chiara: label vs valore vs hint distinguibili a colpo d'occhio
- Effetto positivo a cascata su tutte le altre pagine che usavano `text-muted-foreground`

