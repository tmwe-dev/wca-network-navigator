/**
 * ConversationSidebar — History panel for /v2/command (ChatGPT-style)
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Archive, MessageSquare, PanelLeftClose, PanelLeft } from "lucide-react";
import type { Conversation } from "@/v2/io/supabase/queries/conversations";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onArchive: (id: string) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "ora";
  if (mins < 60) return `${mins} min fa`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h fa`;
  const days = Math.floor(hours / 24);
  return `${days}g fa`;
}

export default function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onArchive,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Toggle button — always visible */}
      <motion.button
        onClick={() => setCollapsed((v) => !v)}
        className="fixed top-6 left-[72px] z-50 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-white/5 transition-all backdrop-blur-md border border-white/[0.06]"
        whileTap={{ scale: 0.9 }}
        title={collapsed ? "Mostra cronologia" : "Nascondi cronologia"}
      >
        {collapsed ? (
          <PanelLeft className="w-3.5 h-3.5" />
        ) : (
          <PanelLeftClose className="w-3.5 h-3.5" />
        )}
      </motion.button>

      <AnimatePresence>
        {!collapsed && (
          <motion.aside
            initial={{ x: -260, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -260, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
            className="w-[260px] flex-shrink-0 h-full flex flex-col border-r border-white/[0.06]"
            style={{
              background: "hsl(240 5% 4% / 0.85)",
              backdropFilter: "blur(40px)",
            }}
          >
            {/* Header */}
            <div className="px-4 pt-16 pb-3">
              <button
                onClick={onNew}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-light text-foreground/90 hover:bg-white/[0.06] transition-all border border-white/[0.08]"
              >
                <Plus className="w-3.5 h-3.5 text-primary/80" />
                Nuova conversazione
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                  <MessageSquare className="w-6 h-6 text-muted-foreground/30 mb-3" />
                  <p className="text-[11px] text-muted-foreground/50 font-light">
                    Nessuna conversazione
                  </p>
                  <p className="text-[10px] text-muted-foreground/30 mt-1">
                    Inizia digitando un obiettivo
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {conversations.map((c) => (
                    <motion.div
                      key={c.id}
                      className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-300 ${
                        c.id === activeId
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-white/[0.04] border border-transparent"
                      }`}
                      onClick={() => onSelect(c.id)}
                      whileHover={{ x: 2 }}
                    >
                      <MessageSquare
                        className={`w-3 h-3 flex-shrink-0 ${
                          c.id === activeId
                            ? "text-primary/70"
                            : "text-muted-foreground/30"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-[11px] truncate ${
                            c.id === activeId
                              ? "text-foreground/90"
                              : "text-foreground/60"
                          } font-light`}
                        >
                          {c.title || "Senza titolo"}
                        </p>
                        <p className="text-[9px] text-muted-foreground/40 font-mono mt-0.5">
                          {timeAgo(c.last_message_at)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onArchive(c.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
                        title="Archivia"
                      >
                        <Archive className="w-3 h-3 text-muted-foreground/50" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
