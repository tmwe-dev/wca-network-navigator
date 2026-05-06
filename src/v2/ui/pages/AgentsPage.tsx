/**
 * AgentsPage V2 — Direct mount, no inner Suspense.
 */
import * as React from "react";
import { Brain } from "lucide-react";
import { PageTitleHeader } from "@/v2/ui/templates/PageTitleHeader";
import V1Component from "@/components/agents/AgentChatHubView";

export function AgentsPage(): React.ReactElement {
  return (
    <>
      <PageTitleHeader icon={Brain} title="Agenti" subtitle="Hub conversazionale" />
      <V1Component />
    </>
  );
}
