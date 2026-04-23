/**
 * InreachPage V2 — Inreach email ricevute
 */
import { Inbox } from "lucide-react";
import { InArrivoTab } from "@/components/outreach/InArrivoTab";

export function InreachPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-2 border-b border-border/30 flex items-center gap-3 shrink-0 bg-muted/10">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Inbox className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-foreground">Inreach</h1>
          <p className="text-[11px] text-muted-foreground">Messaggi in arrivo da tutti i canali</p>
        </div>
      </div>
      <InArrivoTab />
    </div>
  );
}
