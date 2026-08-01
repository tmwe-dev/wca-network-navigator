/**
 * InreachPage V2 — Inreach email ricevute
 */
import { InArrivoTab } from "@/components/outreach/InArrivoTab";
import { PageTitleHeader } from "@/v2/ui/templates/PageTitleHeader";
import { Inbox } from "lucide-react";

export function InreachPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageTitleHeader icon={Inbox} title="Inbox" subtitle="Email ricevute" />
      <div className="flex-1 min-h-0 overflow-hidden">
        <InArrivoTab />
      </div>
    </div>
  );
}
