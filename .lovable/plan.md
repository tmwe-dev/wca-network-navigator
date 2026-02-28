

## Design System Ultra-Moderno — Dark-First Implementation

Three files to modify:

### 1. `src/main.tsx` — Force dark mode
Add `document.documentElement.classList.add('dark');` before `createRoot`.

### 2. `src/index.css` — Complete rewrite
- **Dark CSS variables**: background `222 47% 7%`, card `216 34% 11%`, border `216 34% 17%`, primary `210 100% 56%` (blue), accent `262 71% 40%` (purple), muted-foreground `215 20% 55%`
- **Body**: radial gradients (blue at top, purple at bottom-right) for depth
- **New utility classes**:
  - `.glass-panel` / `-blue` / `-green` / `-amber` / `-purple` — backdrop-blur(24px) saturate(180%) with colored borders
  - `.text-gradient-blue/green/amber` — gradient text with background-clip
  - `.glow-blue/green/amber/purple` — box-shadow glow effects
  - `.border-gradient-blue/green/amber` — gradient borders via padding-box trick
  - `.shimmer-effect` — animated shimmer overlay
  - `.status-dot` + `-blue/-green/-amber/-red` — pulsating indicator dots
  - `.card-hover` — translateY(-2px) + deep shadow on hover
  - `.card-interactive` — focus ring with blue glow
  - `.micro-badge-blue/amber/green/red/purple` — compact 11px badges
  - `.alert-danger/warning/ok` — gradient alert boxes
  - Custom scrollbar (6px, transparent track, rgba white thumb)
- **Legacy preserved**: `.space-panel-*`, `.glass-surface`, `.glass-card`, `.glass-badge`, `.glass-section`

### 3. `tailwind.config.ts` — Extensions
- **Fonts**: `"SF Pro Display", "Geist"` prepended to sans/display stacks
- **New shadows**: `glass`, `float`, `glow-blue`, `glow-purple`
- **New backgroundImage**: `gradient-radial`, `grid-pattern` (32px grid)
- **New backgroundSize**: `grid: "32px 32px"`
- **New keyframes**: `slide-in-right`, `slide-in-left`, `slide-in-up`, `float` (vertical oscillation), `glow-pulse`, `spin-slow` (8s)
- **New animations**: matching entries for all new keyframes

### Files
| File | Action |
|------|--------|
| `src/main.tsx` | Add dark class to documentElement |
| `src/index.css` | Full rewrite with new variables + utility classes |
| `tailwind.config.ts` | Add fonts, shadows, keyframes, backgroundImage |

