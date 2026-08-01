/**
 * BCAUnifiedDetailPanel — Wrapper sottile sul `BusinessCardDetailPanel`.
 *
 * Storia: in passato qui c'era una HERO grid 2x2 di drop-target sempre visibile
 * che duplicava le azioni e occupava metà pannello. Ora il drag&drop è gestito
 * dall'overlay globale `BCADragDropOverlay`, che appare solo durante il drag.
 * Le azioni click sono nel pannello sotto, in due gruppi compatti
 * (Comunicazione + AI), niente duplicati.
 *
 * `resolveCard` non serve più qui — è usato dall'overlay tramite il parent.
 */
import { BusinessCardDetailPanel } from "./BCADetailPanel";
import type { BusinessCardWithPartner } from "@/hooks/useBusinessCards";

interface Props {
  card: BusinessCardWithPartner;
  onClose: () => void;
}

export function BCAUnifiedDetailPanel({ card, onClose }: Props) {
  return (
    <div className="h-full overflow-hidden">
      <BusinessCardDetailPanel card={card} onClose={onClose} />
    </div>
  );
}