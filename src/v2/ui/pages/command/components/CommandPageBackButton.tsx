import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

interface CommandPageBackButtonProps {
  onBack: () => void;
}

export function CommandPageBackButton({ onBack }: CommandPageBackButtonProps) {
  return (
    <motion.button
      onClick={onBack}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="fixed top-6 left-6 z-50 flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] text-muted-foreground/80 hover:text-foreground hover:bg-white/5 transition-all backdrop-blur-md border border-white/[0.06]"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      <span>Dashboard</span>
    </motion.button>
  );
}
