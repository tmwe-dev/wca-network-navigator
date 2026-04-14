// TODO(v2-migration): wrapper temporaneo di src/pages/AgentChatHub.tsx. Tracked in docs/v2/MIGRATION_STATUS.md.
/**
 * AgentsPage V2 — Thin wrapper mounting V1 AgentChatHub
 * Agent Chat Hub con chat, voice, tools
 */
import * as React from "react";
import { Suspense, lazy } from "react";

const V1Component = lazy(() => import("@/pages/AgentChatHub"));

export function AgentsPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <V1Component />
    </Suspense>
  );
}
