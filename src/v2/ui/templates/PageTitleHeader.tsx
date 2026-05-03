/**
 * PageTitleHeader — Striscia compatta in cima alla pagina con icona + titolo.
 * Ispirata a ExploreContextHeader, ma per pagine standalone (Cockpit, Inbox,
 * Email) che non hanno tab interne. Risparmia l'altezza della tab strip
 * mostrando solo il contesto della pagina corrente.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";

interface Props {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly subtitle?: string;
  readonly right?: React.ReactNode;
}

export function PageTitleHeader({ icon: Icon, title, subtitle, right }: Props): React.ReactElement | null {
  const [slot, setSlot] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    const el = document.getElementById("page-title-slot");
    setSlot(el);
  }, []);

  const content = (
    <div className="flex items-center gap-2 min-w-0" data-testid="page-title-header">
      <Icon className="h-4 w-4 text-primary shrink-0" />
      <span className="text-sm font-semibold text-foreground truncate">{title}</span>
      {subtitle && (
        <span className="text-xs text-muted-foreground truncate hidden sm:inline">· {subtitle}</span>
      )}
      {right && <div className="ml-2 flex items-center gap-1">{right}</div>}
    </div>
  );

  if (!slot) return null;
  return createPortal(content, slot);
}
export default PageTitleHeader;