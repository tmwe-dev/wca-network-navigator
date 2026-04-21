/**
 * DoctrineTab — KB entries from doctrine categories (L3 memory).
 */
import { KnowledgeBaseTab } from "./KnowledgeBaseTab";

const DOCTRINE_CATEGORIES = ["doctrine", "system_doctrine", "sales_doctrine", "procedures"];

export function DoctrineTab() {
  return (
    <div className="space-y-2">
      <div className="text-xs text-foreground/70">
        Memoria L3 — dottrine sempre incluse dall'assembler nel contesto AI.
      </div>
      <KnowledgeBaseTab categories={DOCTRINE_CATEGORIES} />
    </div>
  );
}
