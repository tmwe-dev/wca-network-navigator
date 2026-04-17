/**
 * NetworkPage V2 — Direct mount of Operations (skips legacy wrapper).
 * Singolo livello, nessun Suspense interno (gestito da guardedPage).
 */
import * as React from "react";
import Operations from "@/pages/Operations";
import { useTrackPage } from "@/hooks/useTrackPage";

export function NetworkPage(): React.ReactElement {
  useTrackPage("network");
  return (
    <div data-testid="page-network" className="flex flex-col h-full min-h-0 overflow-hidden">
      <Operations />
    </div>
  );
}
