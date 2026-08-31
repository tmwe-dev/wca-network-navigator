import { motion } from "framer-motion";
import { Menu } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MainMenu } from "@/v2/ui/templates/MainMenu";

interface CommandPageBackButtonProps {
  /** Mantenuto per compatibilità con i call site. */
  currentPath?: string;
}

/**
 * Trigger dell'unico menu di sistema nelle pagine fullscreen (senza header).
 */
export function CommandPageBackButton({ currentPath }: CommandPageBackButtonProps) {
  void currentPath;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Apri menu di navigazione"
          className="fixed top-6 left-6 z-50 flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all backdrop-blur-md border border-white/[0.06]"
        >
          <Menu className="w-3.5 h-3.5" />
          <span>Menu</span>
        </motion.button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex h-[min(72vh,640px)] w-72 flex-col overflow-hidden p-0">
        <MainMenu />
      </PopoverContent>
    </Popover>
  );
}
