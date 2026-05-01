/**
 * BCADragDropOverlay — Overlay fullscreen che appare SOLO durante il drag di
 * un biglietto (BCA). Mostra 4 grandi target azione (Cockpit · Deep Search ·
 * LinkedIn · Campagna). Si smonta a `dragend`/`drop`.
 *
 * Vantaggio: zero spazio sprecato nel pannello dettaglio quando non serve,
 * drop-target enormi e leggibili quando l'utente sta trascinando.
 */
import * as React from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Search, Linkedin, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { BCA_DRAG_MIME } from "./bcaDragContext";
import { supabase } from "@/integrations/supabase/client";
import { insertCockpitQueueItems } from "@/data/cockpitQueue";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "@/hooks/use-toast";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import type { BusinessCardWithPartner } from "@/hooks/useBusinessCards";

type ActionKind = "cockpit" | "deep_search" | "linkedin" | "campaign";

interface Props {
  /** Risolve un id trascinato nella card completa. */
  resolveCard: (id: string) => BusinessCardWithPartner | undefined;
}

/** Hook globale: ascolta i dragstart con il MIME BCA per attivare l'overlay. */
function useBcaDragActive(): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onStart = (e: DragEvent) => {
      if (e.dataTransfer?.types && Array.from(e.dataTransfer.types).includes(BCA_DRAG_MIME)) {
        setActive(true);
      }
    };
    const onEnd = () => setActive(false);
    const onDrop = () => setActive(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setActive(false); };

    window.addEventListener("dragstart", onStart);
    window.addEventListener("dragend", onEnd);
    window.addEventListener("drop", onDrop);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("dragstart", onStart);
      window.removeEventListener("dragend", onEnd);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return active;
}

export function BCADragDropOverlay({ resolveCard }: Props) {
  const active = useBcaDragActive();
  const navigate = useAppNavigate();

  const runAction = useCallback(
    async (kind: ActionKind, target: BusinessCardWithPartner) => {
      try {
        if (kind === "cockpit") {
          const { data: { session } } = await supabase.auth.getSession();
          const user = session?.user ?? null;
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
            context: "BCADragDropOverlay.deep_search",
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

  if (!active) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-background/80 backdrop-blur-md flex flex-col items-center justify-center gap-6 p-8 animate-in fade-in duration-150"
      // Prevent default so 'drop' fires on children correctly
      onDragOver={(e) => { e.preventDefault(); }}
    >
      <div className="text-center space-y-1">
        <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-400 font-semibold [text-shadow:0_0_8px_hsl(190_100%_60%/0.6)]">
          Rilascia su un'azione
        </p>
        <h2 className="text-2xl font-bold text-foreground">Cosa vuoi fare con questo contatto?</h2>
        <p className="text-xs text-muted-foreground">Premi Esc per annullare</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-5xl">
        <BigDropTile
          label="Cockpit"
          sublabel="Aggiungi alla coda operativa"
          icon={<ArrowRight className="w-10 h-10" />}
          color="primary"
          onDropCard={(id) => { const r = resolveCard(id); if (r) runAction("cockpit", r); }}
        />
        <BigDropTile
          label="Deep Search"
          sublabel="Arricchimento AI partner"
          icon={<Search className="w-10 h-10" />}
          color="primary"
          onDropCard={(id) => { const r = resolveCard(id); if (r) runAction("deep_search", r); }}
        />
        <BigDropTile
          label="LinkedIn"
          sublabel="Apri ricerca contatto"
          icon={<Linkedin className="w-10 h-10" />}
          color="blue"
          onDropCard={(id) => { const r = resolveCard(id); if (r) runAction("linkedin", r); }}
        />
        <BigDropTile
          label="Campagna"
          sublabel="Apri Email Composer"
          icon={<Megaphone className="w-10 h-10" />}
          color="amber"
          onDropCard={(id) => { const r = resolveCard(id); if (r) runAction("campaign", r); }}
        />
      </div>
    </div>,
    document.body,
  );
}

/* ───────────── Big drop tile ───────────── */

interface TileProps {
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  color: "primary" | "blue" | "amber";
  onDropCard: (cardId: string) => void;
}

function BigDropTile({ label, sublabel, icon, color, onDropCard }: TileProps) {
  const counter = useRef(0);
  const [hot, setHot] = useState(false);

  const accepts = (e: React.DragEvent) => e.dataTransfer.types.includes(BCA_DRAG_MIME);

  const colorClasses = {
    primary: { idle: "border-primary/30 bg-primary/[0.04]", hot: "border-primary bg-primary/15 [box-shadow:0_0_40px_hsl(var(--primary)/0.4)]", text: "text-primary" },
    blue: { idle: "border-blue-500/30 bg-blue-500/[0.04]", hot: "border-blue-400 bg-blue-500/15 [box-shadow:0_0_40px_rgb(59_130_246/0.4)]", text: "text-blue-400" },
    amber: { idle: "border-amber-500/30 bg-amber-500/[0.04]", hot: "border-amber-400 bg-amber-500/15 [box-shadow:0_0_40px_rgb(251_191_36/0.4)]", text: "text-amber-400" },
  }[color];

  return (
    <div
      onDragEnter={(e) => {
        if (!accepts(e)) return;
        e.preventDefault();
        counter.current += 1;
        if (counter.current === 1) setHot(true);
      }}
      onDragOver={(e) => {
        if (!accepts(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(e) => {
        if (!accepts(e)) return;
        counter.current = Math.max(0, counter.current - 1);
        if (counter.current === 0) setHot(false);
      }}
      onDrop={(e) => {
        if (!accepts(e)) return;
        e.preventDefault();
        counter.current = 0;
        setHot(false);
        const id = e.dataTransfer.getData(BCA_DRAG_MIME) || e.dataTransfer.getData("text/plain");
        if (id) onDropCard(id);
      }}
      className={cn(
        "rounded-2xl border-2 border-dashed transition-all duration-150 p-6 flex flex-col items-center justify-center gap-3 min-h-[180px] cursor-copy",
        hot ? colorClasses.hot : colorClasses.idle,
      )}
    >
      <div className={cn("transition-transform", hot && "scale-110", colorClasses.text)}>{icon}</div>
      <div className="text-center">
        <div className="text-base font-bold text-foreground">{label}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{sublabel}</div>
      </div>
    </div>
  );
}