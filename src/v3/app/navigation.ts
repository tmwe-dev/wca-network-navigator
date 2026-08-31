/**
 * Navigazione V3 — le 6 sezioni del perimetro.
 *
 * La barra laterale mostra solo queste voci. Le maschere secondarie restano
 * raggiungibili per percorso e sono elencate nel Laboratorio: nessuna rotta
 * viene rimossa, lo sfoltimento è solo di navigazione (quindi reversibile).
 */
import { V3_PAGES, type V3PageDefinition } from "./pageContract";

export interface V3NavVoce {
  readonly path: string;
  readonly titolo: string;
}

export interface V3NavSezione {
  readonly id: string;
  readonly titolo: string;
  readonly voci: readonly V3NavVoce[];
}

function voce(page: V3PageDefinition, titolo?: string): V3NavVoce {
  return { path: page.path, titolo: titolo ?? page.title };
}

export const V3_NAV: readonly V3NavSezione[] = [
  { id: "contatti", titolo: "Contatti", voci: [voce(V3_PAGES.contatti, "Anagrafica")] },
  {
    id: "messaggi",
    titolo: "Messaggi",
    voci: [voce(V3_PAGES.inbox), voce(V3_PAGES.scrivi), voce(V3_PAGES.canali)],
  },
  { id: "dafare", titolo: "Da fare", voci: [voce(V3_PAGES.dafare, "Approvazioni, agenda, coda")] },
  { id: "command", titolo: "Command", voci: [voce(V3_PAGES.command, "Chiedi al sistema")] },
  {
    id: "tracciamento",
    titolo: "Tracciamento",
    voci: [voce(V3_PAGES.andamento), voce(V3_PAGES.registro)],
  },
  {
    id: "impostazioni",
    titolo: "Impostazioni",
    voci: [voce(V3_PAGES.impostazioni), voce(V3_PAGES.operatori), voce(V3_PAGES.laboratorio)],
  },
];

/** Percorsi presenti nella navigazione principale. */
const PRINCIPALI = new Set(V3_NAV.flatMap((s) => s.voci.map((v) => v.path)));

/** Maschere fuori dalle 6 sezioni: elencate nel Laboratorio, non nella barra. */
export const V3_PAGINE_SECONDARIE: readonly V3PageDefinition[] = (
  Object.values(V3_PAGES) as V3PageDefinition[]
).filter(
  (p) =>
    p.implemented &&
    !p.publicRoute &&
    !PRINCIPALI.has(p.path) &&
    !p.path.includes(":"),
);
