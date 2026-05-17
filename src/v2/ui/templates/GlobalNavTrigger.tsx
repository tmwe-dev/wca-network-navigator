/**
 * GlobalNavTrigger — Pulsante fluttuante "☰ Menu" mostrato in alto a
 * sinistra in TUTTE le pagine autenticate. Apre il `NavMenuPopover`,
 * unico menu di navigazione globale del sistema.
 *
 * Sostituisce LayoutHeader + LayoutIconRail + header mobile: niente più
 * top bar né sidebar. Stesso pattern del Command page.
 */
import { motion } from "framer-motion";
import { Menu } from "lucide-react";
import { useLocation } from "react-router-dom";
import { NavMenuPopover } from "./NavMenuPopover";

export function GlobalNavTrigger(): React.ReactElement {
  const { pathname } = useLocation();
  return (
    <NavMenuPopover currentPath={pathname} align="start">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Apri menu di navigazione"
        data-testid="global-nav-trigger"
        className="fixed top-3 left-3 z-50 flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] text-muted-foreground hover:text-foreground bg-background/70 hover:bg-background/90 transition-all backdrop-blur-md border border-border/40 shadow-sm"
      >
        <Menu className="w-3.5 h-3.5" />
        <span className="font-medium">Menu</span>
      </motion.button>
    </NavMenuPopover>
  );
}