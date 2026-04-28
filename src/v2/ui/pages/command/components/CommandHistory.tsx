import { AnimatePresence, motion } from "framer-motion";
import { Wand2 } from "lucide-react";
import AiEntity from "@/components/ai/AiEntity";

export interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  agentName?: string;
  thinking?: boolean;
  meta?: string;
  tools?: string[];
  governance?: string;
  /** Optional follow-up actions rendered as clickable chips under the message */
  suggestedActions?: { label: string; prompt: string }[];
}

interface CommandHistoryProps {
  messages: Message[];
  isEmpty: boolean;
  quickPrompts: string[];
  onQuickPrompt: (prompt: string) => void;
  chatEndRef: React.RefObject<HTMLDivElement>;
}

const ease = [0.2, 0.8, 0.2, 1] as const;

export function CommandHistory({
  messages,
  isEmpty,
  quickPrompts,
  onQuickPrompt,
  chatEndRef,
}: CommandHistoryProps) {
  if (isEmpty) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease }}
          className="mb-10"
        >
          <AiEntity size="lg" />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, ease }}
          className="text-2xl font-extralight tracking-tight text-foreground/100 mb-2"
        >
          Cosa vuoi ottenere?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-[13px] text-muted-foreground/98 font-light mb-10 text-center max-w-sm"
        >
          14 sorgenti unificate · 12.847 contatti · 234 partner WCA · 1.420
          business card
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="flex flex-col items-center gap-2"
        >
          {quickPrompts.map((p, i) => (
            <motion.button
              key={p}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 + i * 0.1, ease }}
              onClick={() => onQuickPrompt(p)}
              whileHover={{ x: 4 }}
              className="text-[12px] px-4 py-2.5 rounded-2xl text-muted-foreground/97 hover:text-muted-foreground/98 hover:bg-secondary/[0.1] transition-all duration-700 text-left"
            >
              → {p}
            </motion.button>
          ))}
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
          className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-12"
        >
          {[
            "Source Unification",
            "Search Partners",
            "Parse Cards",
            "Create Draft",
            "Send Batch",
            "Read Aloud",
            "Audit Action",
          ].map((cap, i) => (
            <motion.span
              key={cap}
              className="text-[9px] text-muted-foreground/100 font-light"
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 4, repeat: Infinity, delay: i * 0.5 }}
            >
              {cap}
            </motion.span>
          ))}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <div className="max-w-xl mx-auto space-y-6">
        {messages.map((msg) => (
          <AnimatePresence key={msg.id}>
            {msg.thinking ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4, ease }}
                className="flex items-start gap-3"
              >
                <div className="flex-shrink-0 mt-1">
                  <AiEntity size="sm" />
                </div>
                <div className="flex items-center gap-2 px-5 py-4">
                  {[0, 1, 2].map((dot) => (
                    <motion.div
                      key={dot}
                      className="w-1.5 h-1.5 rounded-full bg-primary/95"
                      animate={{
                        opacity: [0.2, 0.7, 0.2],
                        scale: [0.8, 1.1, 0.8],
                      }}
                      transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        delay: dot * 0.2,
                      }}
                    />
                  ))}
                  <span className="text-[11px] text-muted-foreground/100 ml-2 font-light">
                    Attivo tool operativi...
                  </span>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease }}
                className={`flex items-start gap-3 ${
                  msg.role === "user" ? "justify-end" : ""
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 mt-1">
                    <AiEntity size="sm" pulse={false} />
                  </div>
                )}
                <motion.div
                  className={`max-w-[85%] relative ${
                    msg.role === "user"
                      ? "px-5 py-4 rounded-2xl rounded-br-lg"
                      : "px-5 py-4 rounded-2xl rounded-bl-lg"
                  }`}
                  style={{
                    background:
                      msg.role === "assistant"
                        ? "hsl(240 5% 6% / 0.7)"
                        : "hsl(240 5% 8% / 0.65)",
                    border: `1px solid hsl(0 0% 100% / ${
                      msg.role === "assistant" ? "0.16" : "0.12"
                    })`,
                    backdropFilter: "blur(40px)",
                    boxShadow:
                      msg.role === "assistant"
                        ? "0 0 60px hsl(210 100% 66% / 0.1), 0 20px 50px -20px hsl(0 0% 0% / 0.94)"
                        : "none",
                  }}
                >
                  {msg.agentName && (
                    <motion.div
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 }}
                      className="text-[10px] text-primary/100 font-mono mb-2.5 tracking-[0.2em] uppercase"
                    >
                      {msg.agentName}
                    </motion.div>
                  )}
                  <div className="text-[14px] leading-[1.7] whitespace-pre-line font-light text-foreground/100">
                    {msg.content.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                      part.startsWith("**") && part.endsWith("**") ? (
                        <span
                          key={i}
                          className="text-primary/92 font-mono text-[12px]"
                        >
                          {part.slice(2, -2)}
                        </span>
                      ) : (
                        <span key={i}>{part}</span>
                      )
                    )}
                  </div>
                  {msg.meta && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="flex items-center gap-2 mt-3 pt-2 border-t border-border/[0.16]"
                    >
                      <Wand2 className="w-2.5 h-2.5 text-primary/92" />
                      <span className="text-[10px] text-muted-foreground/100 font-light font-mono">
                        {msg.meta}
                      </span>
                    </motion.div>
                  )}
                  {msg.governance && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      className="flex items-center gap-2 mt-1.5"
                    >
                      <div className="w-1 h-1 rounded-full bg-success/90" />
                      <span className="text-[9px] text-muted-foreground/100 font-mono">
                        {msg.governance}
                      </span>
                    </motion.div>
                  )}
                  <span className="text-[10px] text-muted-foreground/100 mt-2 block">
                    {msg.timestamp}
                  </span>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        ))}

        <div ref={chatEndRef} />
      </div>
    </div>
  );
}
