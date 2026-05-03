/**
 * PageTitleHeader — Striscia compatta in cima alla pagina con icona + titolo.
 * Ispirata a ExploreContextHeader, ma per pagine standalone (Cockpit, Inbox,
 * Email) che non hanno tab interne. Risparmia l'altezza della tab strip
 * mostrando solo il contesto della pagina corrente.
 */
import * as React from "react";
import type { LucideIcon } from "lucide-react";

interface Props {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly subtitle?: string;
  readonly right?: React.ReactNode;
}

export function PageTitleHeader({ icon: Icon, title, subtitle, right }: Props): React.ReactElement {
  return (
    <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 border-b border-border/30 bg-card/30">
      <Icon className="h-4 w-4 text-primary shrink-0" />
      <span className="text-sm font-semibold text-foreground truncate">{title}</span>
      {subtitle && (
        <span className="text-xs text-muted-foreground truncate hidden sm:inline">· {subtitle}</span>
      )}
      {right && <div className="ml-auto flex items-center gap-1">{right}</div>}
    </div>
  );
}
export default PageTitleHeader;