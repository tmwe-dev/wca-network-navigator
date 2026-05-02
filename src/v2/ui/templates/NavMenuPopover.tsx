/**
 * NavMenuPopover — Dropdown di navigazione globale, identico in tutte le
 * pagine. Usato sia in CommandPage (trigger custom "Menu" fixed top-left)
 * sia in LayoutHeader (trigger ☰ standard).
 *
 * Single source of truth: navItemsDef.
 */
import * as React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { navItemsDef } from "./navConfig";

/** Estrae la radice di sezione: `/v2/intelligence/agents` → `/v2/intelligence`. */
function sectionRoot(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2) return "/v2";
  return `/${parts[0]}/${parts[1]}`;
}

interface NavMenuPopoverProps {
  /** Trigger element (e.g. icon button). Renders inside <PopoverTrigger asChild>. */
  children: React.ReactNode;
  /** Path corrente, usato per nascondere la voce attiva. */
  currentPath?: string;
  /** Allineamento del contenuto rispetto al trigger. Default: start. */
  align?: "start" | "center" | "end";
}

export function NavMenuPopover({
  children,
  currentPath,
  align = "start",
}: NavMenuPopoverProps): React.ReactElement {
  const nav = useNavigate();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleSelect = (path: string) => {
    setOpen(false);
    nav(path);
  };

  const activeRoot = currentPath ? sectionRoot(currentPath) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={8}
        className="w-60 p-1 bg-background/95 backdrop-blur-xl border-white/10"
      >
        <div className="flex flex-col">
          {navItemsDef
            .filter((item) => sectionRoot(item.path) !== activeRoot)
            .map((item) => {
              const translated = t(item.labelKey);
              const label =
                translated === item.labelKey
                  ? item.labelKey.replace(/^nav\./, "").replace(/_/g, " ")
                  : translated;
              return (
                <button
                  key={item.path}
                  role="menuitem"
                  onClick={() => handleSelect(item.path)}
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-foreground/90 hover:bg-white/5 hover:text-foreground transition-colors text-left capitalize"
                >
                  <span className="text-muted-foreground">{item.icon}</span>
                  <span>{label}</span>
                </button>
              );
            })}
        </div>
      </PopoverContent>
    </Popover>
  );
}