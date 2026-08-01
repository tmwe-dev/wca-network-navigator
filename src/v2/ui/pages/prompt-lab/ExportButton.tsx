/**
 * ExportButton — scarica snapshot JSON di tutti i tab.
 */
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { Block } from "./types";

interface ExportButtonProps {
  getSnapshot: () => Record<string, ReadonlyArray<Block>>;
}

export function ExportButton({ getSnapshot }: ExportButtonProps) {
  function onExport() {
    const snapshot = getSnapshot();
    const payload = {
      exported_at: new Date().toISOString(),
      version: 1,
      tabs: snapshot,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prompt-lab-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button size="sm" variant="outline" onClick={onExport}>
      <Download className="h-3.5 w-3.5" /> Export JSON
    </Button>
  );
}