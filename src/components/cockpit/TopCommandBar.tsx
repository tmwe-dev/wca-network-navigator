import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Search, Mic, MicOff, LayoutGrid, List, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ViewMode, CockpitFilter } from "@/pages/Cockpit";

export interface CockpitAIAction {
  type: "filter" | "select_all" | "clear_selection" | "select_where" | "bulk_action" | "single_action" | "view_mode" | "auto_outreach";
  filters?: CockpitFilter[];
  field?: string;
  operator?: string;
  value?: unknown;
  action?: string;
  contactName?: string;
  mode?: ViewMode;
  channel?: string;
  contactNames?: string[];
}

interface TopCommandBarProps {
  onAIActions: (actions: CockpitAIAction[], message: string) => void;
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  contacts: Array<{ id: string; name: string; company: string; country: string; priority: number; language: string; channels: string[] }>;
}

type MicState = "idle" | "listening" | "processing" | "applied";

export function TopCommandBar({ onAIActions, viewMode, onViewChange, searchQuery, onSearchChange, contacts }: TopCommandBarProps) {
  const [input, setInput] = useState("");
  const [micState, setMicState] = useState<MicState>("idle");
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke("cockpit-assistant", {
        body: { command: input, contacts },
      });

      if (error) {
        let parsed: any = null;
        try {
          if (error.context instanceof Response) parsed = await error.context.json();
        } catch {}
        throw new Error(parsed?.error || error.message);
      }

      if (data?.error) throw new Error(data.error);

      const actions: CockpitAIAction[] = data?.actions || [];
      const message: string = data?.message || "";

      onAIActions(actions, message);
      setInput("");
    } catch (err: any) {
      toast.error(err.message || "Errore nel comando AI");
    } finally {
      setIsProcessing(false);
    }
  };

  const micRingColor: Record<MicState, string> = {
    idle: "border-muted-foreground/60",
    listening: "border-destructive animate-pulse",
    processing: "border-warning animate-spin",
    applied: "border-success",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 pt-3 pb-2"
    >
      <form onSubmit={handleSubmit} className="relative flex items-center gap-3">
        {/* Command Input */}
        <div className="relative flex-1 group">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/20 via-accent/20 to-chart-3/20 blur-xl opacity-0 group-focus-within:opacity-60 transition-opacity duration-500" />
          <div className="relative flex items-center gap-2 rounded-xl border border-border/60 bg-card/80 backdrop-blur-xl px-4 py-2.5 focus-within:border-primary/50 transition-all duration-200">
            {isProcessing ? (
              <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Comanda con AI — filtra, seleziona, lancia deep search..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/80 focus:outline-none"
              disabled={isProcessing}
            />
            <Search className="w-4 h-4 text-muted-foreground/70" />
          </div>
        </div>

        {/* Mic Button */}
        <button
          type="button"
          className={cn(
            "relative w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-300 hover:scale-105",
            micRingColor[micState],
            micState === "listening" && "bg-destructive/10",
            micState === "idle" && "bg-card/60 hover:bg-card/80"
          )}
          onClick={() => setMicState(prev => prev === "idle" ? "listening" : "idle")}
        >
          {micState === "listening" ? (
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              <Mic className="w-4 h-4 text-destructive" />
            </motion.div>
          ) : (
            <MicOff className="w-4 h-4 text-muted-foreground" />
          )}
          {micState === "listening" && (
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-destructive/40"
              animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />
          )}
        </button>

        {/* View Toggle */}
        <div className="flex items-center rounded-lg border border-border/60 bg-card/60 backdrop-blur-sm p-0.5">
          <button
            type="button"
            onClick={() => onViewChange("card")}
            className={cn(
              "p-1.5 rounded-md transition-all duration-200",
              viewMode === "card" ? "bg-primary/20 text-primary" : "text-muted-foreground/80 hover:text-foreground"
            )}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onViewChange("list")}
            className={cn(
              "p-1.5 rounded-md transition-all duration-200",
              viewMode === "list" ? "bg-primary/20 text-primary" : "text-muted-foreground/80 hover:text-foreground"
            )}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </form>
    </motion.div>
  );
}
