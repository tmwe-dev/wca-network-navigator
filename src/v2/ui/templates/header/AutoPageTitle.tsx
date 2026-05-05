/**
 * AutoPageTitle — Mostra automaticamente il titolo della pagina corrente
 * (icona + label derivati da pathname/breadcrumbs) nello slot `page-title-slot`.
 * Si auto-disattiva se la pagina ha già montato il proprio PageTitleHeader
 * (osserva i figli dello slot via MutationObserver).
 */
import * as React from "react";
import { useLocation } from "react-router-dom";
import { buildCrumbs } from "../breadcrumbConfig";
import { FileText } from "lucide-react";

export function AutoPageTitle(): React.ReactElement | null {
  const { pathname } = useLocation();
  const [slotHasChild, setSlotHasChild] = React.useState(false);

  React.useEffect(() => {
    const slot = document.getElementById("page-title-slot");
    if (!slot) return;
    const update = (): void => {
      // Conta solo figli che NON sono il nostro fallback
      const children = Array.from(slot.children).filter(
        (c) => !c.hasAttribute("data-auto-page-title"),
      );
      setSlotHasChild(children.length > 0);
    };
    update();
    const obs = new MutationObserver(update);
    obs.observe(slot, { childList: true, subtree: false });
    return () => obs.disconnect();
  }, [pathname]);

  if (slotHasChild) return null;
  if (pathname === "/v2" || pathname === "/v2/") return null;

  const crumbs = buildCrumbs(pathname);
  const last = crumbs[crumbs.length - 1];
  if (!last) return null;

  return (
    <div
      data-auto-page-title
      className="flex items-center gap-2 min-w-0"
    >
      <FileText className="h-4 w-4 text-primary shrink-0" />
      <span className="text-sm font-semibold text-foreground truncate">
        {last.label}
      </span>
    </div>
  );
}