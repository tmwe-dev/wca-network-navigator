import { Mail, Phone, Smartphone, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CanvasContact, CanvasPhase, ContactSource } from "../PartnerCanvas";

function isContactComplete(c: CanvasContact): "green" | "orange" | "red" {
  const hasEmail = !!c.email?.trim();
  const hasPhone = !!(c.direct_phone?.trim() || c.mobile?.trim());
  if (hasEmail && hasPhone) return "green";
  if (hasEmail || hasPhone) return "orange";
  return "red";
}

const QUALITY_COLORS = {
  green: "bg-emerald-500",
  orange: "bg-primary",
  red: "bg-destructive",
};

interface Props {
  contacts: CanvasContact[];
  phase: CanvasPhase;
  contactSource?: ContactSource;
  visible: boolean;
}

export function CanvasContactList({ contacts, phase, contactSource, visible }: Props) {
  if (contacts.length === 0 && visible) {
    if (phase === "extracting" || phase === "downloading") {
      return (
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-xs text-primary font-semibold flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Estrazione contatti in corso...
        </div>
      );
    }
    if (phase === "complete") {
      return (
        <div className="p-3 rounded-lg bg-destructive/15 border border-destructive/30 text-xs text-destructive font-semibold">
          ⚠️ Nessun contatto trovato — dati incompleti
        </div>
      );
    }
    return null;
  }

  if (contacts.length === 0) return null;

  const completeCount = contacts.filter((c) => isContactComplete(c) === "green").length;
  const total = contacts.length;
  const allComplete = completeCount === total;

  return (
    <div className={cn("transition-all duration-500", visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4")}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contatti</h3>
          {contactSource && contactSource !== "none" && (
            <span className={cn(
              "text-[10px] font-bold px-2 py-0.5 rounded-full",
              contactSource === "extension"
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-muted text-muted-foreground border border-border"
            )}>
              {contactSource === "extension" ? "🔌 Extension" : "☁️ Server"}
            </span>
          )}
        </div>
        <span className={cn(
          "text-[11px] font-bold px-2.5 py-1 rounded-full",
          allComplete ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30"
            : completeCount === 0 ? "bg-destructive/20 text-destructive border border-destructive/30"
            : "bg-primary/20 text-primary border border-primary/30"
        )}>
          {completeCount}/{total} completi
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {contacts.slice(0, 6).map((c, i) => {
          const quality = isContactComplete(c);
          return (
            <div key={i} className={cn(
              "flex items-start gap-2 p-2 rounded-lg text-xs border",
              quality === "green" ? "bg-emerald-500/10 border-emerald-500/30"
                : quality === "orange" ? "bg-primary/10 border-primary/30"
                : "bg-destructive/15 border-destructive/30"
            )}>
              <div className={cn("w-2.5 h-2.5 rounded-full mt-1 shrink-0", QUALITY_COLORS[quality])} />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{c.name}</div>
                {c.title && <div className="text-muted-foreground truncate">{c.title}</div>}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px]">
                  {c.email && <span className="flex items-center gap-1 text-muted-foreground"><Mail className="w-3 h-3" /> {c.email}</span>}
                  {c.direct_phone && <span className="flex items-center gap-1 text-muted-foreground"><Phone className="w-3 h-3" /> {c.direct_phone}</span>}
                  {c.mobile && <span className="flex items-center gap-1 text-muted-foreground"><Smartphone className="w-3 h-3" /> {c.mobile}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
