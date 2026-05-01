/**
 * AnagraphicsPillsPortal — mounts the AnagraphicsPills into the global
 * top-bar slot (#campaign-header-controls) for any page that wants it.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { AnagraphicsPills, type AnagraphicsKey } from "./AnagraphicsPills";

interface Props {
  readonly active: AnagraphicsKey;
}

export function AnagraphicsPillsPortal({ active }: Props): React.ReactElement | null {
  const [container, setContainer] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => {
    setContainer(document.getElementById("campaign-header-controls"));
  }, []);
  if (!container) return null;
  return createPortal(
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <AnagraphicsPills active={active} />
    </div>,
    container,
  );
}