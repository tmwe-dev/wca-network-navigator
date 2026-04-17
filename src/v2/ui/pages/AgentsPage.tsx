/**
 * AgentsPage V2 — Direct mount, no inner Suspense.
 */
import * as React from "react";
import V1Component from "@/pages/AgentChatHub";

export function AgentsPage(): React.ReactElement {
  return <V1Component />;
}
