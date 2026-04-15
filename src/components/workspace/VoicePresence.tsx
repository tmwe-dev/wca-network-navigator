import { motion, AnimatePresence } from "framer-motion";

const ease = [0.2, 0.8, 0.2, 1] as const;

interface VoicePresenceProps {
  active: boolean;
  speaking?: boolean;
  listening?: boolean;
}

const VoicePresence = ({ active, speaking = false, listening = false }: VoicePresenceProps) => {
  if (!active) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.5, ease }}
      className="overflow-hidden"
    >
      <div className="flex flex-col items-center gap-3 py-4">
        <motion.div
          className="flex items-center gap-2"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className={`w-2 h-2 rounded-full ${speaking ? "bg-accent/60" : "bg-primary/60"}`} />
          <span className="text-[10px] text-muted-foreground/92 tracking-[0.15em] uppercase font-mono">
            {speaking ? "ASSISTENTE PARLA" : listening ? "IN ASCOLTO" : "VOCE ATTIVA"}
          </span>
        </motion.div>

        <div className="flex items-center gap-[1.5px] justify-center h-8">
          {Array.from({ length: 48 }).map((_, i) => (
            <motion.div
              key={i}
              className={`w-[1px] rounded-full ${speaking ? "bg-accent/55" : "bg-primary/60"}`}
              animate={{
                height: speaking
                  ? [2, Math.random() * 28 + 4, 2]
                  : listening
                  ? [1, Math.random() * 20 + 2, 1]
                  : [1, Math.random() * 4 + 1, 1],
              }}
              transition={{
                duration: speaking ? 0.4 + Math.random() * 0.3 : 0.8 + Math.random() * 0.5,
                repeat: Infinity,
                delay: i * 0.015,
              }}
            />
          ))}
        </div>

        <span className="text-[8px] text-muted-foreground/92 tracking-wider font-mono">ELEVENLABS · VOICE AI</span>
      </div>
    </motion.div>
  );
};

export default VoicePresence;