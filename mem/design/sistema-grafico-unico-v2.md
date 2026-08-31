---
name: Sistema grafico unico V2
description: Palette Midnight Indigo, 5 archetipi di pagina, contratto UI e densità 2/5 per tutte le maschere V2
type: design
---

Standard grafico deciso il 2026-08-31. Documenti in `docs/design/`.

- **Palette Midnight Indigo**: sfondo `#0a0a1a` (240 44% 7%), superficie `#141432` (240 43% 14%),
  bordo `#1e1e5a` (240 51% 24%), accento unico `#4f46e5` (243 75% 59%).
  Verde/ambra/rosso/viola SOLO come stati semantici, mai decorazione.
  Vietati colori Tailwind grezzi ed esadecimali nel JSX.
- **Layout base**: Dashboard a pannelli. Guscio unico `StandardPageFrame`
  (`PageShell` e `PageTitleHeader` verranno assorbiti).
- **Densità 2/5**: max 5 informazioni di livello 1 per riga/card, max 2 badge visibili (`+N`),
  max 3 azioni in header + menu «…», tasto AI sempre nella stessa posizione.
  Filtri solo nel rail sinistro, workflow solo nel rail destro.
- **5 archetipi**: Elenco→Dettaglio, Monitor/KPI, Editor/Config, Flusso operativo, Hub.
- **Escluse dal template**: Globo/Mappa, Campagne, Galassia (canvas 3D) e Command;
  su queste si applica solo la palette.
- **Prototipo di riferimento**: Missioni Autopilot (archetipo Monitor/KPI).
- Migrazione a ondate: solo presentazione, mai logica, query, DAL o edge function.
