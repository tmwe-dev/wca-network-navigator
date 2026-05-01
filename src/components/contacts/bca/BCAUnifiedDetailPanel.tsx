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
    setHot(false);
    const id = e.dataTransfer.getData(BCA_DRAG_MIME) || e.dataTransfer.getData("text/plain");
    if (id) onDropCard(id);
  };

  const colorRing = {
    primary: "border-primary/20 hover:border-primary/40 hover:bg-primary/[0.06]",
    blue: "border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/[0.06]",
    amber: "border-amber-500/20 hover:border-amber-500/40 hover:bg-amber-500/[0.06]",
  }[color];
  const hotRing = {
    primary: "border-primary bg-primary/15 ring-2 ring-primary/40",
    blue: "border-blue-500 bg-blue-500/15 ring-2 ring-blue-500/40",
    amber: "border-amber-500 bg-amber-500/15 ring-2 ring-amber-500/40",
  }[color];
  const iconColor = {
    primary: "text-primary",
    blue: "text-blue-400",
    amber: "text-amber-400",
  }[color];

  return (
    <button
      type="button"
      onClick={onClick}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "relative flex flex-col items-start gap-1 rounded-xl border bg-card/40 p-3 text-left transition-all duration-150",
        hot ? hotRing : colorRing,
      )}
    >
      <span className={cn("inline-flex items-center justify-center w-9 h-9 rounded-lg bg-background/60", iconColor)}>
        {icon}
      </span>
      <span className="text-sm font-semibold text-foreground leading-tight">{label}</span>
      <span className="text-[10px] text-muted-foreground leading-tight">{sublabel}</span>
      {hot && (
        <span className="absolute inset-0 rounded-xl pointer-events-none flex items-center justify-center bg-background/20 backdrop-blur-[1px]">
          <span className="text-[11px] font-medium text-foreground/90 px-2 py-0.5 rounded-md bg-card border border-border/60 shadow-sm">
            Rilascia per {label.toLowerCase()}
          </span>
        </span>
      )}
    </button>
  );
}