/**
 * BCAUnifiedDetailPanel — Detail panel for the unified CRM › Biglietti page.
 *
 * Wraps the standard `BusinessCardDetailPanel` and adds a prominent "Azioni
 * intelligenti" grid (Cockpit · Deep Search · LinkedIn · Campagna) where each
 * action is an INDEPENDENT drop target.
 *
 * Drop semantics:
 *  - Each tile registers its own onDragEnter/Leave/Drop handlers.
 *  - A tile highlights only when the pointer is inside its own bounds,
 *    using a ref-counter pattern to avoid flicker on child enter/leave.
 *  - Dropping a card on a tile triggers that tile's action against the
 *    dropped card (resolved via id from the parent-provided lookup).
 */
import * as React from "react";
import { useCallback, useRef, useState } from "react";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { ArrowRight, Search, Linkedin, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { BusinessCardDetailPanel } from "./BCADetailPanel";
import { BCA_DRAG_MIME } from "./bcaDragContext";
import { supabase } from "@/integrations/supabase/client";
import { insertCockpitQueueItems } from "@/data/cockpitQueue";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "@/hooks/use-toast";
import type { BusinessCardWithPartner } from "@/hooks/useBusinessCards";

type ActionKind = "cockpit" | "deep_search" | "linkedin" | "campaign";

interface Props {
  card: BusinessCardWithPartner;
  onClose: () => void;
  /** Resolves a dragged card id back to the full record (from the parent list). */
  resolveCard: (id: string) => BusinessCardWithPartner | undefined;
}

export function BCAUnifiedDetailPanel({ card, onClose, resolveCard }: Props) {
  const navigate = useAppNavigate();

  const runAction = useCallback(
    async (kind: ActionKind, target: BusinessCardWithPartner) => {
      try {
        if (kind === "cockpit") {
          const { data: { session: __s } } = await supabase.auth.getSession();
          const user = __s?.user ?? null;
          if (!user) { toast({ title: "Sessione assente", variant: "destructive" }); return; }
          await insertCockpitQueueItems([{
            source_id: target.id,
            source_type: "business_card",
            user_id: user.id,
            partner_id: target.matched_partner_id || null,
          }]);
          toast({ title: "✅ Inviato al Cockpit", description: target.contact_name || target.company_name || undefined });
          return;
        }
        if (kind === "deep_search") {
          if (!target.matched_partner_id) {
            toast({ title: "Nessun partner WCA associato", description: "Associa prima un partner per la Deep Search.", variant: "destructive" });
            return;
          }
          await invokeEdge("ai-utility", {
            body: { action: "deep_search", partnerIds: [target.matched_partner_id] },
            context: "BCAUnifiedDetailPanel.deep_search",
          });
          toast({ title: "🔍 Deep Search avviata" });
          return;
        }
        if (kind === "linkedin") {
          const query = [target.contact_name, target.company_name].filter(Boolean).join(" ");
          if (!query) { toast({ title: "Dati insufficienti per LinkedIn", variant: "destructive" }); return; }
          window.open(`https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(query)}`, "_blank");
          return;
        }
        if (kind === "campaign") {
          if (!target.email) { toast({ title: "Email mancante", variant: "destructive" }); return; }
          navigate("/v2/email-composer", {
            state: {
              prefilledRecipient: {
                email: target.email,
                name: target.contact_name || undefined,
                company: target.company_name || undefined,
                partnerId: target.matched_partner_id || undefined,
              },
            },
          });
          return;
        }
      } catch (e: unknown) {
        toast({ title: "Errore", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
      }
    },
    [navigate],
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Smart actions HERO grid — drop targets */}
      <div className="px-3 pt-3 pb-2 border-b border-border/40 bg-gradient-to-b from-primary/[0.04] to-transparent shrink-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2 px-1">
          Azioni intelligenti · trascina qui un contatto
        </p>
        <div className="grid grid-cols-2 gap-2">
          <DropTarget
            kind="cockpit"
            label="Cockpit"
            sublabel="Aggiungi al cockpit"
            icon={<ArrowRight className="w-5 h-5" />}
            color="primary"
            onClick={() => runAction("cockpit", card)}
            onDropCard={(id) => {
              const rec = resolveCard(id) ?? card;
              runAction("cockpit", rec);
            }}
          />
          <DropTarget
            kind="deep_search"
            label="Deep Search"
            sublabel="Arricchimento AI"
            icon={<Search className="w-5 h-5" />}
            color="primary"
            onClick={() => runAction("deep_search", card)}
            onDropCard={(id) => {
              const rec = resolveCard(id) ?? card;
              runAction("deep_search", rec);
            }}
          />
          <DropTarget
            kind="linkedin"
            label="LinkedIn"
            sublabel="Apri ricerca"
            icon={<Linkedin className="w-5 h-5" />}
            color="blue"
            onClick={() => runAction("linkedin", card)}
            onDropCard={(id) => {
              const rec = resolveCard(id) ?? card;
              runAction("linkedin", rec);
            }}
          />
          <DropTarget
            kind="campaign"
            label="Campagna"
            sublabel="Email composer"
            icon={<Megaphone className="w-5 h-5" />}
            color="amber"
            onClick={() => runAction("campaign", card)}
            onDropCard={(id) => {
              const rec = resolveCard(id) ?? card;
              runAction("campaign", rec);
            }}
          />
        </div>
      </div>

      {/* Standard detail */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <BusinessCardDetailPanel card={card} onClose={onClose} />
      </div>
    </div>
  );
}

/* ───────────── DropTarget tile ───────────── */

interface DropTargetProps {
  kind: ActionKind;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  color: "primary" | "blue" | "amber";
  onClick: () => void;
  onDropCard: (cardId: string) => void;
}

function DropTarget({ label, sublabel, icon, color, onClick, onDropCard }: DropTargetProps) {
  const counter = useRef(0);
  const [hot, setHot] = useState(false);

  const accepts = (e: React.DragEvent) =>
    e.dataTransfer.types.includes(BCA_DRAG_MIME);

  const onDragEnter = (e: React.DragEvent) => {
    if (!accepts(e)) return;
    e.preventDefault();
    counter.current += 1;
    if (counter.current === 1) setHot(true);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!accepts(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (!accepts(e)) return;
    counter.current = Math.max(0, counter.current - 1);
    if (counter.current === 0) setHot(false);
  };
  const onDrop = (e: React.DragEvent) => {
    if (!accepts(e)) return;
    e.preventDefault();
    counter.current = 0;
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