import { motion } from "framer-motion";
import { Menu } from "lucide-react";
import { NavMenuPopover } from "@/v2/ui/templates/NavMenuPopover";

interface CommandPageBackButtonProps {
  /** Path corrente, usato per nascondere/marcare la voce attiva. */
  currentPath?: string;
}

/**
 * Trigger del menu globale nella pagina Command (fullscreen, senza header).
 * Riusa lo stesso NavMenuPopover delle altre pagine, garantendo
 * coerenza visiva e di comportamento.
 */
export function CommandPageBackButton({ currentPath = "/v2/command" }: CommandPageBackButtonProps) {
  return (
    <NavMenuPopover currentPath={currentPath} align="start">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Apri menu di navigazione"
        className="fixed top-6 left-6 z-50 flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] text-muted-foreground/80 hover:text-foreground hover:bg-white/5 transition-all backdrop-blur-md border border-white/[0.06]"
      >
        <Menu className="w-3.5 h-3.5" />
        <span>Menu</span>
      </motion.button>
    </NavMenuPopover>
  );
}
