/**
 * Stati lead esposti alla UI. Unica fonte delle etichette in italiano:
 * le maschere non ridefiniscono la propria mappa.
 */
import { V3_STATI_LEAD, type V3StatoLead } from "@/data/v3/contatti";

export { V3_STATI_LEAD };
export type { V3StatoLead };

export const ETICHETTE_STATO_LEAD: Record<string, string> = {
  new: "Nuovo",
  first_touch_sent: "Primo contatto",
  holding: "In attesa",
  engaged: "In dialogo",
  qualified: "Qualificato",
  negotiation: "Trattativa",
  converted: "Convertito",
  archived: "Archiviato",
  blacklisted: "Bloccato",
};

export function etichettaStato(stato: string | null): string {
  if (!stato) return "—";
  return ETICHETTE_STATO_LEAD[stato] ?? stato;
}
