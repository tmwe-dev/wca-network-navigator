import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Mic, MicOff, X, Plus, History, Trash2, Zap, MessageSquare, PanelRightOpen, PanelRightClose, Loader2 } from "lucide-react";
import VoicePresence from "./VoicePresence";
import { PageErrorBoundary } from "@/components/ui/PageErrorBoundary";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { useIntelliFlowOverlay, type OverlayProps } from "./overlay/useIntelliFlowOverlay";
import { OverlayConversationThread } from "./overlay/OverlayConversationThread";
import { OverlayQuickPromptBar } from "./overlay/OverlayQuickPromptBar";
import { OverlayEntityResults } from "./overlay/OverlayEntityResults";

export default function IntelliFlowOverlay(props: OverlayProps) {
  const ov = useIntelliFlowOverlay(props);

  return (
    <PageErrorBoundary>
    <AnimatePresence>
      {props.open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex flex-col bg-background">
          {/* Top bar */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-border/70 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs text-foreground font-medium tracking-wide">IntelliFlow · {ov.pageLabel}</span>
              {ov.loading && <span className="text-[10px] text-primary font-mono ml-2 font-semibold">ELABORAZIONE</span>}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 bg-secondary/50 rounded-lg p-0.5 text-[10px]">
                <button onClick={() => ov.setMode("operational")}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${ov.mode === "operational" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  <Zap className="w-3 h-3" /> Operativo
                </button>
                <button onClick={() => ov.setMode("conversational")}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${ov.mode === "conversational" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  <MessageSquare className="w-3 h-3" /> Strategico
                </button>
              </div>
              <button onClick={() => ov.setShowPanel(!ov.showPanel)}
                className={`flex items-center gap-1.5 text-[10px] transition-colors px-2 py-1.5 rounded-lg ${ov.showPanel ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"}`}>
                {ov.showPanel ? <PanelRightOpen className="w-3.5 h-3.5" /> : <PanelRightClose className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">Pannello</span>
              </button>
              <button onClick={() => { ov.newConversation(); ov.setShowHistory(false); }}
                className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-secondary/30">
                <Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline">Nuova</span>
              </button>
              <button onClick={() => ov.setShowHistory(!ov.showHistory)}
                className={`flex items-center gap-1.5 text-[10px] transition-colors px-2 py-1.5 rounded-lg ${ov.showHistory ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"}`}>
                <History className="w-3.5 h-3.5" /><span className="hidden sm:inline">Cronologia</span>
              </button>
              <span className="text-[10px] text-muted-foreground font-mono tracking-wider hidden lg:block">{ov.statsLine}</span>
              <button onClick={props.onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary/30">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main */}
          <div className="flex-1 flex min-h-0">
            {/* History sidebar */}
            <AnimatePresence>
              {ov.showHistory && (
                <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 260, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                  className="border-r border-border/70 overflow-hidden flex-shrink-0">
                  <div className="w-[260px] h-full overflow-y-auto py-3 px-2 space-y-1">
                    <p className="text-[10px] text-muted-foreground font-medium px-2 mb-2 uppercase tracking-wider">Conversazioni recenti</p>
                    {ov.conversations.length === 0 && <p className="text-[11px] text-muted-foreground/60 px-2">Nessuna conversazione salvata</p>}
                    {ov.conversations.map((c) => (
                      <div key={c.id} className="group flex items-center gap-1 rounded-lg px-2 py-2 cursor-pointer hover:bg-secondary/40 transition-colors"
                        onClick={() => { ov.resumeConversation(c.id); ov.setShowHistory(false); }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground/80 truncate">{c.title}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(c.updated_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); ov.deleteConversation(c.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Content */}
            <ResizablePanelGroup direction="horizontal" className="flex-1">
              <ResizablePanel defaultSize={ov.showPanel && ov.hasPanelContent ? 55 : 100} minSize={40}>
                <div className="flex flex-col h-full min-h-0">
                  {ov.isEmpty ? (
                    <OverlayQuickPromptBar statsLine={ov.statsLine} pageLabel={ov.pageLabel} quickPrompts={ov.quickPrompts} onSend={ov.sendMessage} />
                  ) : (
                    <OverlayConversationThread messages={ov.messages} loading={ov.loading} chatEndRef={ov.chatEndRef} />
                  )}

                  <VoicePresence active={ov.speech.listening} listening={ov.speech.listening} speaking={false} />

                  {/* Input bar */}
                  <div className="px-8 pb-8 pt-3 flex-shrink-0">
                    <div className="max-w-2xl mx-auto">
                      <motion.div
                        animate={{ boxShadow: ov.inputFocused ? "0 0 0 2px hsl(var(--primary) / 0.2), 0 4px 24px hsl(var(--primary) / 0.08)" : "0 0 0 1px hsl(var(--border))" }}
                        transition={{ duration: 0.3 }}
                        className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-card border border-border">
                        <button onClick={ov.speech.toggle}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                            ov.speech.listening ? "bg-destructive/20 text-destructive ring-2 ring-destructive/40" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                          }`}>
                          {ov.speech.listening ? <MicOff className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
                        </button>
                        <input ref={ov.inputRef} type="text"
                          placeholder={ov.speech.listening ? "🎙 Sto ascoltando…" : ov.mode === "conversational" ? "Discutiamo strategia…" : "Scrivi un obiettivo…"}
                          value={ov.speech.listening ? (ov.input + (ov.speech.interimText ? ` ${ov.speech.interimText}` : "")) : ov.input}
                          onChange={(e) => ov.setInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && ov.sendMessage()}
                          onFocus={() => ov.setInputFocused(true)}
                          onBlur={() => ov.setInputFocused(false)}
                          disabled={ov.loading}
                          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground" />
                        <button onClick={() => ov.sendMessage()} disabled={!ov.input.trim() || ov.loading}
                          className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/15 text-primary hover:bg-primary/25 transition-all disabled:opacity-30 flex-shrink-0">
                          {ov.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                      </motion.div>
                    </div>
                  </div>
                </div>
              </ResizablePanel>

              {ov.showPanel && ov.hasPanelContent && (
                <>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={45} minSize={25} maxSize={60}>
                    <OverlayEntityResults partners={ov.panelData.partners} operations={ov.panelData.operations} />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </PageErrorBoundary>
  );
}
