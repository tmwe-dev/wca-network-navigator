/**
 * CommandSuggestions — empty state with quick prompts + capabilities.
 */
import { motion } from "framer-motion";
import AiEntity from "@/components/ai/AiEntity";
import { quickPrompts, capabilities } from "../constants";

const ease = [0.2, 0.8, 0.2, 1] as const;

interface Props {
  onSend: (text: string) => void;
}

export default function CommandSuggestions({ onSend }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8">
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.5, ease }} className="mb-10">
        <AiEntity size="lg" />
      </motion.div>
      <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, ease }} className="text-2xl font-extralight tracking-tight text-foreground/100 mb-2">
        Cosa vuoi ottenere?
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-[13px] text-muted-foreground/98 font-light mb-10 text-center max-w-sm">
        14 sorgenti unificate · 12.847 contatti · 234 partner WCA · 1.420 business card
      </motion.p>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="flex flex-col items-center gap-2">
        {quickPrompts.map((p, i) => (
          <motion.button
            key={p}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 + i * 0.1, ease }}
            onClick={() => onSend(p)}
            whileHover={{ x: 4 }}
            className="text-[12px] px-4 py-2.5 rounded-2xl text-muted-foreground/97 hover:text-muted-foreground/98 hover:bg-secondary/[0.1] transition-all duration-700 text-left"
          >
            → {p}
          </motion.button>
        ))}
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }} className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-12">
        {capabilities.map((cap, i) => (
          <motion.span key={cap} className="text-[9px] text-muted-foreground/100 font-light" animate={{ opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 4, repeat: Infinity, delay: i * 0.5 }}>
            {cap}
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
}
