/**
 * CommandSuggestions — empty state with dynamic data-driven prompts + static fallbacks.
 */
import { motion } from "framer-motion";
import AiEntity from "@/components/ai/AiEntity";
import { capabilities } from "../constants";
import { useSmartSuggestions } from "@/v2/hooks/useSmartSuggestions";

const ease = [0.2, 0.8, 0.2, 1] as const;

interface Props {
  onSend: (text: string) => void;
}

const staticFallbacks = [
  "Prepara follow-up per clienti inattivi >30 giorni",
  "Verifica email e comunicazioni da autorizzare",
  "Genera report executive con analisi performance",
  "Mostra stato campagne attive e prossime scadenze",
];

function suggestionToPrompt(s: { id: string; label: string }): string {
  switch (s.id) {
    case "unread-emails": return "Analizza le email in arrivo e mostra quelle che richiedono azione";
    case "proposed-tasks": return "Mostra i task proposti dagli agenti da confermare";
    case "pending-approval": return "Mostra le azioni in attesa di autorizzazione";
    case "draft-emails": return "Mostra le bozze email da rivedere e inviare";
    case "pending-outreach": return "Mostra gli outreach programmati da verificare";
    case "active-jobs": return "Mostra lo stato dei job attivi";
    default: return s.label;
  }
}

export default function CommandSuggestions({ onSend }: Props) {
  const { data: smartSuggestions = [] } = useSmartSuggestions();

  const dynamicPrompts = smartSuggestions.map(s => ({
    text: suggestionToPrompt(s),
    icon: s.icon,
    badge: s.count > 0 ? s.count : undefined,
  }));

  // Fill remaining slots with static fallbacks
  const allPrompts = [
    ...dynamicPrompts,
    ...staticFallbacks.slice(0, Math.max(0, 6 - dynamicPrompts.length)).map(t => ({ text: t, icon: "→", badge: undefined })),
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8">
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.5, ease }} className="mb-10">
        <AiEntity size="lg" />
      </motion.div>
      <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, ease }} className="text-2xl font-extralight tracking-tight text-foreground/100 mb-2">
        Cosa vuoi ottenere?
      </motion.h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-[13px] text-muted-foreground/98 font-light mb-10 text-center max-w-sm">
        Centro di comando AI — analizza, organizza, esegui
      </motion.p>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} className="flex flex-col items-center gap-2">
        {allPrompts.map((p, i) => (
          <motion.button
            key={p.text}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 + i * 0.1, ease }}
            onClick={() => onSend(p.text)}
            whileHover={{ x: 4 }}
            className="text-[12px] px-4 py-2.5 rounded-2xl text-muted-foreground/97 hover:text-muted-foreground/98 hover:bg-secondary/[0.1] transition-all duration-700 text-left flex items-center gap-2"
          >
            <span>{p.icon}</span>
            <span>{p.text}</span>
            {p.badge !== undefined && p.badge > 0 && (
              <span className="text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                {p.badge}
              </span>
            )}
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
