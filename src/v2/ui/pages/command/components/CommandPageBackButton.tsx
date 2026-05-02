import { motion } from "framer-motion";
import { Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { navItemsDef } from "@/v2/ui/templates/navConfig";
import { useState } from "react";

interface CommandPageBackButtonProps {
  /** Path corrente, usato per nascondere/marcare la voce attiva. */
  currentPath?: string;
}

/**
 * Launcher di navigazione globale per la pagina Command (fullscreen, senza sidebar).
 * Sostituisce la vecchia freccia "← Dashboard" che puntava a una pagina orfana.
 * Click → popover con tutte le destinazioni principali (single source: navConfig).
 */
export function CommandPageBackButton({ currentPath = "/v2/command" }: CommandPageBackButtonProps) {
  const nav = useNavigate();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleSelect = (path: string) => {
    setOpen(false);
    nav(path);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Apri menu di navigazione"
          className="fixed top-6 left-6 z-50 flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] text-muted-foreground/80 hover:text-foreground hover:bg-white/5 transition-all backdrop-blur-md border border-white/[0.06]"
        >
          <Menu className="w-3.5 h-3.5" />
          <span>Menu</span>
        </motion.button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-60 p-1 bg-background/95 backdrop-blur-xl border-white/10"
      >
        <div className="flex flex-col">
          {navItemsDef
            .filter((item) => item.path !== currentPath)
            .map((item) => (
              <button
                key={item.path}
                role="menuitem"
                onClick={() => handleSelect(item.path)}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-foreground/90 hover:bg-white/5 hover:text-foreground transition-colors text-left"
              >
                <span className="text-muted-foreground">{item.icon}</span>
                <span>{t(item.labelKey)}</span>
              </button>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
